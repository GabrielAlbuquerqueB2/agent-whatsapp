import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppLogger } from '../../common/logger/app-logger.service';
import { WebhookEvent } from '../../database/entities';
import { WhatsappApiService } from '../../integrations/whatsapp-api/whatsapp-api.service';
import { formatPhone } from '../../common/utils/helpers';

export interface ProcessedMessage {
  messageId: string;
  from: string;
  fromFormatted: string;
  contactName: string;
  type: 'text' | 'interactive' | 'other';
  content: string;
  interactiveId?: string;
  timestamp: Date;
}

@Injectable()
export class WhatsappWebhookService implements OnModuleInit {
  private verifyToken: string;
  private processedMessageIds: Set<string> = new Set();

  constructor(
    @InjectRepository(WebhookEvent)
    private webhookEventRepository: Repository<WebhookEvent>,
    private readonly configService: ConfigService,
    private readonly whatsappApi: WhatsappApiService,
    private readonly logger: AppLogger,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.verifyToken = this.configService.get<string>('WHATSAPP_VERIFY_TOKEN') || '';
  }

  onModuleInit() {
    // Limpa cache de mensagens processadas a cada hora
    setInterval(() => {
      this.processedMessageIds.clear();
    }, 60 * 60 * 1000);
  }

  /**
   * Valida o token de verificação do webhook
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.verifyToken) {
      this.logger.log('Webhook verificado com sucesso', 'WhatsappWebhookService');
      return challenge;
    }
    this.logger.warn('Falha na verificação do webhook', 'WhatsappWebhookService');
    return null;
  }

  /**
   * Processa o payload do webhook
   */
  async processWebhook(payload: any): Promise<void> {
    try {
      if (payload.object !== 'whatsapp_business_account') {
        return;
      }

      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field !== 'messages') continue;

          const value = change.value;

          // Processa status updates (entrega, leitura, etc)
          if (value.statuses) {
            await this.processStatusUpdates(value.statuses);
            continue;
          }

          // Processa mensagens recebidas
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              await this.processIncomingMessage(message, value.contacts?.[0]);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Erro ao processar webhook: ${error.message}`,
        error.stack,
        'WhatsappWebhookService',
      );
      throw error;
    }
  }

  /**
   * Processa uma mensagem recebida
   */
  private async processIncomingMessage(
    message: any,
    contact?: any,
  ): Promise<void> {
    const messageId = message.id;

    // Idempotência: verifica se já foi processada
    if (this.processedMessageIds.has(messageId)) {
      this.logger.debug(`Mensagem já processada: ${messageId}`, 'WhatsappWebhookService');
      return;
    }

    // Verifica no banco de dados
    const existingEvent = await this.webhookEventRepository.findOne({
      where: { event_id: messageId, source: 'whatsapp' },
    });

    if (existingEvent?.processed) {
      this.processedMessageIds.add(messageId);
      return;
    }

    // Salva o evento no banco
    const webhookEvent = await this.webhookEventRepository.save({
      source: 'whatsapp',
      event_id: messageId,
      event_type: `message_${message.type}`,
      payload: { message, contact },
      processed: false,
    });

    try {
      // Marca como lida
      await this.whatsappApi.markAsRead(messageId);

      // Processa a mensagem
      const processedMessage = this.parseMessage(message, contact);

      // Emite evento para o orquestrador processar
      this.eventEmitter.emit('whatsapp.message.received', processedMessage);

      // Marca como processado
      await this.webhookEventRepository.update(webhookEvent.id, {
        processed: true,
        processed_at: new Date(),
      });

      this.processedMessageIds.add(messageId);

      this.logger.log(
        `Mensagem processada: ${messageId} de ${processedMessage.from}`,
        'WhatsappWebhookService',
      );
    } catch (error) {
      await this.webhookEventRepository.update(webhookEvent.id, {
        error_message: error.message,
        retry_count: webhookEvent.retry_count + 1,
      });
      throw error;
    }
  }

  /**
   * Converte mensagem do WhatsApp para formato interno
   */
  private parseMessage(message: any, contact?: any): ProcessedMessage {
    const from = message.from;
    let content = '';
    let interactiveId: string | undefined;

    switch (message.type) {
      case 'text':
        content = message.text?.body || '';
        break;

      case 'interactive':
        if (message.interactive?.button_reply) {
          content = message.interactive.button_reply.title;
          interactiveId = message.interactive.button_reply.id;
        } else if (message.interactive?.list_reply) {
          content = message.interactive.list_reply.title;
          interactiveId = message.interactive.list_reply.id;
        }
        break;

      default:
        content = `[${message.type}]`;
    }

    return {
      messageId: message.id,
      from,
      fromFormatted: formatPhone(from),
      contactName: contact?.profile?.name || 'Paciente',
      type: message.type === 'text' ? 'text' : message.type === 'interactive' ? 'interactive' : 'other',
      content,
      interactiveId,
      timestamp: new Date(parseInt(message.timestamp) * 1000),
    };
  }

  /**
   * Processa atualizações de status (entrega, leitura)
   */
  private async processStatusUpdates(statuses: any[]): Promise<void> {
    for (const status of statuses) {
      this.logger.debug(
        `Status update: ${status.id} -> ${status.status}`,
        'WhatsappWebhookService',
      );

      // Emite evento de status se necessário
      this.eventEmitter.emit('whatsapp.status.updated', {
        messageId: status.id,
        status: status.status,
        timestamp: new Date(parseInt(status.timestamp) * 1000),
        recipientId: status.recipient_id,
      });
    }
  }
}
