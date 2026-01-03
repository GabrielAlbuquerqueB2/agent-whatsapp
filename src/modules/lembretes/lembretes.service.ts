import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '../../common/logger/app-logger.service';
import { WhatsappApiService } from '../../integrations/whatsapp-api/whatsapp-api.service';
import { ConsultasService } from '../consultas/consultas.service';
import { Consulta, Paciente, Auditoria, TipoEventoAuditoria } from '../../database/entities';
import { MENSAGENS } from '../../common/constants';
import { formatDate } from '../../common/utils/helpers';

@Injectable()
export class LembretesService {
  private readonly lembrete24hAtivo: boolean;
  private readonly lembrete2hAtivo: boolean;

  constructor(
    @InjectRepository(Paciente)
    private pacienteRepository: Repository<Paciente>,
    @InjectRepository(Auditoria)
    private auditoriaRepository: Repository<Auditoria>,
    private readonly whatsappApi: WhatsappApiService,
    private readonly consultasService: ConsultasService,
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.lembrete24hAtivo = this.configService.get('app.reminders.reminder24h') !== false;
    this.lembrete2hAtivo = this.configService.get('app.reminders.reminder2h') !== false;
  }

  /**
   * Job: Envia lembretes 24h antes da consulta
   * Executa a cada hora
   */
  @Cron(CronExpression.EVERY_HOUR)
  async enviarLembretes24h(): Promise<void> {
    if (!this.lembrete24hAtivo) return;

    this.logger.log('Iniciando envio de lembretes 24h', 'LembretesService');

    try {
      const consultas = await this.consultasService.findParaLembrete24h();

      for (const consulta of consultas) {
        await this.enviarLembrete24h(consulta);
      }

      this.logger.log(
        `Lembretes 24h enviados: ${consultas.length}`,
        'LembretesService',
      );
    } catch (error) {
      this.logger.error(
        `Erro ao enviar lembretes 24h: ${error.message}`,
        error.stack,
        'LembretesService',
      );
    }
  }

  /**
   * Job: Envia lembretes 2h antes da consulta
   * Executa a cada 30 minutos
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async enviarLembretes2h(): Promise<void> {
    if (!this.lembrete2hAtivo) return;

    this.logger.log('Iniciando envio de lembretes 2h', 'LembretesService');

    try {
      const consultas = await this.consultasService.findParaLembrete2h();

      for (const consulta of consultas) {
        await this.enviarLembrete2h(consulta);
      }

      this.logger.log(
        `Lembretes 2h enviados: ${consultas.length}`,
        'LembretesService',
      );
    } catch (error) {
      this.logger.error(
        `Erro ao enviar lembretes 2h: ${error.message}`,
        error.stack,
        'LembretesService',
      );
    }
  }

  /**
   * Envia lembrete 24h antes
   */
  private async enviarLembrete24h(consulta: Consulta): Promise<void> {
    const paciente = consulta.paciente;
    if (!paciente) {
      this.logger.warn(
        `Consulta ${consulta.id} sem paciente associado`,
        'LembretesService',
      );
      return;
    }

    try {
      const mensagem = MENSAGENS.LEMBRETE_24H(
        formatDate(consulta.data),
        consulta.horario,
      );

      await this.whatsappApi.sendTextMessage(paciente.telefone, mensagem);

      // Marca como enviado
      await this.consultasService.marcarLembreteEnviado(consulta.id, '24h');

      // Auditoria
      await this.auditoriaRepository.save({
        tipo_evento: TipoEventoAuditoria.LEMBRETE_ENVIADO,
        paciente_id: paciente.id,
        consulta_id: consulta.id,
        metadata: { tipo: '24h' },
      });

      this.logger.debug(
        `Lembrete 24h enviado para ${paciente.telefone}`,
        'LembretesService',
      );
    } catch (error) {
      this.logger.error(
        `Erro ao enviar lembrete 24h para ${paciente.telefone}: ${error.message}`,
        error.stack,
        'LembretesService',
      );
    }
  }

  /**
   * Envia lembrete 2h antes
   */
  private async enviarLembrete2h(consulta: Consulta): Promise<void> {
    const paciente = consulta.paciente;
    if (!paciente) return;

    try {
      const mensagem = MENSAGENS.LEMBRETE_2H(consulta.horario);

      await this.whatsappApi.sendTextMessage(paciente.telefone, mensagem);

      // Marca como enviado
      await this.consultasService.marcarLembreteEnviado(consulta.id, '2h');

      // Auditoria
      await this.auditoriaRepository.save({
        tipo_evento: TipoEventoAuditoria.LEMBRETE_ENVIADO,
        paciente_id: paciente.id,
        consulta_id: consulta.id,
        metadata: { tipo: '2h' },
      });

      this.logger.debug(
        `Lembrete 2h enviado para ${paciente.telefone}`,
        'LembretesService',
      );
    } catch (error) {
      this.logger.error(
        `Erro ao enviar lembrete 2h para ${paciente.telefone}: ${error.message}`,
        error.stack,
        'LembretesService',
      );
    }
  }

  /**
   * Envia lembrete manual (API)
   */
  async enviarLembreteManual(consultaId: string): Promise<void> {
    const consulta = await this.consultasService.findById(consultaId);
    if (!consulta) {
      throw new Error('Consulta não encontrada');
    }

    const paciente = await this.pacienteRepository.findOne({
      where: { id: consulta.paciente_id },
    });

    if (!paciente) {
      this.logger.warn(`Paciente não encontrado para consulta ${consultaId}`, 'LembretesService');
      return;
    }

    const mensagem = MENSAGENS.LEMBRETE_24H(
      formatDate(consulta.data),
      consulta.horario,
    );

    await this.whatsappApi.sendTextMessage(paciente.telefone, mensagem);

    this.logger.log(
      `Lembrete manual enviado para consulta ${consultaId}`,
      'LembretesService',
    );
  }
}
