import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Res,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { WhatsappWebhookService } from './whatsapp-webhook.service';
import { WhatsAppWebhookDto, WhatsAppVerifyDto } from './dto/whatsapp-webhook.dto';
import { AppLogger } from '../../common/logger/app-logger.service';

@ApiTags('whatsapp')
@Controller('whatsapp/webhook')
export class WhatsappWebhookController {
  constructor(
    private readonly webhookService: WhatsappWebhookService,
    private readonly logger: AppLogger,
  ) {}

  /**
   * GET - Verificação do Webhook pelo Facebook/WhatsApp
   */
  @Get()
  @ApiOperation({ summary: 'Verificação do webhook WhatsApp' })
  @ApiResponse({ status: 200, description: 'Webhook verificado com sucesso' })
  @ApiResponse({ status: 403, description: 'Token de verificação inválido' })
  verifyWebhook(@Query() query: any, @Res() res: Response) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    this.logger.debug(
      `Verificação de webhook recebida: mode=${mode}`,
      'WhatsappWebhookController',
    );

    const result = this.webhookService.verifyWebhook(mode, token, challenge);

    if (result) {
      return res.status(HttpStatus.OK).send(result);
    }

    return res.status(HttpStatus.FORBIDDEN).send('Forbidden');
  }

  /**
   * POST - Recebe eventos do WhatsApp
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recebe eventos do webhook WhatsApp' })
  @ApiResponse({ status: 200, description: 'Evento recebido com sucesso' })
  async receiveWebhook(
    @Body() body: WhatsAppWebhookDto,
    @Req() req: RawBodyRequest<Request>,
  ) {
    this.logger.debug(
      'Webhook WhatsApp recebido',
      'WhatsappWebhookController',
    );

    // Processa de forma assíncrona para responder rapidamente
    setImmediate(async () => {
      try {
        await this.webhookService.processWebhook(body);
      } catch (error) {
        this.logger.error(
          `Erro ao processar webhook: ${error.message}`,
          error.stack,
          'WhatsappWebhookController',
        );
      }
    });

    // Responde imediatamente para o WhatsApp não reenviar
    return { status: 'received' };
  }
}
