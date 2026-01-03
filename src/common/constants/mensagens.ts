export const MENSAGENS = {
  // Boas-vindas e Menu
  BOAS_VINDAS: (nome: string) => 
    `Olá, ${nome}! 👋\n\nBem-vindo(a) ao consultório de psicologia.\n\nComo posso ajudar você hoje?`,
  
  BOAS_VINDAS_NOVO: 
    `Olá! 👋\n\nBem-vindo(a) ao consultório de psicologia.\n\nParece que é sua primeira vez aqui. Vamos fazer seu cadastro rápido para melhor atendê-lo(a).`,

  MENU_PRINCIPAL: 
    `📋 *Menu Principal*\n\nEscolha uma opção:\n\n1️⃣ Agendar consulta\n2️⃣ Minhas consultas\n3️⃣ Reagendar consulta\n4️⃣ Cancelar consulta\n5️⃣ Falar com atendente`,

  // Cadastro
  SOLICITAR_NOME: `Por favor, digite seu *nome completo*:`,
  
  SOLICITAR_CPF: `Agora, digite seu *CPF* (apenas números):`,
  
  SOLICITAR_EMAIL: `Digite seu *e-mail* (opcional - digite "pular" para continuar sem e-mail):`,
  
  CADASTRO_COMPLETO: (nome: string) => 
    `✅ Cadastro realizado com sucesso, ${nome}!\n\nAgora você pode agendar suas consultas.`,

  CPF_INVALIDO: `❌ CPF inválido. Por favor, digite um CPF válido (apenas números):`,

  // Agendamento
  ESCOLHER_DATA: 
    `📅 *Agendamento de Consulta*\n\nPor favor, digite a data desejada no formato:\n*DD/MM/AAAA*\n\nExemplo: 15/01/2026`,

  DATA_INVALIDA: 
    `❌ Data inválida. Por favor, digite uma data válida no formato DD/MM/AAAA`,

  DATA_PASSADA: 
    `❌ Não é possível agendar para datas passadas. Por favor, escolha uma data futura.`,

  DATA_SEM_HORARIOS: 
    `😔 Infelizmente não há horários disponíveis para esta data.\n\nPor favor, escolha outra data:`,

  HORARIOS_DISPONIVEIS: (data: string, horarios: string[]) => 
    `📅 *Horários disponíveis para ${data}:*\n\n${horarios.map((h, i) => `${i + 1}️⃣ ${h}`).join('\n')}\n\nDigite o *número* do horário desejado:`,

  AGENDAMENTO_CONFIRMADO: (data: string, horario: string, valor: string) => 
    `✅ *Consulta agendada com sucesso!*\n\n📅 Data: ${data}\n⏰ Horário: ${horario}\n💰 Valor: ${valor}\n\nVocê receberá um lembrete 24h e 2h antes da consulta.\n\nAté logo! 👋`,

  // Minhas Consultas
  CONSULTAS_AGENDADAS: (consultas: string) => 
    `📋 *Suas consultas agendadas:*\n\n${consultas}`,

  SEM_CONSULTAS: 
    `Você não possui consultas agendadas no momento.\n\nDeseja agendar uma nova consulta?`,

  // Reagendamento
  ESCOLHER_CONSULTA_REAGENDAR: (consultas: string) => 
    `📋 *Qual consulta deseja reagendar?*\n\n${consultas}\n\nDigite o número da consulta:`,

  NOVA_DATA_REAGENDAMENTO: 
    `📅 Digite a *nova data* desejada (DD/MM/AAAA):`,

  REAGENDAMENTO_CONFIRMADO: (dataAntiga: string, dataNova: string, horario: string) => 
    `✅ *Consulta reagendada com sucesso!*\n\n❌ Antiga: ${dataAntiga}\n✅ Nova: ${dataNova} às ${horario}\n\nAté logo! 👋`,

  // Cancelamento
  ESCOLHER_CONSULTA_CANCELAR: (consultas: string) => 
    `📋 *Qual consulta deseja cancelar?*\n\n${consultas}\n\nDigite o número da consulta:`,

  CONFIRMAR_CANCELAMENTO: (data: string, horario: string) => 
    `⚠️ *Confirma o cancelamento da consulta?*\n\n📅 Data: ${data}\n⏰ Horário: ${horario}\n\nDigite *SIM* para confirmar ou *NÃO* para voltar:`,

  CANCELAMENTO_CONFIRMADO: 
    `✅ Consulta cancelada com sucesso.\n\nEsperamos vê-lo(a) em breve! 👋`,

  CANCELAMENTO_CANCELADO: 
    `OK, o cancelamento foi desfeito. Sua consulta continua agendada.`,

  // Lembretes
  LEMBRETE_24H: (data: string, horario: string) => 
    `⏰ *Lembrete de Consulta*\n\nOlá! Sua consulta está agendada para *amanhã*.\n\n📅 Data: ${data}\n⏰ Horário: ${horario}\n\nConfirme sua presença respondendo *OK*.\n\nCaso precise reagendar, responda *REAGENDAR*.`,

  LEMBRETE_2H: (horario: string) => 
    `⏰ *Lembrete - Consulta em 2 horas*\n\nSua consulta será às *${horario}*.\n\nTe aguardamos! 🙂`,

  // Handoff
  TRANSFERINDO_ATENDENTE: 
    `🔄 Aguarde, estou transferindo você para um de nossos atendentes...\n\nEm breve alguém entrará em contato.`,

  EM_ATENDIMENTO_HUMANO: 
    `👤 Você está em atendimento com nossa equipe.\n\nPara voltar ao menu automático, digite *MENU*.`,

  // Pagamento
  COBRANCA_GERADA: (valor: string, link: string) => 
    `💳 *Cobrança Gerada*\n\nValor: ${valor}\n\n🔗 Link para pagamento:\n${link}\n\nO pagamento pode ser realizado via PIX, boleto ou cartão de crédito.`,

  PAGAMENTO_CONFIRMADO: (valor: string) => 
    `✅ *Pagamento Confirmado!*\n\nRecebemos seu pagamento de ${valor}.\n\nObrigado! 🙏`,

  // Erros
  ERRO_GENERICO: 
    `😔 Desculpe, ocorreu um erro. Por favor, tente novamente ou digite *MENU* para voltar ao início.`,

  OPCAO_INVALIDA: 
    `❌ Opção inválida. Por favor, escolha uma das opções disponíveis.`,

  HORARIO_INVALIDO: 
    `❌ Horário inválido. Por favor, escolha um dos horários listados.`,
} as const;
