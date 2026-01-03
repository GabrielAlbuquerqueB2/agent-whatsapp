import { Injectable } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '../../common/logger/app-logger.service';
import { WhatsappApiService } from '../../integrations/whatsapp-api/whatsapp-api.service';
import { GoogleCalendarService } from '../../integrations/google-calendar/google-calendar.service';
import { ConsultasService } from '../consultas/consultas.service';
import { Paciente, Consulta, StatusConsulta } from '../../database/entities';
import { ESTADOS_CONVERSA, MENSAGENS } from '../../common/constants';
import { formatDate, formatCurrency } from '../../common/utils/helpers';

interface ReagendamentoContext {
  paciente: Paciente;
  telefone: string;
  message?: any;
}

@Injectable()
export class ReagendamentoService {
  private readonly horarioInicio: string;
  private readonly horarioFim: string;
  private readonly diasUteis: number[];
  private readonly duracaoConsulta: number;

  constructor(
    @InjectRepository(Paciente)
    private pacienteRepository: Repository<Paciente>,
    @InjectRepository(Consulta)
    private consultaRepository: Repository<Consulta>,
    private readonly whatsappApi: WhatsappApiService,
    private readonly googleCalendar: GoogleCalendarService,
    private readonly consultasService: ConsultasService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: AppLogger,
  ) {
    this.horarioInicio = this.configService.get('app.businessHours.start') || '08:00';
    this.horarioFim = this.configService.get('app.businessHours.end') || '18:00';
    this.diasUteis = this.configService.get('app.businessHours.days') || [1, 2, 3, 4, 5];
    this.duracaoConsulta = this.configService.get('app.clinic.consultationDuration') || 50;
  }

  /**
   * Inicia fluxo de reagendamento
   */
  @OnEvent('reagendamento.iniciar')
  async iniciarReagendamento(ctx: ReagendamentoContext): Promise<void> {
    const { paciente, telefone } = ctx;

    const consultas = await this.consultasService.findProximasConsultas(paciente.id);

    if (consultas.length === 0) {
      await this.whatsappApi.sendTextMessage(
        telefone,
        'Você não possui consultas agendadas para reagendar.',
      );
      return;
    }

    // Salva consultas disponíveis para reagendamento
    await this.pacienteRepository.update(paciente.id, {
      ultimo_estado_conversa: ESTADOS_CONVERSA.ESCOLHENDO_CONSULTA_REAGENDAR,
      dados_temporarios: {
        consultas_reagendamento: consultas.map(c => ({
          id: c.id,
          data: c.data,
          horario: c.horario,
        })),
      },
    });

    const listaFormatada = consultas
      .map((c, i) => this.consultasService.formatarParaWhatsApp(c, i))
      .join('\n');

    await this.whatsappApi.sendTextMessage(
      telefone,
      MENSAGENS.ESCOLHER_CONSULTA_REAGENDAR(listaFormatada),
    );
  }

  /**
   * Processa escolha de consulta para reagendar
   */
  @OnEvent('reagendamento.consulta_escolhida')
  async processarEscolhaConsulta(ctx: ReagendamentoContext): Promise<void> {
    const { paciente, message } = ctx;
    const telefone = message.from;
    const escolha = message.content.trim();

    const pacienteAtual = await this.pacienteRepository.findOne({
      where: { id: paciente.id },
    });

    if (!pacienteAtual) {
      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.ERRO_GENERICO);
      return;
    }

