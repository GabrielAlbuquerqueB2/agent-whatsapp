import { Module, Global } from '@nestjs/common';
import { WhatsappApiService } from './whatsapp-api.service';

@Global()
@Module({
  providers: [WhatsappApiService],
  exports: [WhatsappApiService],
})
export class WhatsappApiModule {}
