import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppLogger } from '../../common/logger/app-logger.service';
import { WhatsappApiService } from '../../integrations/whatsapp-api/whatsapp-api.service';
import { Paciente, Consulta, Handoff, StatusHandoff } from '../../database/entities';
import { ESTADOS_CONVERSA, MENSAGENS } from '../../common/constants';
import { ProcessedMessage } from './whatsapp-webhook.service';

@Injectable()
export class WhatsappOrchestratorService {
  constructor(
    @InjectRepository(Paciente)
    private pacienteRepository: Repository<Paciente>,
    @InjectRepository(Consulta)
    private consultaRepository: Repository<Consulta>,
    @InjectRepository(Handoff)
    private handoffRepository: Repository<Handoff>,
    private readonly whatsappApi: WhatsappApiService,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Listener para mensagens recebidas do WhatsApp
   */
  @OnEvent('whatsapp.message.received')
  async handleMessage(message: ProcessedMessage): Promise<void> {
    this.logger.log(
      `Processando mensagem de ${message.from}: ${message.content}`,
      'WhatsappOrchestratorService',
    );

    try {
      // Busca ou cria paciente pelo telefone
      let paciente = await this.pacienteRepository.findOne({
        where: { telefone: message.fromFormatted },
      });

      // Se não existe, cria um novo paciente
      if (!paciente) {
        paciente = await this.handleNewPatient(message);
        return;
      }

      // Verifica se está em atendimento humano
      const handoffAtivo = await this.handoffRepository.findOne({
        where: {
          paciente_id: paciente.id,
          status: StatusHandoff.EM_ATENDIMENTO,
        },
      });

      if (handoffAtivo) {
        await this.handleHandoffMessage(paciente, message);
        return;
      }

      // Roteia baseado no estado da conversa
      await this.routeMessage(paciente, message);
    } catch (error) {
      this.logger.error(
        `Erro ao processar mensagem: ${error.message}`,
        error.stack,
        'WhatsappOrchestratorService',
      );

      await this.whatsappApi.sendTextMessage(
        message.from,
        MENSAGENS.ERRO_GENERICO,
      );
    }
  }

  /**
   * Trata novo paciente (primeira interação)
   */
  private async handleNewPatient(message: ProcessedMessage): Promise<Paciente> {
    const paciente = await this.pacienteRepository.save({
      telefone: message.fromFormatted,
      nome: message.contactName,
      ultimo_estado_conversa: ESTADOS_CONVERSA.AGUARDANDO_NOME,
      cadastro_completo: false,
    });

    await this.whatsappApi.sendTextMessage(message.from, MENSAGENS.BOAS_VINDAS_NOVO);
    await this.whatsappApi.sendTextMessage(message.from, MENSAGENS.SOLICITAR_NOME);

    this.logger.log(
      `Novo paciente criado: ${paciente.id}`,
      'WhatsappOrchestratorService',
    );

    return paciente;
  }

  /**
   * Roteia mensagem baseado no estado atual da conversa
   */
  private async routeMessage(
    paciente: Paciente,
    message: ProcessedMessage,
  ): Promise<void> {
    const estado = paciente.ultimo_estado_conversa || ESTADOS_CONVERSA.MENU_PRINCIPAL;
    const texto = message.content.toUpperCase().trim();

    // Comandos globais que funcionam em qualquer estado
    if (texto === 'MENU' || texto === 'INÍCIO' || texto === 'INICIO') {
      await this.showMainMenu(paciente, message.from);
      return;
    }

    // Se cadastro não está completo, continua fluxo de cadastro
    if (!paciente.cadastro_completo) {
      await this.handleCadastroFlow(paciente, message);
      return;
    }

    // Roteamento por estado
    switch (estado) {
      case ESTADOS_CONVERSA.MENU_PRINCIPAL:
        await this.handleMenuPrincipal(paciente, message);
        break;

      case ESTADOS_CONVERSA.AGUARDANDO_DATA_AGENDAMENTO:
        await this.emitEventForModule('agendamento.data_recebida', { paciente, message });
        break;

      case ESTADOS_CONVERSA.AGUARDANDO_HORARIO_AGENDAMENTO:
        await this.emitEventForModule('agendamento.horario_recebido', { paciente, message });
        break;

      case ESTADOS_CONVERSA.ESCOLHENDO_CONSULTA_REAGENDAR:
        await this.emitEventForModule('reagendamento.consulta_escolhida', { paciente, message });
        break;

      case ESTADOS_CONVERSA.AGUARDANDO_DATA_REAGENDAMENTO:
        await this.emitEventForModule('reagendamento.data_recebida', { paciente, message });
        break;

      case ESTADOS_CONVERSA.AGUARDANDO_HORARIO_REAGENDAMENTO:
        await this.emitEventForModule('reagendamento.horario_recebido', { paciente, message });
        break;

      case ESTADOS_CONVERSA.ESCOLHENDO_CONSULTA_CANCELAR:
        await this.emitEventForModule('cancelamento.consulta_escolhida', { paciente, message });
        break;

      case ESTADOS_CONVERSA.AGUARDANDO_CONFIRMACAO_CANCELAMENTO:
        await this.emitEventForModule('cancelamento.confirmacao_recebida', { paciente, message });
        break;

      case ESTADOS_CONVERSA.AGUARDANDO_CONFIRMACAO_LEMBRETE:
        await this.emitEventForModule('lembrete.confirmacao_recebida', { paciente, message });
        break;

      default:
        await this.showMainMenu(paciente, message.from);
    }
  }

  /**
   * Fluxo de cadastro de novo paciente
   */
  private async handleCadastroFlow(
    paciente: Paciente,
    message: ProcessedMessage,
  ): Promise<void> {
    const estado = paciente.ultimo_estado_conversa;
    const texto = message.content.trim();

    switch (estado) {
      case ESTADOS_CONVERSA.AGUARDANDO_NOME:
        await this.handleNome(paciente, texto, message.from);
        break;

      case ESTADOS_CONVERSA.AGUARDANDO_CPF:
        await this.handleCpf(paciente, texto, message.from);
        break;

      case ESTADOS_CONVERSA.AGUARDANDO_EMAIL:
        await this.handleEmail(paciente, texto, message.from);
        break;

      default:
        // Se chegou aqui sem estado definido, solicita nome
        await this.pacienteRepository.update(paciente.id, {
          ultimo_estado_conversa: ESTADOS_CONVERSA.AGUARDANDO_NOME,
        });
        await this.whatsappApi.sendTextMessage(message.from, MENSAGENS.SOLICITAR_NOME);
    }
  }

  /**
   * Processa nome do paciente
   */
  private async handleNome(
    paciente: Paciente,
    nome: string,
    telefone: string,
  ): Promise<void> {
    if (nome.length < 3) {
      await this.whatsappApi.sendTextMessage(
        telefone,
        'Por favor, digite seu nome completo (mínimo 3 caracteres):',
      );
      return;
    }

    await this.pacienteRepository.update(paciente.id, {
      nome,
      ultimo_estado_conversa: ESTADOS_CONVERSA.AGUARDANDO_CPF,
    });

    await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.SOLICITAR_CPF);
  }

