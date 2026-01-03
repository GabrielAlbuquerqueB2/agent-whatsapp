import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Segurança
  app.use(helmet());
  
  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // Validação global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Prefixo global da API (exceto rotas raiz)
  app.setGlobalPrefix('api/v1', {
    exclude: ['/', 'health', 'docs', 'auth/google', 'auth/google/callback'],
  });

  // Swagger/OpenAPI
  const config = new DocumentBuilder()
    .setTitle('PSI Agenda System')
    .setDescription('Sistema Completo de Automação de Consultas Psicológicas')
    .setVersion('1.0')
    .addTag('whatsapp', 'Webhooks e mensagens WhatsApp')
    .addTag('pacientes', 'Gestão de pacientes')
    .addTag('consultas', 'Agendamento e gestão de consultas')
    .addTag('pagamentos', 'Integração financeira Asaas')
    .addTag('relatorios', 'Relatórios e auditoria')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 Aplicação rodando em: http://localhost:${port}`);
  logger.log(`📚 Documentação disponível em: http://localhost:${port}/docs`);
}

bootstrap();
