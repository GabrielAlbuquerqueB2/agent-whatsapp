import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '../../common/logger/app-logger.service';
import { WhatsappApiService } from '../../integrations/whatsapp-api/whatsapp-api.service';
import { CobrancaService } from '../cobranca/cobranca.service';
import { ConsultasService } from '../consultas/consultas.service';
import { PacientesService } from '../pacientes/pacientes.service';
import {
  WebhookEvent,
  Pagamento,
  StatusPagamento,
  StatusPagamentoAsaas,
  Auditoria,
  TipoEventoAuditoria,
} from '../../database/entities';
import { MENSAGENS } from '../../common/constants';
import { formatCurrency } from '../../common/utils/helpers';

export interface AsaasWebhookPayload {
  event: string;
  payment?: {
    id: string;
    customer: string;
    value: number;
    netValue: number;
    status: string;
    billingType: string;
    confirmedDate?: string;
    paymentDate?: string;
    dueDate: string;
    externalReference?: string;
  };
}

@Injectable()
export class AsaasWebhookService {
  private readonly webhookToken: string;

  constructor(
    @InjectRepository(WebhookEvent)
    private webhookEventRepository: Repository<WebhookEvent>,
    @InjectRepository(Pagamento)
    private pagamentoRepository: Repository<Pagamento>,
    @InjectRepository(Auditoria)
    private auditoriaRepository: Repository<Auditoria>,
    private readonly cobrancaService: CobrancaService,
    private readonly consultasService: ConsultasService,
    private readonly pacientesService: PacientesService,
    private readonly whatsappApi: WhatsappApiService,
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.webhookToken = this.configService.get<string>('ASAAS_WEBHOOK_TOKEN') || '';
  }

  /**
   * Valida token do webhook
   */
  validateWebhookToken(token: string): boolean {
    return token === this.webhookToken;
  }

  /**
   * Processa webhook do Asaas com IDEMPOTÊNCIA
   * REGRA: Webhooks nunca criam dados novos, apenas atualizam
   */
  async processWebhook(payload: AsaasWebhookPayload): Promise<void> {
    const eventId = `${payload.event}_${payload.payment?.id}_${Date.now()}`;

    this.logger.log(
      `Webhook Asaas recebido: ${payload.event}`,
      'AsaasWebhookService',
    );

    // Idempotência: verifica se já foi processado
    const existingEvent = await this.webhookEventRepository.findOne({
      where: {
        source: 'asaas',
        event_id: payload.payment?.id ? `${payload.event}_${payload.payment.id}` : eventId,
      },
    });

    if (existingEvent?.processed) {
      this.logger.debug(
        `Webhook já processado: ${existingEvent.event_id}`,
        'AsaasWebhookService',
      );
      return;
    }

    // Salva evento para idempotência
    const webhookEvent = await this.webhookEventRepository.save({
      source: 'asaas',
      event_id: payload.payment?.id ? `${payload.event}_${payload.payment.id}` : eventId,
      event_type: payload.event,
      payload: payload as any,
      processed: false,
    });

    try {
      // Processa por tipo de evento
      switch (payload.event) {
        case 'PAYMENT_RECEIVED':
          await this.handlePaymentReceived(payload);
          break;

        case 'PAYMENT_CONFIRMED':
          await this.handlePaymentConfirmed(payload);
          break;

        case 'PAYMENT_OVERDUE':
          await this.handlePaymentOverdue(payload);
          break;

        case 'PAYMENT_DELETED':
        case 'PAYMENT_REFUNDED':
          await this.handlePaymentCancelled(payload);
          break;

        default:
          this.logger.debug(
            `Evento não tratado: ${payload.event}`,
            'AsaasWebhookService',
          );
      }

      // Marca como processado
      await this.webhookEventRepository.update(webhookEvent.id, {
        processed: true,
        processed_at: new Date(),
      });

      // Auditoria
      await this.auditoriaRepository.save({
        tipo_evento: TipoEventoAuditoria.WEBHOOK_ASAAS_RECEBIDO,
        metadata: {
          event: payload.event,
          payment_id: payload.payment?.id,
        },
        idempotency_key: webhookEvent.event_id,
      });

    } catch (error) {
      this.logger.error(
        `Erro ao processar webhook: ${error.message}`,
        error.stack,
        'AsaasWebhookService',
      );

      await this.webhookEventRepository.update(webhookEvent.id, {
        error_message: error.message,
        retry_count: webhookEvent.retry_count + 1,
      });

      throw error;
    }
  }

