import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppLogger } from '../../common/logger/app-logger.service';
import { WhatsappApiService } from '../../integrations/whatsapp-api/whatsapp-api.service';
import {
  Paciente,
  Handoff,
  StatusHandoff,
  MotivoHandoff,
  Auditoria,
  TipoEventoAuditoria,
} from '../../database/entities';
import { ESTADOS_CONVERSA, MENSAGENS } from '../../common/constants';

interface HandoffContext {
  paciente: Paciente;
  telefone: string;
  motivo?: MotivoHandoff;
  descricao?: string;
}

@Injectable()
export class HandoffService {
  constructor(
    @InjectRepository(Paciente)
    private pacienteRepository: Repository<Paciente>,
    @InjectRepository(Handoff)
    private handoffRepository: Repository<Handoff>,
    @InjectRepository(Auditoria)
    private auditoriaRepository: Repository<Auditoria>,
    private readonly whatsappApi: WhatsappApiService,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Inicia transferência para atendimento humano
   */
  @OnEvent('handoff.iniciar')
  async iniciarHandoff(ctx: HandoffContext): Promise<Handoff> {
    const { paciente, telefone, motivo, descricao } = ctx;

    this.logger.log(
      `Iniciando handoff para paciente: ${paciente.id}`,
      'HandoffService',
    );

    // Verifica se já existe handoff ativo
    const handoffAtivo = await this.handoffRepository.findOne({
      where: {
        paciente_id: paciente.id,
        status: StatusHandoff.AGUARDANDO,
      },
    });

    if (handoffAtivo) {
      await this.whatsappApi.sendTextMessage(
        telefone,
        'Você já está na fila de atendimento. Por favor, aguarde.',
      );
      return handoffAtivo;
    }

    // Cria novo handoff
    const handoff = await this.handoffRepository.save({
      paciente_id: paciente.id,
      status: StatusHandoff.AGUARDANDO,
      motivo: motivo || MotivoHandoff.SOLICITACAO_PACIENTE,
      descricao: descricao,
    });

    // Atualiza estado do paciente
    await this.pacienteRepository.update(paciente.id, {
      ultimo_estado_conversa: ESTADOS_CONVERSA.ATENDIMENTO_HUMANO,
    });

    // Auditoria
    await this.auditoriaRepository.save({
      tipo_evento: TipoEventoAuditoria.HANDOFF_INICIADO,
      paciente_id: paciente.id,
      metadata: { handoff_id: handoff.id, motivo },
    });

    await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.TRANSFERINDO_ATENDENTE);

    // Aqui você poderia notificar atendentes via outro canal
    this.notificarAtendentes(paciente, handoff);

    return handoff;
  }

  /**
   * Notifica atendentes sobre novo handoff (pode integrar com Slack, email, etc)
   */
  private async notificarAtendentes(paciente: Paciente, handoff: Handoff): Promise<void> {
    // TODO: Implementar notificação para atendentes
    // Pode ser via Slack, email, ou outro sistema
    this.logger.log(
      `Notificação de handoff: Paciente ${paciente.nome} (${paciente.telefone}) aguardando atendimento`,
      'HandoffService',
    );
  }

  /**
   * Inicia atendimento (chamado pelo atendente)
   */
  async iniciarAtendimento(handoffId: string, atendente: string): Promise<Handoff> {
    const handoff = await this.handoffRepository.findOne({
      where: { id: handoffId },
    });

    if (!handoff) {
      throw new Error('Handoff não encontrado');
    }

    await this.handoffRepository.update(handoffId, {
      status: StatusHandoff.EM_ATENDIMENTO,
      atendente,
      inicio_atendimento: new Date(),
    });

    const handoffAtualizado = await this.handoffRepository.findOne({ where: { id: handoffId } });
    if (!handoffAtualizado) {
      throw new Error('Handoff não encontrado após atualização');
    }
    return handoffAtualizado;
  }

  /**
   * Finaliza atendimento humano
   */
  async finalizarAtendimento(
    handoffId: string,
    resolucao: string,
  ): Promise<Handoff> {
    const handoff = await this.handoffRepository.findOne({
      where: { id: handoffId },
    });

    if (!handoff) {
      throw new Error('Handoff não encontrado');
    }

    await this.handoffRepository.update(handoffId, {
      status: StatusHandoff.FINALIZADO,
      fim_atendimento: new Date(),
      resolucao,
    });

    // Retorna paciente ao menu principal
    await this.pacienteRepository.update(handoff.paciente_id, {
      ultimo_estado_conversa: ESTADOS_CONVERSA.MENU_PRINCIPAL,
    });

    // Auditoria
    await this.auditoriaRepository.save({
      tipo_evento: TipoEventoAuditoria.HANDOFF_FINALIZADO,
      paciente_id: handoff.paciente_id,
      metadata: { handoff_id: handoffId, resolucao },
    });

    this.logger.log(`Handoff ${handoffId} finalizado`, 'HandoffService');

    const handoffAtualizado = await this.handoffRepository.findOne({ where: { id: handoffId } });
    if (!handoffAtualizado) {
      throw new Error('Handoff não encontrado após atualização');
    }
    return handoffAtualizado;
  }

  /**
   * Lista handoffs aguardando atendimento
   */
  async listarAguardando(): Promise<Handoff[]> {
    return this.handoffRepository.find({
      where: { status: StatusHandoff.AGUARDANDO },
      order: { created_at: 'ASC' },
    });
  }

  /**
   * Lista handoffs em atendimento
   */
  async listarEmAtendimento(): Promise<Handoff[]> {
    return this.handoffRepository.find({
      where: { status: StatusHandoff.EM_ATENDIMENTO },
    });
  }
}
