import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { AppLogger } from '../../common/logger/app-logger.service';
import {
  Consulta,
  StatusConsulta,
  StatusPagamento,
  Auditoria,
  TipoEventoAuditoria,
} from '../../database/entities';
import { formatDate, formatDateTime } from '../../common/utils/helpers';

export interface CriarConsultaDto {
  paciente_id: string;
  data: Date;
  horario: string;
  valor: number;
  google_calendar_event_id?: string;
}

@Injectable()
export class ConsultasService {
  constructor(
    @InjectRepository(Consulta)
    private consultaRepository: Repository<Consulta>,
    @InjectRepository(Auditoria)
    private auditoriaRepository: Repository<Auditoria>,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Cria uma nova consulta
   */
  async criar(dto: CriarConsultaDto): Promise<Consulta> {
    const [hora, minuto] = dto.horario.split(':').map(Number);
    
    const dataHoraInicio = new Date(dto.data);
    dataHoraInicio.setHours(hora, minuto, 0, 0);

    const dataHoraFim = new Date(dataHoraInicio);
    dataHoraFim.setMinutes(dataHoraFim.getMinutes() + 50); // 50 minutos padrão

    const consulta = await this.consultaRepository.save({
      paciente_id: dto.paciente_id,
      data: dto.data,
      horario: dto.horario,
      data_hora_inicio: dataHoraInicio,
      data_hora_fim: dataHoraFim,
      valor: dto.valor,
      google_calendar_event_id: dto.google_calendar_event_id,
      status_consulta: StatusConsulta.AGENDADA,
      status_pagamento: StatusPagamento.PENDENTE,
    });

    // Auditoria
    await this.auditoriaRepository.save({
      tipo_evento: TipoEventoAuditoria.CONSULTA_AGENDADA,
      paciente_id: dto.paciente_id,
      consulta_id: consulta.id,
      dados_novos: {
        data: formatDate(dto.data),
        horario: dto.horario,
        valor: dto.valor,
      },
    });

    this.logger.log(`Consulta criada: ${consulta.id}`, 'ConsultasService');

    return consulta;
  }

  /**
   * Busca consulta por ID
   */
  async findById(id: string): Promise<Consulta | null> {
    return this.consultaRepository.findOne({
      where: { id },
      relations: ['paciente', 'pagamento'],
    });
  }

  /**
   * Busca consultas de um paciente
   */
  async findByPaciente(
    pacienteId: string,
    apenasAgendadas: boolean = false,
  ): Promise<Consulta[]> {
    const where: any = { paciente_id: pacienteId };

    if (apenasAgendadas) {
      where.status_consulta = StatusConsulta.AGENDADA;
      where.data_hora_inicio = MoreThanOrEqual(new Date());
    }

    return this.consultaRepository.find({
      where,
      order: { data_hora_inicio: 'ASC' },
    });
  }

  /**
   * Busca próximas consultas de um paciente
   */
  async findProximasConsultas(pacienteId: string): Promise<Consulta[]> {
    return this.consultaRepository.find({
      where: {
        paciente_id: pacienteId,
        status_consulta: StatusConsulta.AGENDADA,
        data_hora_inicio: MoreThanOrEqual(new Date()),
      },
      order: { data_hora_inicio: 'ASC' },
      take: 5,
    });
  }

  /**
   * Busca consultas por data
   */
  async findByData(data: Date): Promise<Consulta[]> {
    const inicioDia = new Date(data);
    inicioDia.setHours(0, 0, 0, 0);

    const fimDia = new Date(data);
    fimDia.setHours(23, 59, 59, 999);

    return this.consultaRepository.find({
      where: {
        data_hora_inicio: Between(inicioDia, fimDia),
        status_consulta: StatusConsulta.AGENDADA,
      },
      relations: ['paciente'],
      order: { data_hora_inicio: 'ASC' },
    });
  }

  /**
   * Marca consulta como realizada
   * REGRA: Só depois disso pode gerar cobrança
   */
  async marcarComoRealizada(consultaId: string): Promise<Consulta> {
    const consulta = await this.findById(consultaId);
    if (!consulta) {
      throw new Error('Consulta não encontrada');
    }

    if (consulta.status_consulta !== StatusConsulta.AGENDADA &&
        consulta.status_consulta !== StatusConsulta.CONFIRMADA) {
      throw new Error('Consulta não pode ser marcada como realizada');
    }

    await this.consultaRepository.update(consultaId, {
      status_consulta: StatusConsulta.REALIZADA,
    });

    // Auditoria
    await this.auditoriaRepository.save({
      tipo_evento: TipoEventoAuditoria.CONSULTA_REALIZADA,
      paciente_id: consulta.paciente_id,
      consulta_id: consultaId,
      dados_anteriores: { status: consulta.status_consulta },
      dados_novos: { status: StatusConsulta.REALIZADA },
    });

    this.logger.log(`Consulta marcada como realizada: ${consultaId}`, 'ConsultasService');

    const consultaAtualizada = await this.findById(consultaId);
    if (!consultaAtualizada) {
      throw new Error('Consulta não encontrada após atualização');
    }
    return consultaAtualizada;
  }

  /**
   * Confirma consulta (resposta do lembrete)
   */
  async confirmar(consultaId: string): Promise<Consulta> {
    const consulta = await this.findById(consultaId);
    if (!consulta) {
      throw new Error('Consulta não encontrada');
    }

    await this.consultaRepository.update(consultaId, {
      status_consulta: StatusConsulta.CONFIRMADA,
    });

    await this.auditoriaRepository.save({
      tipo_evento: TipoEventoAuditoria.CONSULTA_CONFIRMADA,
      paciente_id: consulta.paciente_id,
      consulta_id: consultaId,
    });

    const consultaAtualizada = await this.findById(consultaId);
    if (!consultaAtualizada) {
      throw new Error('Consulta não encontrada após atualização');
    }
    return consultaAtualizada;
  }

  /**
   * Cancela consulta
   */
  async cancelar(consultaId: string, motivo?: string): Promise<Consulta> {
    const consulta = await this.findById(consultaId);
    if (!consulta) {
      throw new Error('Consulta não encontrada');
    }

    if (consulta.status_consulta === StatusConsulta.REALIZADA) {
      throw new Error('Não é possível cancelar consulta já realizada');
    }

    await this.consultaRepository.update(consultaId, {
      status_consulta: StatusConsulta.CANCELADA,
      motivo_cancelamento: motivo,
    });

    await this.auditoriaRepository.save({
      tipo_evento: TipoEventoAuditoria.CONSULTA_CANCELADA,
      paciente_id: consulta.paciente_id,
      consulta_id: consultaId,
      dados_novos: { motivo },
    });

    this.logger.log(`Consulta cancelada: ${consultaId}`, 'ConsultasService');

    const consultaAtualizada = await this.findById(consultaId);
    if (!consultaAtualizada) {
      throw new Error('Consulta não encontrada após atualização');
    }
    return consultaAtualizada;
  }

  /**
   * Marca consulta para reagendamento
   */
  async marcarParaReagendar(consultaId: string): Promise<Consulta> {
    const consulta = await this.findById(consultaId);
    if (!consulta) {
      throw new Error('Consulta não encontrada');
    }

    await this.consultaRepository.update(consultaId, {
      status_consulta: StatusConsulta.REAGENDADA,
    });

    await this.auditoriaRepository.save({
      tipo_evento: TipoEventoAuditoria.CONSULTA_REAGENDADA,
      paciente_id: consulta.paciente_id,
      consulta_id: consultaId,
    });

    const consultaAtualizada = await this.findById(consultaId);
    if (!consultaAtualizada) {
      throw new Error('Consulta não encontrada após atualização');
    }
    return consultaAtualizada;
  }

  /**
   * Marca como não compareceu
   */
  async marcarNaoCompareceu(consultaId: string): Promise<Consulta> {
    const consulta = await this.findById(consultaId);
    if (!consulta) {
      throw new Error('Consulta não encontrada');
    }

    await this.consultaRepository.update(consultaId, {
      status_consulta: StatusConsulta.NAO_COMPARECEU,
    });

    await this.auditoriaRepository.save({
      tipo_evento: TipoEventoAuditoria.CONSULTA_NAO_COMPARECEU,
      paciente_id: consulta.paciente_id,
      consulta_id: consultaId,
    });

    const consultaAtualizada = await this.findById(consultaId);
    if (!consultaAtualizada) {
      throw new Error('Consulta não encontrada após atualização');
    }
    return consultaAtualizada;
  }

  /**
   * Atualiza status de pagamento
   */
  async atualizarStatusPagamento(
    consultaId: string,
    status: StatusPagamento,
  ): Promise<void> {
    await this.consultaRepository.update(consultaId, {
      status_pagamento: status,
    });
  }

  /**
   * Busca consultas que precisam de lembrete 24h
   */
  async findParaLembrete24h(): Promise<Consulta[]> {
    const agora = new Date();
    const em24h = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
    const em25h = new Date(agora.getTime() + 25 * 60 * 60 * 1000);

    return this.consultaRepository.find({
      where: {
        data_hora_inicio: Between(em24h, em25h),
        status_consulta: StatusConsulta.AGENDADA,
        lembrete_24h_enviado: false,
      },
      relations: ['paciente'],
    });
  }

  /**
   * Busca consultas que precisam de lembrete 2h
   */
  async findParaLembrete2h(): Promise<Consulta[]> {
    const agora = new Date();
    const em2h = new Date(agora.getTime() + 2 * 60 * 60 * 1000);
    const em3h = new Date(agora.getTime() + 3 * 60 * 60 * 1000);

    return this.consultaRepository.find({
      where: {
        data_hora_inicio: Between(em2h, em3h),
        status_consulta: StatusConsulta.AGENDADA,
        lembrete_2h_enviado: false,
      },
      relations: ['paciente'],
    });
  }

  /**
   * Marca lembrete como enviado
   */
  async marcarLembreteEnviado(
    consultaId: string,
    tipo: '24h' | '2h',
  ): Promise<void> {
    const update = tipo === '24h'
      ? { lembrete_24h_enviado: true }
      : { lembrete_2h_enviado: true };

    await this.consultaRepository.update(consultaId, update);
  }

  /**
   * Busca consultas realizadas pendentes de cobrança
   */
  async findRealizadasSemCobranca(): Promise<Consulta[]> {
    return this.consultaRepository.find({
      where: {
        status_consulta: StatusConsulta.REALIZADA,
        status_pagamento: StatusPagamento.PENDENTE,
      },
      relations: ['paciente', 'pagamento'],
    });
  }

  /**
   * Formata consulta para exibição no WhatsApp
   */
  formatarParaWhatsApp(consulta: Consulta, index?: number): string {
    const prefixo = index !== undefined ? `${index + 1}️⃣ ` : '';
    return `${prefixo}📅 ${formatDate(consulta.data)} às ${consulta.horario}`;
  }
}
