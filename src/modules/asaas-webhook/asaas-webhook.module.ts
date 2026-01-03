import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AsaasWebhookController } from './asaas-webhook.controller';
import { AsaasWebhookService } from './asaas-webhook.service';
import { WebhookEvent, Pagamento, Auditoria } from '../../database/entities';
import { CobrancaModule } from '../cobranca/cobranca.module';
import { ConsultasModule } from '../consultas/consultas.module';
import { PacientesModule } from '../pacientes/pacientes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookEvent, Pagamento, Auditoria]),
    forwardRef(() => CobrancaModule),
    ConsultasModule,
    PacientesModule,
  ],
  controllers: [AsaasWebhookController],
  providers: [AsaasWebhookService],
  exports: [AsaasWebhookService],
})
export class AsaasWebhookModule {}
