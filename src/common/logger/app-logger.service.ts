import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppLogger implements LoggerService {
  private logger: winston.Logger;

  constructor(private configService: ConfigService) {
    const logLevel = this.configService.get('app.logging.level') || 'debug';
    const logPath = this.configService.get('app.logging.filePath') || './logs';

    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: { service: 'psi-agenda' },
      transports: [
        // Console
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp, context, ...meta }) => {
              return `${timestamp} [${context || 'App'}] ${level}: ${message} ${
                Object.keys(meta).length ? JSON.stringify(meta) : ''
              }`;
            }),
          ),
        }),
        // Arquivo de erros
        new winston.transports.File({
          filename: `${logPath}/error.log`,
          level: 'error',
        }),
        // Arquivo combinado
        new winston.transports.File({
          filename: `${logPath}/combined.log`,
        }),
        // Arquivo de auditoria financeira
        new winston.transports.File({
          filename: `${logPath}/financial-audit.log`,
          level: 'info',
        }),
      ],
    });
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context });
  }

  // Método específico para auditoria financeira
  auditFinanceiro(evento: string, dados: Record<string, any>) {
    this.logger.info(evento, {
      context: 'FINANCIAL_AUDIT',
      ...dados,
      audit: true,
    });
  }
}
