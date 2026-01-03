import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { AsaasWebhookService, AsaasWebhookPayload } from './asaas-webhook.service';
import { AppLogger } from '../../common/logger/app-logger.service';

@ApiTags('pagamentos')
@Controller('webhooks/asaas')
export class AsaasWebhookController {
  constructor(
    private readonly asaasWebhookService: AsaasWebhookService,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Endpoint para receber webhooks do Asaas
   * Implementa validação de token e processamento assíncrono
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recebe webhooks do Asaas' })
  @ApiHeader({ name: 'asaas-access-token', description: 'Token de autenticação Asaas' })
  @ApiResponse({ status: 200, description: 'Webhook recebido com sucesso' })
  @ApiResponse({ status: 401, description: 'Token inválido' })
  async receiveWebhook(
    @Body() payload: AsaasWebhookPayload,
    @Headers('asaas-access-token') accessToken: string,
  ) {
    this.logger.debug(
      `Webhook Asaas recebido: ${payload.event}`,
      'AsaasWebhookController',
    );

    // Valida token
    if (!this.asaasWebhookService.validateWebhookToken(accessToken)) {
      this.logger.warn(
        'Token de webhook inválido',
        'AsaasWebhookController',
      );
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    // Processa de forma assíncrona para responder rapidamente
    setImmediate(async () => {
      try {
        await this.asaasWebhookService.processWebhook(payload);
      } catch (error) {
        this.logger.error(
          `Erro ao processar webhook Asaas: ${error.message}`,
          error.stack,
          'AsaasWebhookController',
        );
      }
    });

    return { status: 'received' };
  }
}
