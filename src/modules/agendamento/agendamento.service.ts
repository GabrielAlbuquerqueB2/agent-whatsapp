import { Injectable } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '../../common/logger/app-logger.service';
import { WhatsappApiService } from '../../integrations/whatsapp-api/whatsapp-api.service';
import { GoogleCalendarService, TimeSlot } from '../../integrations/google-calendar/google-calendar.service';
import { ConsultasService } from '../consultas/consultas.service';
import { Paciente, Consulta } from '../../database/entities';
import { ESTADOS_CONVERSA, MENSAGENS } from '../../common/constants';
import { formatDate, formatCurrency } from '../../common/utils/helpers';

interface AgendamentoContext {
  paciente: Paciente;
  telefone: string;
  message?: any;
}

@Injectable()
export class AgendamentoService {
  private readonly horarioInicio: string;
  private readonly horarioFim: string;
  private readonly diasUteis: number[];
  private readonly duracaoConsulta: number;
  private readonly valorConsulta: number;
  private readonly nomePsicologa: string;

  constructor(
    @InjectRepository(Paciente)
    private pacienteRepository: Repository<Paciente>,
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
    this.valorConsulta = this.configService.get('app.clinic.consultationValue') || 200;
    this.nomePsicologa = this.configService.get('app.clinic.psychologistName') || 'Psicóloga';
  }

