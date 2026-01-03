import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '../../common/logger/app-logger.service';
import { WhatsappApiService } from '../../integrations/whatsapp-api/whatsapp-api.service';
import { AsaasService } from '../../integrations/asaas/asaas.service';
import { ConsultasService } from '../consultas/consultas.service';
import { PacientesService } from '../pacientes/pacientes.service';
import {
  Consulta,
  Pagamento,
  StatusConsulta,
  StatusPagamento,
  MetodoPagamento,
  StatusPagamentoAsaas,
  Auditoria,
  TipoEventoAuditoria,
} from '../../database/entities';
import { MENSAGENS } from '../../common/constants';
import { formatCurrency } from '../../common/utils/helpers';

@Injectable()
export class CobrancaService {
  constructor(
    @InjectRepository(Pagamento)
    private pagamentoRepository: Repository<Pagamento>,
    @InjectRepository(Auditoria)
    private auditoriaRepository: Repository<Auditoria>,
    private readonly asaasService: AsaasService,
    private readonly consultasService: ConsultasService,
    private readonly pacientesService: PacientesService,
    private readonly whatsappApi: WhatsappApiService,
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Job: Processa consultas realizadas e gera cobranças
   * REGRA CRÍTICA: Só gera cobrança se consulta foi REALIZADA
   * Executa a cada 15 minutos
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async processarConsultasRealizadas(): Promise<void> {
    this.logger.log(
      'Processando consultas realizadas para cobrança',
      'CobrancaService',
    );

    try {
      const consultas = await this.consultasService.findRealizadasSemCobranca();

      for (const consulta of consultas) {
        await this.gerarCobranca(consulta);
      }

      this.logger.log(
        `Cobranças processadas: ${consultas.length}`,
        'CobrancaService',
      );
    } catch (error) {
      this.logger.error(
        `Erro ao processar cobranças: ${error.message}`,
        error.stack,
        'CobrancaService',
      );
    }
  }

  /**
   * Gera cobrança para uma consulta REALIZADA
   * REGRA: Nunca duplicar cobrança
   */
  async gerarCobranca(consulta: Consulta): Promise<Pagamento> {
    // Validação crítica: só gera se REALIZADA
    if (consulta.status_consulta !== StatusConsulta.REALIZADA) {
      throw new Error('Cobrança só pode ser gerada para consultas REALIZADAS');
    }

    // Verifica se já existe pagamento
    const pagamentoExistente = await this.pagamentoRepository.findOne({
      where: { consulta_id: consulta.id },
    });

    if (pagamentoExistente) {
      this.logger.warn(
        `Cobrança já existe para consulta ${consulta.id}`,
        'CobrancaService',
      );
      return pagamentoExistente;
    }

    const paciente = await this.pacientesService.findById(consulta.paciente_id);
    if (!paciente) {
      throw new Error('Paciente não encontrado');
    }

    // Garante que paciente está sincronizado com Asaas
    let asaasCustomerId = paciente.asaas_customer_id;
    if (!asaasCustomerId) {
      asaasCustomerId = await this.pacientesService.sincronizarComAsaas(paciente.id);
    }

    // Determina método de pagamento
    const billingType = this.mapTipoPagamento(paciente.tipo_pagamento);

    // Calcula data de vencimento (D+3)
    const dataVencimento = new Date();
    dataVencimento.setDate(dataVencimento.getDate() + 3);

    try {
      // Cria cobrança no Asaas
      const asaasPayment = await this.asaasService.createPayment({
        customer: asaasCustomerId,
        billingType,
        value: consulta.valor,
        dueDate: dataVencimento.toISOString().split('T')[0],
        description: `Consulta realizada em ${consulta.data}`,
        externalReference: consulta.id,
      });

      // Obtém dados de pagamento (PIX, boleto)
      let pixCopiaECola: string | null = null;
      let qrCodeUrl: string | null = null;
      let linhaDigitavel: string | null = null;

      if (billingType === 'PIX') {
        const pixData = await this.asaasService.getPixQrCode(asaasPayment.id);
        if (pixData) {
          pixCopiaECola = pixData.payload;
          qrCodeUrl = pixData.encodedImage;
        }
      } else if (billingType === 'BOLETO') {
        linhaDigitavel = await this.asaasService.getBoletoIdentificationField(asaasPayment.id);
      }

      // Salva pagamento no banco
      const novoPagamento: Pagamento = this.pagamentoRepository.create({
        consulta_id: consulta.id,
        asaas_payment_id: asaasPayment.id,
        valor: Number(consulta.valor),
        metodo_pagamento: paciente.tipo_pagamento as unknown as MetodoPagamento,
        status: StatusPagamentoAsaas.PENDING,
        link_pagamento: asaasPayment.invoiceUrl,
        linha_digitavel: linhaDigitavel,
        pix_copia_cola: pixCopiaECola,
        qr_code_url: qrCodeUrl,
        data_vencimento: dataVencimento,
      } as Partial<Pagamento>);
      const pagamento: Pagamento = await this.pagamentoRepository.save(novoPagamento);

      // Atualiza status da consulta
      await this.consultasService.atualizarStatusPagamento(
        consulta.id,
        StatusPagamento.COBRANCA_GERADA,
      );

      // Auditoria
      await this.auditoriaRepository.save({
        tipo_evento: TipoEventoAuditoria.COBRANCA_CRIADA,
        paciente_id: paciente.id,
        consulta_id: consulta.id,
        pagamento_id: pagamento.id,
        dados_novos: {
          asaas_payment_id: asaasPayment.id,
          valor: consulta.valor,
          metodo: billingType,
          vencimento: dataVencimento,
        },
      });

      // Notifica paciente via WhatsApp
      await this.notificarCobranca(paciente.telefone, consulta.valor, asaasPayment.invoiceUrl);

      this.logger.log(
        `Cobrança gerada: ${pagamento.id} para consulta ${consulta.id}`,
        'CobrancaService',
      );

      return pagamento;

    } catch (error) {
      this.logger.error(
        `Erro ao gerar cobrança para consulta ${consulta.id}: ${error.message}`,
        error.stack,
        'CobrancaService',
      );
      throw error;
    }
  }

  /**
   * Gera cobrança manual (API)
   */
  async gerarCobrancaManual(consultaId: string): Promise<Pagamento> {
    const consulta = await this.consultasService.findById(consultaId);
    if (!consulta) {
      throw new Error('Consulta não encontrada');
    }

    return this.gerarCobranca(consulta);
  }

  /**
   * Notifica paciente sobre cobrança gerada
   */
  private async notificarCobranca(
    telefone: string,
    valor: number,
    linkPagamento: string,
  ): Promise<void> {
    const mensagem = MENSAGENS.COBRANCA_GERADA(
      formatCurrency(valor),
      linkPagamento,
    );

    await this.whatsappApi.sendTextMessage(telefone, mensagem);
  }

  /**
   * Mapeia tipo de pagamento interno para Asaas
   */
  private mapTipoPagamento(tipo: string): 'PIX' | 'BOLETO' | 'CREDIT_CARD' {
    switch (tipo) {
      case 'PIX':
        return 'PIX';
      case 'BOLETO':
        return 'BOLETO';
      case 'CARTAO_CREDITO':
        return 'CREDIT_CARD';
      default:
        return 'PIX';
    }
  }

  /**
   * Busca pagamento por ID Asaas
   */
  async findByAsaasId(asaasPaymentId: string): Promise<Pagamento | null> {
    return this.pagamentoRepository.findOne({
      where: { asaas_payment_id: asaasPaymentId },
      relations: ['consulta'],
    });
  }

  /**
   * Atualiza status do pagamento
   */
  async atualizarStatus(
    pagamentoId: string,
    status: StatusPagamentoAsaas,
    dataPagamento?: Date,
  ): Promise<void> {
    const updateData: Partial<Pagamento> = { status };
    
    if (dataPagamento) {
      updateData.data_pagamento = dataPagamento;
    }

    if (status === StatusPagamentoAsaas.CONFIRMED) {
      updateData.data_confirmacao = new Date();
    }

    await this.pagamentoRepository.update(pagamentoId, updateData);
  }
}
