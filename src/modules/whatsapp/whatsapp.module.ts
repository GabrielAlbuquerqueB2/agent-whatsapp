import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappWebhookService } from './whatsapp-webhook.service';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import { WebhookEvent, Paciente, Consulta, Handoff } from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookEvent, Paciente, Consulta, Handoff]),
    EventEmitterModule.forRoot(),
  ],
  controllers: [WhatsappWebhookController],
  providers: [WhatsappWebhookService, WhatsappOrchestratorService],
  exports: [WhatsappWebhookService, WhatsappOrchestratorService],
})
export class WhatsappModule {}
