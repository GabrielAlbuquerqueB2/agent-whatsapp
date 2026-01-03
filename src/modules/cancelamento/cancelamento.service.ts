import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppLogger } from '../../common/logger/app-logger.service';
import { WhatsappApiService } from '../../integrations/whatsapp-api/whatsapp-api.service';
import { GoogleCalendarService } from '../../integrations/google-calendar/google-calendar.service';
import { ConsultasService } from '../consultas/consultas.service';
import { Paciente, Consulta } from '../../database/entities';
import { ESTADOS_CONVERSA, MENSAGENS } from '../../common/constants';
import { formatDate } from '../../common/utils/helpers';

interface CancelamentoContext {
  paciente: Paciente;
  telefone: string;
  message?: any;
}

@Injectable()
export class CancelamentoService {
  constructor(
    @InjectRepository(Paciente)
    private pacienteRepository: Repository<Paciente>,
    private readonly whatsappApi: WhatsappApiService,
    private readonly googleCalendar: GoogleCalendarService,
    private readonly consultasService: ConsultasService,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Inicia fluxo de cancelamento
   */
  @OnEvent('cancelamento.iniciar')
  async iniciarCancelamento(ctx: CancelamentoContext): Promise<void> {
    const { paciente, telefone } = ctx;

    const consultas = await this.consultasService.findProximasConsultas(paciente.id);

    if (consultas.length === 0) {
      await this.whatsappApi.sendTextMessage(
        telefone,
        'Você não possui consultas agendadas para cancelar.',
      );
      return;
    }

    // Salva consultas disponíveis para cancelamento
    await this.pacienteRepository.update(paciente.id, {
      ultimo_estado_conversa: ESTADOS_CONVERSA.ESCOLHENDO_CONSULTA_CANCELAR,
      dados_temporarios: {
        consultas_cancelamento: consultas.map(c => ({
          id: c.id,
          data: c.data,
          horario: c.horario,
          google_event_id: c.google_calendar_event_id,
        })),
      },
    });

    const listaFormatada = consultas
      .map((c, i) => this.consultasService.formatarParaWhatsApp(c, i))
      .join('\n');

    await this.whatsappApi.sendTextMessage(
      telefone,
      MENSAGENS.ESCOLHER_CONSULTA_CANCELAR(listaFormatada),
    );
  }

  /**
   * Processa escolha de consulta para cancelar
   */
  @OnEvent('cancelamento.consulta_escolhida')
  async processarEscolhaConsulta(ctx: CancelamentoContext): Promise<void> {
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

    const consultas = pacienteAtual.dados_temporarios?.consultas_cancelamento;
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

    // Atualiza estado para aguardar confirmação
    await this.pacienteRepository.update(paciente.id, {
      ultimo_estado_conversa: ESTADOS_CONVERSA.AGUARDANDO_CONFIRMACAO_CANCELAMENTO,
      dados_temporarios: {
        ...(pacienteAtual.dados_temporarios || {}),
        consulta_cancelar_id: consultaEscolhida.id,
        consulta_cancelar_data: consultaEscolhida.data,
        consulta_cancelar_horario: consultaEscolhida.horario,
        consulta_cancelar_google_event_id: consultaEscolhida.google_event_id,
      } as any,
    });

    await this.whatsappApi.sendTextMessage(
      telefone,
      MENSAGENS.CONFIRMAR_CANCELAMENTO(
        formatDate(new Date(consultaEscolhida.data)),
        consultaEscolhida.horario,
      ),
    );
  }

  /**
   * Processa confirmação de cancelamento
   */
  @OnEvent('cancelamento.confirmacao_recebida')
  async processarConfirmacao(ctx: CancelamentoContext): Promise<void> {
    const { paciente, message } = ctx;
    const telefone = message.from;
    const resposta = message.content.toUpperCase().trim();

    const pacienteAtual = await this.pacienteRepository.findOne({
      where: { id: paciente.id },
    });

    if (!pacienteAtual) {
      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.ERRO_GENERICO);
      return;
    }

    const dadosTemp = pacienteAtual.dados_temporarios;

    if (!dadosTemp) {
      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.ERRO_GENERICO);
      return;
    }

    if (resposta === 'SIM' || resposta === 'S') {
      try {
        const consultaId = dadosTemp.consulta_cancelar_id;
        const googleEventId = dadosTemp.consulta_cancelar_google_event_id;

        // Cancela evento no Google Calendar
        if (googleEventId) {
          try {
            await this.googleCalendar.deleteEvent(googleEventId);
          } catch (error) {
            this.logger.warn(
              `Erro ao deletar evento do Calendar: ${error.message}`,
              'CancelamentoService',
            );
          }
        }

        // Cancela consulta no banco
        await this.consultasService.cancelar(consultaId, 'Cancelado pelo paciente via WhatsApp');

        // Limpa estado
        await this.pacienteRepository.update(paciente.id, {
          ultimo_estado_conversa: ESTADOS_CONVERSA.MENU_PRINCIPAL,
          dados_temporarios: {} as any,
        });

        await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.CANCELAMENTO_CONFIRMADO);

        this.logger.log(
          `Consulta ${consultaId} cancelada pelo paciente ${paciente.id}`,
          'CancelamentoService',
        );

      } catch (error) {
        this.logger.error(
          `Erro ao cancelar consulta: ${error.message}`,
          error.stack,
          'CancelamentoService',
        );
        await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.ERRO_GENERICO);
      }

    } else if (resposta === 'NAO' || resposta === 'NÃO' || resposta === 'N') {
      // Cancela o cancelamento
      await this.pacienteRepository.update(paciente.id, {
        ultimo_estado_conversa: ESTADOS_CONVERSA.MENU_PRINCIPAL,
        dados_temporarios: {} as any,
      });

      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.CANCELAMENTO_CANCELADO);

    } else {
      await this.whatsappApi.sendTextMessage(
        telefone,
        'Por favor, responda *SIM* para confirmar o cancelamento ou *NÃO* para desistir:',
      );
    }
  }
}
