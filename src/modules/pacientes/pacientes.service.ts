import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppLogger } from '../../common/logger/app-logger.service';
import { AsaasService } from '../../integrations/asaas/asaas.service';
import { Paciente, TipoPessoa, TipoPagamento, TipoCobranca, Auditoria, TipoEventoAuditoria } from '../../database/entities';
import { ConfigService } from '@nestjs/config';

export interface CriarPacienteDto {
  nome: string;
  telefone: string;
  cpf?: string;
  email?: string;
  tipoPessoa?: TipoPessoa;
  tipoPagamento?: TipoPagamento;
  tipoCobranca?: TipoCobranca;
  valor?: number;
}

export interface AtualizarPacienteDto {
  nome?: string;
  cpf?: string;
  email?: string;
  tipoPessoa?: TipoPessoa;
  tipoPagamento?: TipoPagamento;
  tipoCobranca?: TipoCobranca;
  valor?: number;
}

@Injectable()
export class PacientesService {
  constructor(
    @InjectRepository(Paciente)
    private pacienteRepository: Repository<Paciente>,
    @InjectRepository(Auditoria)
    private auditoriaRepository: Repository<Auditoria>,
    private readonly asaasService: AsaasService,
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Busca paciente por telefone (identificador único)
   */
  async findByTelefone(telefone: string): Promise<Paciente | null> {
    return this.pacienteRepository.findOne({
      where: { telefone },
      relations: ['consultas'],
    });
  }

  /**
   * Busca paciente por ID
   */
  async findById(id: string): Promise<Paciente | null> {
    return this.pacienteRepository.findOne({
      where: { id },
      relations: ['consultas'],
    });
  }

  /**
   * Busca paciente por CPF
   */
  async findByCpf(cpf: string): Promise<Paciente | null> {
    return this.pacienteRepository.findOne({
      where: { cpf: cpf.replace(/\D/g, '') },
    });
  }

  /**
   * Cria um novo paciente
   * Regra: Telefone é identificador único
   */
  async criar(dto: CriarPacienteDto): Promise<Paciente> {
    // Verifica se já existe paciente com este telefone
    const existente = await this.findByTelefone(dto.telefone);
    if (existente) {
      this.logger.warn(
        `Tentativa de criar paciente duplicado: ${dto.telefone}`,
        'PacientesService',
      );
      return existente;
    }

    const valorConsulta = this.configService.get<number>('app.clinic.consultationValue');

    const paciente = await this.pacienteRepository.save({
      nome: dto.nome,
      telefone: dto.telefone,
      cpf: dto.cpf?.replace(/\D/g, ''),
      email: dto.email,
      tipo_pessoa: dto.tipoPessoa || TipoPessoa.FISICA,
      tipo_pagamento: dto.tipoPagamento || TipoPagamento.PIX,
      tipo_cobranca: dto.tipoCobranca || TipoCobranca.AVULSA,
      valor: dto.valor || valorConsulta,
      cadastro_completo: false,
    });

    // Auditoria
    await this.auditoriaRepository.save({
      tipo_evento: TipoEventoAuditoria.PACIENTE_CRIADO,
      paciente_id: paciente.id,
      dados_novos: { ...dto },
    });

    this.logger.log(`Paciente criado: ${paciente.id}`, 'PacientesService');

    return paciente;
  }

  /**
   * Atualiza dados do paciente
   */
  async atualizar(id: string, dto: AtualizarPacienteDto): Promise<Paciente> {
    const paciente = await this.findById(id);
    if (!paciente) {
      throw new Error('Paciente não encontrado');
    }

    const dadosAnteriores = { ...paciente };

    const updateData: Partial<Paciente> = {};
    if (dto.nome) updateData.nome = dto.nome;
    if (dto.cpf) updateData.cpf = dto.cpf.replace(/\D/g, '');
    if (dto.email) updateData.email = dto.email;
    if (dto.tipoPessoa) updateData.tipo_pessoa = dto.tipoPessoa;
    if (dto.tipoPagamento) updateData.tipo_pagamento = dto.tipoPagamento;
    if (dto.tipoCobranca) updateData.tipo_cobranca = dto.tipoCobranca;
    if (dto.valor) updateData.valor = dto.valor;

    await this.pacienteRepository.update(id, updateData);

    // Auditoria
    await this.auditoriaRepository.save({
      tipo_evento: TipoEventoAuditoria.PACIENTE_ATUALIZADO,
      paciente_id: id,
      dados_anteriores: dadosAnteriores,
      dados_novos: dto,
    });

    this.logger.log(`Paciente atualizado: ${id}`, 'PacientesService');

    const pacienteAtualizado = await this.findById(id);
    if (!pacienteAtualizado) {
      throw new Error('Paciente não encontrado após atualização');
    }
    return pacienteAtualizado;
  }

  /**
   * Sincroniza paciente com Asaas (cria cliente se não existir)
   * Regra: Nunca criar cliente duplicado no Asaas
   */
  async sincronizarComAsaas(pacienteId: string): Promise<string> {
    const paciente = await this.findById(pacienteId);
    if (!paciente) {
      throw new Error('Paciente não encontrado');
    }

    // Se já tem ID do Asaas, retorna
    if (paciente.asaas_customer_id) {
      return paciente.asaas_customer_id;
    }

    // Verifica se precisa de CPF para criar no Asaas
    if (!paciente.cpf) {
      throw new Error('CPF é obrigatório para criar cliente no Asaas');
    }

    try {
      // Cria ou recupera cliente existente (o Asaas service já verifica duplicidade)
      const asaasCustomer = await this.asaasService.createCustomer({
        name: paciente.nome,
        cpfCnpj: paciente.cpf,
        email: paciente.email,
        mobilePhone: paciente.telefone,
        externalReference: paciente.id,
      });

      // Atualiza paciente com ID do Asaas
      await this.pacienteRepository.update(pacienteId, {
        asaas_customer_id: asaasCustomer.id,
      });

      // Auditoria
      await this.auditoriaRepository.save({
        tipo_evento: TipoEventoAuditoria.CLIENTE_ASAAS_CRIADO,
        paciente_id: pacienteId,
        dados_novos: { asaas_customer_id: asaasCustomer.id },
      });

      this.logger.log(
        `Paciente ${pacienteId} sincronizado com Asaas: ${asaasCustomer.id}`,
        'PacientesService',
      );

      return asaasCustomer.id;
    } catch (error) {
      this.logger.error(
        `Erro ao sincronizar paciente com Asaas: ${error.message}`,
        error.stack,
        'PacientesService',
      );
      throw error;
    }
  }

  /**
   * Lista todos os pacientes ativos
   */
  async listarAtivos(): Promise<Paciente[]> {
    return this.pacienteRepository.find({
      where: { ativo: true },
      order: { nome: 'ASC' },
    });
  }

  /**
   * Busca pacientes com consultas pendentes de pagamento
   */
  async listarComPagamentoPendente(): Promise<Paciente[]> {
    return this.pacienteRepository
      .createQueryBuilder('paciente')
      .innerJoin('paciente.consultas', 'consulta')
      .where('consulta.status_pagamento = :status', { status: 'PENDENTE' })
      .andWhere('consulta.status_consulta = :statusConsulta', { statusConsulta: 'REALIZADA' })
      .getMany();
  }
}
