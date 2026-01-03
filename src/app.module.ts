import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

// Configurações
import { databaseConfig } from './config/database.config';
import { appConfig } from './config/app.config';

// Módulos do Sistema
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { PacientesModule } from './modules/pacientes/pacientes.module';
import { ConsultasModule } from './modules/consultas/consultas.module';
import { AgendamentoModule } from './modules/agendamento/agendamento.module';
import { ReagendamentoModule } from './modules/reagendamento/reagendamento.module';
import { CancelamentoModule } from './modules/cancelamento/cancelamento.module';
import { HandoffModule } from './modules/handoff/handoff.module';
import { LembretesModule } from './modules/lembretes/lembretes.module';
import { CobrancaModule } from './modules/cobranca/cobranca.module';
import { AsaasWebhookModule } from './modules/asaas-webhook/asaas-webhook.module';
import { RelatoriosModule } from './modules/relatorios/relatorios.module';

// Integrações
import { GoogleCalendarModule } from './integrations/google-calendar/google-calendar.module';
import { AsaasModule } from './integrations/asaas/asaas.module';
import { WhatsappApiModule } from './integrations/whatsapp-api/whatsapp-api.module';

// Comum
import { LoggerModule } from './common/logger/logger.module';

@Module({
  imports: [
    // Configurações globais
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
      envFilePath: ['.env', '.env.local'],
    }),

    // Banco de dados
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.name'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('app.nodeEnv') === 'development',
        logging: configService.get('app.nodeEnv') === 'development',
      }),
    }),

    // Agendador de tarefas (Cron)
    ScheduleModule.forRoot(),

    // Logger customizado
    LoggerModule,

    // Integrações externas
    WhatsappApiModule,
    GoogleCalendarModule,
    AsaasModule,

    // Módulos do sistema
    WhatsappModule,
    PacientesModule,
    ConsultasModule,
    AgendamentoModule,
    ReagendamentoModule,
    CancelamentoModule,
    HandoffModule,
    LembretesModule,
    CobrancaModule,
    AsaasWebhookModule,
    RelatoriosModule,
  ],
})
export class AppModule {}