    const consultas = pacienteAtual.dados_temporarios?.consultas_reagendamento;
    if (!consultas || consultas.length === 0) {
      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.ERRO_GENERICO);
      return;
    }

    const indice = parseInt(escolha) - 1;
    if (isNaN(indice) || indice < 0 || indice >= consultas.length) {
      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.OPCAO_INVALIDA);
      return;
    }

    const consultaEscolhida = consultas[indice];

    // Atualiza estado
    await this.pacienteRepository.update(paciente.id, {
      ultimo_estado_conversa: ESTADOS_CONVERSA.AGUARDANDO_DATA_REAGENDAMENTO,
      dados_temporarios: {
        ...(pacienteAtual.dados_temporarios || {}),
        consulta_reagendar_id: consultaEscolhida.id,
        consulta_reagendar_data_original: consultaEscolhida.data,
        consulta_reagendar_horario_original: consultaEscolhida.horario,
      } as any,
    });

    await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.NOVA_DATA_REAGENDAMENTO);
  }

  /**
   * Processa nova data para reagendamento
   */
  @OnEvent('reagendamento.data_recebida')
  async processarNovaData(ctx: ReagendamentoContext): Promise<void> {
    const { paciente, message } = ctx;
    const telefone = message.from;
    const textoData = message.content.trim();

    const dataMatch = textoData.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!dataMatch) {
      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.DATA_INVALIDA);
      return;
    }

    const [, dia, mes, ano] = dataMatch;
    const data = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));

    if (isNaN(data.getTime())) {
      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.DATA_INVALIDA);
      return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (data < hoje) {
      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.DATA_PASSADA);
      return;
    }

    if (!this.diasUteis.includes(data.getDay())) {
      await this.whatsappApi.sendTextMessage(
        telefone,
        '❌ Este dia não está disponível. Por favor, escolha outro dia:',
      );
      return;
    }

    try {
      const slotsDisponiveis = await this.googleCalendar.getAvailableSlots(
        data,
        this.horarioInicio,
        this.horarioFim,
        this.duracaoConsulta,
      );

      if (slotsDisponiveis.length === 0) {
        await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.DATA_SEM_HORARIOS);
        return;
      }

      const horarios = slotsDisponiveis.map((slot) => {
        const hora = slot.start.getHours().toString().padStart(2, '0');
        const minuto = slot.start.getMinutes().toString().padStart(2, '0');
        return `${hora}:${minuto}`;
      });

      const pacienteAtual = await this.pacienteRepository.findOne({
        where: { id: paciente.id },
      });

      if (!pacienteAtual) {
        await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.ERRO_GENERICO);
        return;
      }

      await this.pacienteRepository.update(paciente.id, {
        ultimo_estado_conversa: ESTADOS_CONVERSA.AGUARDANDO_HORARIO_REAGENDAMENTO,
        dados_temporarios: {
          ...(pacienteAtual.dados_temporarios || {}),
          nova_data: data.toISOString(),
          horarios_disponiveis: horarios,
        } as any,
      });

      const mensagem = MENSAGENS.HORARIOS_DISPONIVEIS(formatDate(data), horarios);
      await this.whatsappApi.sendTextMessage(telefone, mensagem);

    } catch (error) {
      this.logger.error(
        `Erro ao buscar horários para reagendamento: ${error.message}`,
        error.stack,
        'ReagendamentoService',
      );
      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.ERRO_GENERICO);
    }
  }

  /**
   * Processa novo horário e conclui reagendamento
   */
  @OnEvent('reagendamento.horario_recebido')
  async processarNovoHorario(ctx: ReagendamentoContext): Promise<void> {
    const { paciente, message } = ctx;
    const telefone = message.from;
    const escolha = message.content.trim();

    const pacienteAtual = await this.pacienteRepository.findOne({
      where: { id: paciente.id },
    });

    if (!pacienteAtual) {
      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.ERRO_GENERICO);
      return;
    }

    const dadosTemp = pacienteAtual.dados_temporarios;
    if (!dadosTemp?.horarios_disponiveis || !dadosTemp?.nova_data || !dadosTemp?.consulta_reagendar_id) {
      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.ERRO_GENERICO);
      return;
    }

    const horarios = dadosTemp.horarios_disponiveis as string[];
    let horarioEscolhido: string;

    const indice = parseInt(escolha) - 1;
    if (!isNaN(indice) && indice >= 0 && indice < horarios.length) {
      horarioEscolhido = horarios[indice];
    } else if (horarios.includes(escolha)) {
      horarioEscolhido = escolha;
    } else {
      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.HORARIO_INVALIDO);
      return;
    }

    try {
      const consultaAntiga = await this.consultasService.findById(dadosTemp.consulta_reagendar_id);
      if (!consultaAntiga) {
        throw new Error('Consulta não encontrada');
      }

      // Cancela evento antigo no Google Calendar
      if (consultaAntiga.google_calendar_event_id) {
        await this.googleCalendar.deleteEvent(consultaAntiga.google_calendar_event_id);
      }

      // Marca consulta antiga como reagendada
      await this.consultasService.marcarParaReagendar(consultaAntiga.id);

      // Cria nova consulta
      const novaData = new Date(dadosTemp.nova_data);
      const [hora, minuto] = horarioEscolhido.split(':').map(Number);

      const dataHoraInicio = new Date(novaData);
      dataHoraInicio.setHours(hora, minuto, 0, 0);

      const dataHoraFim = new Date(dataHoraInicio);
      dataHoraFim.setMinutes(dataHoraFim.getMinutes() + this.duracaoConsulta);

      // Cria novo evento no Google Calendar
      const eventCalendar = await this.googleCalendar.createEvent({
        summary: `Consulta - ${paciente.nome}`,
        description: `Paciente: ${paciente.nome}\nTelefone: ${paciente.telefone}\n(Reagendamento)`,
        startDateTime: dataHoraInicio,
        endDateTime: dataHoraFim,
        attendeeEmail: paciente.email,
        attendeeName: paciente.nome,
      });

      // Cria nova consulta
      await this.consultasService.criar({
        paciente_id: paciente.id,
        data: novaData,
        horario: horarioEscolhido,
        valor: consultaAntiga.valor,
        google_calendar_event_id: eventCalendar.id || undefined,
      });

      // Limpa estado
      await this.pacienteRepository.update(paciente.id, {
        ultimo_estado_conversa: ESTADOS_CONVERSA.MENU_PRINCIPAL,
        dados_temporarios: {} as any,
      });

      // Envia confirmação
      const dataAntigaFormatada = `${formatDate(new Date(dadosTemp.consulta_reagendar_data_original))} às ${dadosTemp.consulta_reagendar_horario_original}`;
      
      await this.whatsappApi.sendTextMessage(
        telefone,
        MENSAGENS.REAGENDAMENTO_CONFIRMADO(
          dataAntigaFormatada,
          formatDate(novaData),
          horarioEscolhido,
        ),
      );

      this.logger.log(
        `Consulta reagendada para paciente ${paciente.id}`,
        'ReagendamentoService',
      );

    } catch (error) {
      this.logger.error(
        `Erro ao reagendar consulta: ${error.message}`,
        error.stack,
        'ReagendamentoService',
      );
      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.ERRO_GENERICO);
    }
  }
}
