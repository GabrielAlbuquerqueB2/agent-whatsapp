import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { AppLogger } from '../../common/logger/app-logger.service';

export interface WhatsAppMessage {
  to: string;
  type: 'text' | 'template' | 'interactive';
  text?: {
    body: string;
  };
  template?: {
    name: string;
    language: { code: string };
    components?: any[];
  };
  interactive?: {
    type: 'button' | 'list';
    header?: any;
    body: { text: string };
    footer?: { text: string };
    action: any;
  };
}

export interface WhatsAppWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
}

@Injectable()
export class WhatsappApiService {
  private readonly client: AxiosInstance;
  private readonly phoneNumberId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    const apiUrl = this.configService.get<string>('WHATSAPP_API_URL');
    const accessToken = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
    this.phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID') || '';

    this.client = axios.create({
      baseURL: apiUrl,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Envia mensagem de texto simples
   */
  async sendTextMessage(to: string, text: string): Promise<any> {
    try {
      const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text },
      });

      this.logger.log(`Mensagem enviada para ${to}`, 'WhatsappApiService');
      return response.data;
    } catch (error) {
      this.logger.error(
        `Erro ao enviar mensagem para ${to}: ${error.message}`,
        error.stack,
        'WhatsappApiService',
      );
      throw error;
    }
  }

  /**
   * Envia mensagem com botões interativos
   */
  async sendButtonMessage(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
    headerText?: string,
    footerText?: string,
  ): Promise<any> {
    try {
      const message: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: buttons.map((btn) => ({
              type: 'reply',
              reply: { id: btn.id, title: btn.title },
            })),
          },
        },
      };

      if (headerText) {
        message.interactive.header = { type: 'text', text: headerText };
      }

      if (footerText) {
        message.interactive.footer = { text: footerText };
      }

      const response = await this.client.post(`/${this.phoneNumberId}/messages`, message);
      this.logger.log(`Mensagem com botões enviada para ${to}`, 'WhatsappApiService');
      return response.data;
    } catch (error) {
      this.logger.error(
        `Erro ao enviar mensagem com botões para ${to}: ${error.message}`,
        error.stack,
        'WhatsappApiService',
      );
      throw error;
    }
  }

  /**
   * Envia mensagem com lista de opções
   */
  async sendListMessage(
    to: string,
    bodyText: string,
    buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
    headerText?: string,
    footerText?: string,
  ): Promise<any> {
    try {
      const message: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: bodyText },
          action: {
            button: buttonText,
            sections,
          },
        },
      };

      if (headerText) {
        message.interactive.header = { type: 'text', text: headerText };
      }

      if (footerText) {
        message.interactive.footer = { text: footerText };
      }

      const response = await this.client.post(`/${this.phoneNumberId}/messages`, message);
      this.logger.log(`Mensagem com lista enviada para ${to}`, 'WhatsappApiService');
      return response.data;
    } catch (error) {
      this.logger.error(
        `Erro ao enviar mensagem com lista para ${to}: ${error.message}`,
        error.stack,
        'WhatsappApiService',
      );
      throw error;
    }
  }

  /**
   * Envia template de mensagem
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string = 'pt_BR',
    components?: any[],
  ): Promise<any> {
    try {
      const message: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
        },
      };

      if (components) {
        message.template.components = components;
      }

      const response = await this.client.post(`/${this.phoneNumberId}/messages`, message);
      this.logger.log(`Template ${templateName} enviado para ${to}`, 'WhatsappApiService');
      return response.data;
    } catch (error) {
      this.logger.error(
        `Erro ao enviar template para ${to}: ${error.message}`,
        error.stack,
        'WhatsappApiService',
      );
      throw error;
    }
  }

  /**
   * Marca mensagem como lida
   */
  async markAsRead(messageId: string): Promise<any> {
    try {
      const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });
      return response.data;
    } catch (error) {
      this.logger.warn(
        `Erro ao marcar mensagem como lida: ${error.message}`,
        'WhatsappApiService',
      );
    }
  }
}