  /**
   * Trata pagamento recebido
   * REGRA: Só atualiza registros existentes
   */
  private async handlePaymentReceived(payload: AsaasWebhookPayload): Promise<void> {
    const payment = payload.payment;
    if (!payment) {
      this.logger.warn('Payload sem dados de pagamento', 'AsaasWebhookService');
      return;
    }

    const asaasPaymentId = payment.id;

    // Busca pagamento existente
    const pagamento = await this.cobrancaService.findByAsaasId(asaasPaymentId);
    
    if (!pagamento) {
      this.logger.warn(
        `Pagamento não encontrado no sistema: ${asaasPaymentId}`,
        'AsaasWebhookService',
      );
      return; // Não cria novo registro
    }

    // Atualiza status
    await this.cobrancaService.atualizarStatus(
      pagamento.id,
      StatusPagamentoAsaas.RECEIVED,
      payment.paymentDate ? new Date(payment.paymentDate) : new Date(),
    );

    // Atualiza consulta
    await this.consultasService.atualizarStatusPagamento(
      pagamento.consulta_id,
      StatusPagamento.PAGO,
    );

    // Notifica paciente
    const consulta = await this.consultasService.findById(pagamento.consulta_id);
    if (consulta?.paciente) {
      await this.notificarPagamentoRecebido(
        consulta.paciente.telefone,
        payment.value,
      );
    }

    // Auditoria
    await this.auditoriaRepository.save({
      tipo_evento: TipoEventoAuditoria.PAGAMENTO_RECEBIDO,
      pagamento_id: pagamento.id,
      consulta_id: pagamento.consulta_id,
      dados_novos: {
        valor: payment.value,
        data_pagamento: payment.paymentDate,
      },
    });

    this.logger.log(
      `Pagamento recebido: ${asaasPaymentId}`,
      'AsaasWebhookService',
    );
  }

  /**
   * Trata pagamento confirmado
   */
  private async handlePaymentConfirmed(payload: AsaasWebhookPayload): Promise<void> {
    const payment = payload.payment;
    if (!payment) return;

    const asaasPaymentId = payment.id;

    const pagamento = await this.cobrancaService.findByAsaasId(asaasPaymentId);
    
    if (!pagamento) {
      this.logger.warn(
        `Pagamento não encontrado: ${asaasPaymentId}`,
        'AsaasWebhookService',
      );
      return;
    }

    await this.cobrancaService.atualizarStatus(
      pagamento.id,
      StatusPagamentoAsaas.CONFIRMED,
    );

    await this.auditoriaRepository.save({
      tipo_evento: TipoEventoAuditoria.PAGAMENTO_CONFIRMADO,
      pagamento_id: pagamento.id,
      dados_novos: { confirmed_date: payment.confirmedDate },
    });

    this.logger.log(
      `Pagamento confirmado: ${asaasPaymentId}`,
      'AsaasWebhookService',
    );
  }

  /**
   * Trata pagamento vencido
   */
  private async handlePaymentOverdue(payload: AsaasWebhookPayload): Promise<void> {
    const payment = payload.payment;
    if (!payment) return;

    const asaasPaymentId = payment.id;

    const pagamento = await this.cobrancaService.findByAsaasId(asaasPaymentId);
    
    if (!pagamento) return;

    await this.cobrancaService.atualizarStatus(
      pagamento.id,
      StatusPagamentoAsaas.OVERDUE,
    );

    await this.consultasService.atualizarStatusPagamento(
      pagamento.consulta_id,
      StatusPagamento.VENCIDO,
    );

    await this.auditoriaRepository.save({
      tipo_evento: TipoEventoAuditoria.PAGAMENTO_VENCIDO,
      pagamento_id: pagamento.id,
    });

    this.logger.log(
      `Pagamento vencido: ${asaasPaymentId}`,
      'AsaasWebhookService',
    );
  }

  /**
   * Trata pagamento cancelado/reembolsado
   */
  private async handlePaymentCancelled(payload: AsaasWebhookPayload): Promise<void> {
    const payment = payload.payment;
    if (!payment) return;

    const asaasPaymentId = payment.id;

    const pagamento = await this.cobrancaService.findByAsaasId(asaasPaymentId);
    
    if (!pagamento) return;

    const status = payload.event === 'PAYMENT_REFUNDED'
      ? StatusPagamentoAsaas.REFUNDED
      : StatusPagamentoAsaas.REFUNDED;

    await this.cobrancaService.atualizarStatus(pagamento.id, status);

    await this.consultasService.atualizarStatusPagamento(
      pagamento.consulta_id,
      StatusPagamento.REEMBOLSADO,
    );

    await this.auditoriaRepository.save({
      tipo_evento: TipoEventoAuditoria.PAGAMENTO_REEMBOLSADO,
      pagamento_id: pagamento.id,
    });

    this.logger.log(
      `Pagamento cancelado/reembolsado: ${asaasPaymentId}`,
      'AsaasWebhookService',
    );
  }

  /**
   * Notifica paciente sobre pagamento recebido
   */
  private async notificarPagamentoRecebido(
    telefone: string,
    valor: number,
  ): Promise<void> {
    const mensagem = MENSAGENS.PAGAMENTO_CONFIRMADO(formatCurrency(valor));
    await this.whatsappApi.sendTextMessage(telefone, mensagem);
  }
}