  /**
   * Inicia fluxo de agendamento
   */
  @OnEvent('agendamento.iniciar')
  async iniciarAgendamento(ctx: AgendamentoContext): Promise<void> {
    const { paciente, telefone } = ctx;

    this.logger.log(
      `Iniciando agendamento para paciente: ${paciente.id}`,
      'AgendamentoService',
    );

    // Atualiza estado
    await this.pacienteRepository.update(paciente.id, {
      ultimo_estado_conversa: ESTADOS_CONVERSA.AGUARDANDO_DATA_AGENDAMENTO,
      dados_temporarios: {},
    });

    await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.ESCOLHER_DATA);
  }

  /**
   * Processa data recebida
   */
  @OnEvent('agendamento.data_recebida')
  async processarData(ctx: AgendamentoContext): Promise<void> {
    const { paciente, message } = ctx;
    const telefone = message.from;
    const textoData = message.content.trim();

    // Parse da data (DD/MM/AAAA)
    const dataMatch = textoData.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!dataMatch) {
      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.DATA_INVALIDA);
      return;
    }

    const [, dia, mes, ano] = dataMatch;
    const data = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));

    // Valida data
    if (isNaN(data.getTime())) {
      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.DATA_INVALIDA);
      return;
    }

    // Verifica se é data passada
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (data < hoje) {
      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.DATA_PASSADA);
      return;
    }

    // Verifica se é dia útil
    if (!this.diasUteis.includes(data.getDay())) {
      await this.whatsappApi.sendTextMessage(
        telefone,
        '❌ Este dia não está disponível para agendamento. Por favor, escolha outro dia:',
      );
      return;
    }

    // Busca horários disponíveis no Google Calendar
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

      // Formata horários para exibição
      const horarios = slotsDisponiveis.map((slot) => {
        const hora = slot.start.getHours().toString().padStart(2, '0');
        const minuto = slot.start.getMinutes().toString().padStart(2, '0');
        return `${hora}:${minuto}`;
      });

      // Salva dados temporários
      await this.pacienteRepository.update(paciente.id, {
        ultimo_estado_conversa: ESTADOS_CONVERSA.AGUARDANDO_HORARIO_AGENDAMENTO,
        dados_temporarios: {
          data_agendamento: data.toISOString(),
          horarios_disponiveis: horarios,
        } as any,
      });

      // Envia horários
      const mensagem = MENSAGENS.HORARIOS_DISPONIVEIS(formatDate(data), horarios);
      await this.whatsappApi.sendTextMessage(telefone, mensagem);

    } catch (error) {
      this.logger.error(
        `Erro ao buscar horários: ${error.message}`,
        error.stack,
        'AgendamentoService',
      );
      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.ERRO_GENERICO);
    }
  }

  /**
   * Processa horário escolhido
   */
  @OnEvent('agendamento.horario_recebido')
  async processarHorario(ctx: AgendamentoContext): Promise<void> {
    const { paciente, message } = ctx;
    const telefone = message.from;
    const escolha = message.content.trim();

    // Busca paciente atualizado com dados temporários
    const pacienteAtual = await this.pacienteRepository.findOne({
      where: { id: paciente.id },
    });

    if (!pacienteAtual) {
      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.ERRO_GENERICO);
      return;
    }

    const dadosTemp = pacienteAtual.dados_temporarios;
    if (!dadosTemp?.horarios_disponiveis || !dadosTemp?.data_agendamento) {
      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.ERRO_GENERICO);
      await this.eventEmitter.emit('agendamento.iniciar', { paciente, telefone });
      return;
    }

    const horarios = dadosTemp.horarios_disponiveis as string[];
    
    // Verifica se a escolha é válida (número ou horário direto)
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

    // Cria a consulta
    try {
      const data = new Date(dadosTemp.data_agendamento);
      const [hora, minuto] = horarioEscolhido.split(':').map(Number);
      
      const dataHoraInicio = new Date(data);
      dataHoraInicio.setHours(hora, minuto, 0, 0);

      const dataHoraFim = new Date(dataHoraInicio);
      dataHoraFim.setMinutes(dataHoraFim.getMinutes() + this.duracaoConsulta);

      // Verifica disponibilidade mais uma vez (pode ter sido ocupado)
      const disponivel = await this.googleCalendar.isSlotAvailable(
        dataHoraInicio,
        dataHoraFim,
      );

      if (!disponivel) {
        await this.whatsappApi.sendTextMessage(
          telefone,
          '❌ Este horário acabou de ser ocupado. Por favor, escolha outro horário:',
        );
        return;
      }

      // Cria evento no Google Calendar
      const eventCalendar = await this.googleCalendar.createEvent({
        summary: `Consulta - ${paciente.nome}`,
        description: `Paciente: ${paciente.nome}\nTelefone: ${paciente.telefone}`,
        startDateTime: dataHoraInicio,
        endDateTime: dataHoraFim,
        attendeeEmail: paciente.email,
        attendeeName: paciente.nome,
      });

      // Determina valor (usa valor do paciente se definido, senão padrão)
      const valor = paciente.valor || this.valorConsulta;

      // Cria consulta no banco
      const consulta = await this.consultasService.criar({
        paciente_id: paciente.id,
        data,
        horario: horarioEscolhido,
        valor,
        google_calendar_event_id: eventCalendar.id || undefined,
      });

      // Limpa estado e dados temporários
      await this.pacienteRepository.update(paciente.id, {
        ultimo_estado_conversa: ESTADOS_CONVERSA.MENU_PRINCIPAL,
        dados_temporarios: {} as any,
      });

      // Envia confirmação
      const mensagemConfirmacao = MENSAGENS.AGENDAMENTO_CONFIRMADO(
        formatDate(data),
        horarioEscolhido,
        formatCurrency(valor),
      );
      await this.whatsappApi.sendTextMessage(telefone, mensagemConfirmacao);

      this.logger.log(
        `Consulta agendada: ${consulta.id} para ${paciente.id}`,
        'AgendamentoService',
      );

    } catch (error) {
      this.logger.error(
        `Erro ao criar consulta: ${error.message}`,
        error.stack,
        'AgendamentoService',
      );
      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.ERRO_GENERICO);
    }
  }

  /**
   * Lista consultas do paciente
   */
  @OnEvent('consultas.listar')
  async listarConsultas(ctx: AgendamentoContext): Promise<void> {
    const { paciente, telefone } = ctx;

    const consultas = await this.consultasService.findProximasConsultas(paciente.id);

    if (consultas.length === 0) {
      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.SEM_CONSULTAS);
      return;
    }

    const listaFormatada = consultas
      .map((c, i) => this.consultasService.formatarParaWhatsApp(c, i))
      .join('\n');

    await this.whatsappApi.sendTextMessage(
      telefone,
      MENSAGENS.CONSULTAS_AGENDADAS(listaFormatada),
    );
  }
}
