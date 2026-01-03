# 🧠 PSI AGENDA - Sistema de Automação de Consultas Psicológicas

Sistema completo de automação para consultórios de psicologia, integrando **WhatsApp Business API**, **Google Calendar** e **Asaas** para gestão de agendamentos, lembretes e cobranças.

---

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Módulos](#módulos)
- [Endpoints da API](#endpoints-da-api)
- [Fluxos de Conversa](#fluxos-de-conversa)
- [Integrações](#integrações)
- [Segurança e LGPD](#segurança-e-lgpd)
- [Monitoramento](#monitoramento)

---

## 🎯 Visão Geral

O PSI AGENDA automatiza todo o ciclo de vida de consultas psicológicas:

1. **Cadastro de Pacientes** via WhatsApp
2. **Agendamento** com verificação de disponibilidade no Google Calendar
3. **Lembretes Automáticos** (24h e 2h antes da consulta)
4. **Reagendamento e Cancelamento** pelo WhatsApp
5. **Cobrança Pós-Consulta** via Asaas (PIX, Boleto ou Cartão)
6. **Handoff** para atendimento humano quando necessário
7. **Relatórios e Dashboard** para gestão

### Regras de Negócio Críticas

| Regra | Descrição |
|-------|-----------|
| 🔑 **Telefone como ID** | Telefone é o identificador único do paciente |
| 💰 **Cobrança Pós-Consulta** | Cobranças são geradas SOMENTE após status REALIZADA |
| 🚫 **Sem Duplicação Asaas** | Verifica existência de cliente por CPF/CNPJ antes de criar |
| 🔒 **Webhooks Idempotentes** | Webhooks nunca criam dados novos, apenas atualizam |
| 🛡️ **LGPD Compliance** | Nenhum dado clínico é armazenado no sistema |

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTE (WhatsApp)                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WHATSAPP BUSINESS API                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NEST.JS APPLICATION                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │
│  │  WhatsApp   │ │  Pacientes  │ │  Consultas  │ │ Cobrança  │  │
│  │   Webhook   │ │   Module    │ │   Module    │ │  Module   │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │
│  │ Agendamento │ │ Reagendamento│ │Cancelamento │ │  Handoff  │  │
│  │   Module    │ │   Module    │ │   Module    │ │  Module   │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │  Lembretes  │ │   Asaas     │ │  Relatórios │                │
│  │   (Cron)    │ │   Webhook   │ │   Module    │                │
│  └─────────────┘ └─────────────┘ └─────────────┘                │
└─────────────────────────────────────────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Google        │  │     Asaas       │  │   PostgreSQL    │
│   Calendar      │  │   (Pagamentos)  │  │   (Database)    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## 📦 Requisitos

- **Node.js** >= 18.x
- **PostgreSQL** >= 14.x
- **WhatsApp Business API** (conta verificada)
- **Google Cloud** (Calendar API habilitada)
- **Asaas** (conta ativa com API habilitada)

---

## 🚀 Instalação

```bash
# Clone o repositório
git clone <repository-url>
cd agent-whatsapp

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas credenciais

# Execute as migrations do banco
npm run migration:run

# Inicie em modo desenvolvimento
npm run start:dev

# Ou em modo produção
npm run build
npm run start:prod
```

---

## ⚙️ Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# ===========================================
# CONFIGURAÇÃO DO SERVIDOR
# ===========================================
NODE_ENV=development
PORT=3000

# ===========================================
# BANCO DE DADOS - PostgreSQL
# ===========================================
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=sua_senha_segura
DB_DATABASE=psi_agenda

# ===========================================
# WHATSAPP BUSINESS API
# ===========================================
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=seu_phone_number_id
WHATSAPP_ACCESS_TOKEN=seu_access_token
WHATSAPP_VERIFY_TOKEN=seu_verify_token
WHATSAPP_BUSINESS_ACCOUNT_ID=seu_business_account_id

# ===========================================
# GOOGLE CALENDAR API
# ===========================================
GOOGLE_CLIENT_EMAIL=seu_service_account@projeto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nSUA_CHAVE_PRIVADA\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=seu_calendar_id@group.calendar.google.com

# ===========================================
# ASAAS - GATEWAY DE PAGAMENTO
# ===========================================
ASAAS_API_URL=https://api.asaas.com/v3
ASAAS_API_KEY=sua_api_key_asaas
ASAAS_WEBHOOK_TOKEN=seu_webhook_token

# ===========================================
# CONFIGURAÇÕES DO NEGÓCIO
# ===========================================
DURACAO_CONSULTA_MINUTOS=50
VALOR_CONSULTA_PADRAO=200.00
NOME_PROFISSIONAL=Dra. Maria Silva
TELEFONE_PROFISSIONAL=5511999999999
```

### Configuração do Google Calendar

1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Crie um novo projeto ou selecione um existente
3. Ative a **Google Calendar API**
4. Crie uma **Service Account**
5. Gere uma chave JSON para a Service Account
6. Compartilhe seu calendário com o email da Service Account

### Configuração do Asaas

1. Acesse [Asaas](https://www.asaas.com)
2. Vá em **Integrações > API**
3. Gere sua **API Key** de produção ou sandbox
4. Configure o **Webhook** apontando para: `https://seu-dominio.com/webhooks/asaas`

### Configuração do WhatsApp Business API

1. Acesse [Meta for Developers](https://developers.facebook.com)
2. Crie um app do tipo **Business**
3. Configure o **WhatsApp Business API**
4. Obtenha o **Phone Number ID** e **Access Token**
5. Configure o **Webhook** apontando para: `https://seu-dominio.com/webhooks/whatsapp`

---

## 🧩 Módulos

### 1. WhatsApp Webhook (`/webhooks/whatsapp`)

Recebe e processa mensagens do WhatsApp, roteando para o orquestrador de conversas.

**Funcionalidades:**
- Verificação de webhook (GET)
- Processamento de mensagens (POST)
- Deduplicação de mensagens
- Tratamento de erros

### 2. Pacientes (`/pacientes`)

Gerenciamento completo de pacientes com sincronização automática com Asaas.

**Funcionalidades:**
- CRUD de pacientes
- Busca por telefone (identificador único)
- Sincronização com Asaas Customer
- Validação de CPF/CNPJ

### 3. Consultas (`/consultas`)

Gerenciamento do ciclo de vida das consultas.

**Funcionalidades:**
- Listagem e busca de consultas
- Atualização de status
- Histórico de consultas por paciente
- Marcação como realizada/não compareceu

### 4. Agendamento

Fluxo completo de agendamento via WhatsApp.

**Funcionalidades:**
- Verificação de disponibilidade no Google Calendar
- Sugestão de horários disponíveis
- Confirmação de agendamento
- Criação de evento no calendário

### 5. Reagendamento

Permite reagendar consultas existentes.

**Funcionalidades:**
- Listagem de consultas reagendáveis
- Cancelamento do horário anterior
- Novo agendamento com verificação de disponibilidade

### 6. Cancelamento

Processo de cancelamento com confirmação.

**Funcionalidades:**
- Listagem de consultas canceláveis
- Confirmação de cancelamento
- Atualização do Google Calendar
- Registro de motivo

### 7. Handoff (`/handoff`)

Transferência para atendimento humano.

**Funcionalidades:**
- Fila de atendimento
- Categorização por motivo
- Notificação ao profissional
- Registro de resolução

### 8. Lembretes (Cron)

Envio automático de lembretes via WhatsApp.

**Funcionalidades:**
- Lembrete 24 horas antes
- Lembrete 2 horas antes
- Execução via Cron Jobs
- Controle de lembretes já enviados

### 9. Cobrança (`/cobranca`)

Geração de cobranças pós-consulta via Asaas.

**Funcionalidades:**
- Geração automática após consulta REALIZADA
- Suporte a PIX, Boleto e Cartão
- Envio de link de pagamento via WhatsApp
- Tratamento de cobranças pendentes

### 10. Asaas Webhook (`/webhooks/asaas`)

Processamento de eventos de pagamento do Asaas.

**Funcionalidades:**
- Idempotência via tabela `webhook_events`
- Atualização de status de pagamento
- Notificação ao paciente
- Registro de auditoria

### 11. Relatórios (`/relatorios`)

Dashboard e relatórios gerenciais.

**Funcionalidades:**
- Dashboard com métricas
- Relatório financeiro por período
- Logs de auditoria
- Exportação de dados

---

## 🔌 Endpoints da API

### WhatsApp Webhook
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/webhooks/whatsapp` | Verificação do webhook |
| POST | `/webhooks/whatsapp` | Recebimento de mensagens |

### Pacientes
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/pacientes` | Listar pacientes |
| GET | `/pacientes/:id` | Buscar por ID |
| GET | `/pacientes/telefone/:telefone` | Buscar por telefone |
| POST | `/pacientes` | Criar paciente |
| PUT | `/pacientes/:id` | Atualizar paciente |

### Consultas
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/consultas` | Listar consultas |
| GET | `/consultas/:id` | Buscar por ID |
| GET | `/consultas/paciente/:pacienteId` | Buscar por paciente |
| PUT | `/consultas/:id/status` | Atualizar status |
| PUT | `/consultas/:id/realizada` | Marcar como realizada |
| PUT | `/consultas/:id/nao-compareceu` | Marcar como não compareceu |

### Handoff
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/handoff` | Listar fila |
| GET | `/handoff/aguardando` | Listar aguardando |
| PUT | `/handoff/:id/iniciar` | Iniciar atendimento |
| PUT | `/handoff/:id/finalizar` | Finalizar atendimento |

### Cobrança
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/cobranca/gerar/:consultaId` | Gerar cobrança |
| POST | `/cobranca/processar-pendentes` | Processar pendentes |

### Relatórios
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/relatorios/dashboard` | Dashboard geral |
| GET | `/relatorios/financeiro` | Relatório financeiro |
| GET | `/relatorios/auditoria` | Logs de auditoria |

### Asaas Webhook
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/webhooks/asaas` | Eventos de pagamento |

---

## 💬 Fluxos de Conversa

### Menu Principal
```
Olá! 👋 Sou a assistente virtual da [Profissional].

Escolha uma opção:
1️⃣ Agendar consulta
2️⃣ Reagendar consulta
3️⃣ Cancelar consulta
4️⃣ Falar com atendente
```

### Estados da Conversa

| Estado | Descrição |
|--------|-----------|
| `MENU_PRINCIPAL` | Aguardando seleção do menu |
| `CADASTRO_NOME` | Coletando nome do paciente |
| `CADASTRO_CPF` | Coletando CPF |
| `CADASTRO_EMAIL` | Coletando email |
| `AGUARDANDO_DATA` | Seleção de data |
| `AGUARDANDO_HORARIO` | Seleção de horário |
| `CONFIRMANDO_AGENDAMENTO` | Confirmação final |
| `SELECIONANDO_CONSULTA_REAGENDAMENTO` | Seleção para reagendar |
| `SELECIONANDO_CONSULTA_CANCELAMENTO` | Seleção para cancelar |
| `CONFIRMANDO_CANCELAMENTO` | Confirmação de cancelamento |
| `HANDOFF` | Aguardando atendente |

---

## 🔗 Integrações

### WhatsApp Business API

- **Envio de mensagens** de texto e templates
- **Recebimento de mensagens** via webhook
- **Status de entrega** (enviado, entregue, lido)

### Google Calendar

- **Verificação de disponibilidade** com busy/free
- **Criação de eventos** com título e descrição
- **Cancelamento de eventos** ao reagendar/cancelar
- **Atualização de eventos**

### Asaas

- **Criação de clientes** com verificação de duplicidade
- **Geração de cobranças** (PIX, Boleto, Cartão)
- **Webhooks de pagamento** (confirmação, vencimento)
- **Links de pagamento** enviados via WhatsApp

---

## 🛡️ Segurança e LGPD

### Dados Armazenados

✅ **Permitido:**
- Nome, CPF, email, telefone
- Datas e horários de consultas
- Dados de pagamento (sem cartão completo)
- Logs de auditoria

❌ **Não Armazenado:**
- Conteúdo das sessões
- Diagnósticos
- Prescrições
- Qualquer dado clínico

### Boas Práticas

- Criptografia de dados sensíveis
- Logs de auditoria completos
- Controle de acesso por roles
- Backup automático do banco

---

## 📊 Monitoramento

### Logs

O sistema utiliza **Winston** para logging estruturado:

```typescript
// Níveis de log
logger.error('Erro crítico', { error });
logger.warn('Aviso importante', { data });
logger.info('Informação geral', { data });
logger.debug('Debug detalhado', { data });
```

### Métricas Disponíveis

- Total de consultas por status
- Taxa de comparecimento
- Receita por período
- Tempo médio de resposta
- Handoffs por motivo

### Dashboard

Acesse `/relatorios/dashboard` para métricas em tempo real:

```json
{
  "totalPacientes": 150,
  "consultasHoje": 8,
  "consultasAgendadas": 45,
  "receitaMes": 15000.00,
  "taxaComparecimento": 92.5,
  "handoffsAguardando": 2
}
```

---

## 🧪 Scripts Disponíveis

```bash
# Desenvolvimento
npm run start:dev       # Inicia com hot-reload

# Produção
npm run build           # Compila o projeto
npm run start:prod      # Inicia em produção

# Banco de Dados
npm run migration:generate  # Gera nova migration
npm run migration:run       # Executa migrations
npm run migration:revert    # Reverte última migration

# Testes
npm run test            # Testes unitários
npm run test:e2e        # Testes end-to-end
npm run test:cov        # Cobertura de testes

# Qualidade
npm run lint            # Verifica código
npm run format          # Formata código
```

---

## 📝 Changelog

### v1.0.0 (2024)
- ✅ Implementação inicial completa
- ✅ 11 módulos funcionais
- ✅ Integrações WhatsApp, Google Calendar, Asaas
- ✅ Sistema de lembretes automáticos
- ✅ Dashboard e relatórios
- ✅ Auditoria completa

---

## 📄 Licença

Este projeto é proprietário e confidencial.

---

## 🤝 Suporte

Para suporte técnico, entre em contato com a equipe de desenvolvimento.

---

**Desenvolvido com ❤️ para profissionais de psicologia**