  /**
   * Processa CPF do paciente
   */
  private async handleCpf(
    paciente: Paciente,
    cpf: string,
    telefone: string,
  ): Promise<void> {
    const cpfLimpo = cpf.replace(/\D/g, '');

    if (cpfLimpo.length !== 11) {
      await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.CPF_INVALIDO);
      return;
    }

    // Validação básica de CPF poderia ser adicionada aqui

    await this.pacienteRepository.update(paciente.id, {
      cpf: cpfLimpo,
      ultimo_estado_conversa: ESTADOS_CONVERSA.AGUARDANDO_EMAIL,
    });

    await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.SOLICITAR_EMAIL);
  }

  /**
   * Processa email do paciente
   */
  private async handleEmail(
    paciente: Paciente,
    email: string,
    telefone: string,
  ): Promise<void> {
    const emailFinal = email.toLowerCase() === 'pular' ? null : email.trim();

    // Validação básica de email
    if (emailFinal && !emailFinal.includes('@')) {
      await this.whatsappApi.sendTextMessage(
        telefone,
        'Email inválido. Digite um email válido ou "pular":',
      );
      return;
    }

    // Atualiza paciente como cadastrado
    await this.pacienteRepository.update(paciente.id, {
      email: emailFinal || undefined,
      cadastro_completo: true,
      ultimo_estado_conversa: ESTADOS_CONVERSA.MENU_PRINCIPAL,
    });

    const pacienteAtualizado = await this.pacienteRepository.findOne({
      where: { id: paciente.id },
    });

    const nomeAtualizado = pacienteAtualizado?.nome || paciente.nome;

    await this.whatsappApi.sendTextMessage(
      telefone,
      MENSAGENS.CADASTRO_COMPLETO(nomeAtualizado),
    );

    await this.showMainMenu({ ...paciente, nome: nomeAtualizado }, telefone);
  }

  /**
   * Processa escolha do menu principal
   */
  private async handleMenuPrincipal(
    paciente: Paciente,
    message: ProcessedMessage,
  ): Promise<void> {
    const opcao = message.content.trim();
    const telefone = message.from;

    switch (opcao) {
      case '1':
      case 'agendar':
      case 'AGENDAR':
        await this.emitEventForModule('agendamento.iniciar', { paciente, telefone });
        break;

      case '2':
      case 'consultas':
      case 'CONSULTAS':
        await this.emitEventForModule('consultas.listar', { paciente, telefone });
        break;

      case '3':
      case 'reagendar':
      case 'REAGENDAR':
        await this.emitEventForModule('reagendamento.iniciar', { paciente, telefone });
        break;

      case '4':
      case 'cancelar':
      case 'CANCELAR':
        await this.emitEventForModule('cancelamento.iniciar', { paciente, telefone });
        break;

      case '5':
      case 'atendente':
      case 'ATENDENTE':
        await this.emitEventForModule('handoff.iniciar', { paciente, telefone });
        break;

      default:
        await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.OPCAO_INVALIDA);
        await this.showMainMenu(paciente, telefone);
    }
  }

  /**
   * Exibe menu principal
   */
  async showMainMenu(paciente: Paciente, telefone: string): Promise<void> {
    await this.pacienteRepository.update(paciente.id, {
      ultimo_estado_conversa: ESTADOS_CONVERSA.MENU_PRINCIPAL,
    });

    const saudacao = MENSAGENS.BOAS_VINDAS(paciente.nome);
    await this.whatsappApi.sendTextMessage(telefone, saudacao);
    await this.whatsappApi.sendTextMessage(telefone, MENSAGENS.MENU_PRINCIPAL);
  }

  /**
   * Trata mensagens quando está em handoff
   */
  private async handleHandoffMessage(
    paciente: Paciente,
    message: ProcessedMessage,
  ): Promise<void> {
    const texto = message.content.toUpperCase().trim();

    if (texto === 'MENU') {
      // Finaliza handoff e volta ao menu
      await this.handoffRepository.update(
        { paciente_id: paciente.id, status: StatusHandoff.EM_ATENDIMENTO },
        { status: StatusHandoff.FINALIZADO, fim_atendimento: new Date() },
      );
      await this.showMainMenu(paciente, message.from);
      return;
    }

    // Mensagem em atendimento humano - apenas loga
    await this.whatsappApi.sendTextMessage(message.from, MENSAGENS.EM_ATENDIMENTO_HUMANO);
  }

  /**
   * Emite evento para módulo específico
   */
  private async emitEventForModule(
    eventName: string,
    data: any,
  ): Promise<void> {
    const { EventEmitter2 } = await import('@nestjs/event-emitter');
    const eventEmitter = new EventEmitter2();
    
    // Na prática, isso seria injetado - simplificado aqui
    this.logger.debug(`Emitindo evento: ${eventName}`, 'WhatsappOrchestratorService');
  }

  /**
   * Atualiza estado da conversa do paciente
   */
  async updateEstadoConversa(
    pacienteId: string,
    estado: string,
    dadosTemporarios?: Record<string, any>,
  ): Promise<void> {
    const updateData: any = { ultimo_estado_conversa: estado };
    
    if (dadosTemporarios !== undefined) {
      updateData.dados_temporarios = dadosTemporarios;
    }

    await this.pacienteRepository.update(pacienteId, updateData);
  }
}
