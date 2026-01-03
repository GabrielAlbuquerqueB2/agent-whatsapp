import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  
  // Clínica
  clinic: {
    name: process.env.CLINIC_NAME || 'Consultório de Psicologia',
    phone: process.env.CLINIC_PHONE,
    psychologistName: process.env.PSYCHOLOGIST_NAME,
    consultationValue: parseFloat(process.env.CONSULTATION_VALUE) || 200.00,
    consultationDuration: parseInt(process.env.CONSULTATION_DURATION_MINUTES, 10) || 50,
  },

  // Horários
  businessHours: {
    start: process.env.BUSINESS_HOURS_START || '08:00',
    end: process.env.BUSINESS_HOURS_END || '18:00',
    days: (process.env.BUSINESS_DAYS || '1,2,3,4,5').split(',').map(Number),
  },

  // Lembretes
  reminders: {
    reminder24h: process.env.REMINDER_24H_ENABLED === 'true',
    reminder2h: process.env.REMINDER_2H_ENABLED === 'true',
  },

  // Segurança
  security: {
    jwtSecret: process.env.JWT_SECRET,
    encryptionKey: process.env.ENCRYPTION_KEY,
  },

  // Logs
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    filePath: process.env.LOG_FILE_PATH || './logs',
  },
}));
