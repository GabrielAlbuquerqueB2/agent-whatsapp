-- ================================================
-- PSI AGENDA SYSTEM - Script de Criação do Banco
-- ================================================

-- Criar tipos ENUM
CREATE TYPE tipo_pessoa AS ENUM ('FISICA', 'JURIDICA');
CREATE TYPE tipo_pagamento AS ENUM ('PIX', 'BOLETO', 'CARTAO_CREDITO');
CREATE TYPE tipo_cobranca AS ENUM ('AVULSA', 'RECORRENTE');
CREATE TYPE status_consulta AS ENUM ('AGENDADA', 'CONFIRMADA', 'REALIZADA', 'CANCELADA', 'NAO_COMPARECEU', 'REAGENDADA');
CREATE TYPE status_pagamento AS ENUM ('PENDENTE', 'COBRANCA_GERADA', 'PAGO', 'CANCELADO', 'VENCIDO', 'REEMBOLSADO');
CREATE TYPE metodo_pagamento AS ENUM ('PIX', 'BOLETO', 'CARTAO_CREDITO');
CREATE TYPE status_pagamento_asaas AS ENUM ('PENDING', 'RECEIVED', 'CONFIRMED', 'OVERDUE', 'REFUNDED', 'RECEIVED_IN_CASH', 'REFUND_REQUESTED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL', 'DUNNING_REQUESTED', 'DUNNING_RECEIVED', 'AWAITING_RISK_ANALYSIS');
CREATE TYPE status_handoff AS ENUM ('AGUARDANDO', 'EM_ATENDIMENTO', 'FINALIZADO');
CREATE TYPE motivo_handoff AS ENUM ('SOLICITACAO_PACIENTE', 'DUVIDA_FINANCEIRA', 'PROBLEMA_TECNICO', 'EMERGENCIA', 'OUTRO');
CREATE TYPE tipo_evento_auditoria AS ENUM ('PACIENTE_CRIADO', 'PACIENTE_ATUALIZADO', 'CONSULTA_AGENDADA', 'CONSULTA_CONFIRMADA', 'CONSULTA_REALIZADA', 'CONSULTA_CANCELADA', 'CONSULTA_REAGENDADA', 'CONSULTA_NAO_COMPARECEU', 'COBRANCA_CRIADA', 'PAGAMENTO_RECEBIDO', 'PAGAMENTO_CONFIRMADO', 'PAGAMENTO_VENCIDO', 'PAGAMENTO_REEMBOLSADO', 'CLIENTE_ASAAS_CRIADO', 'WEBHOOK_ASAAS_RECEBIDO', 'MENSAGEM_ENVIADA', 'MENSAGEM_RECEBIDA', 'LEMBRETE_ENVIADO', 'HANDOFF_INICIADO', 'HANDOFF_FINALIZADO');

-- Tabela: pacientes
CREATE TABLE pacientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    cpf VARCHAR(14),
    email VARCHAR(255),
    telefone VARCHAR(20) NOT NULL UNIQUE,
    tipo_pessoa tipo_pessoa DEFAULT 'FISICA',
    tipo_pagamento tipo_pagamento DEFAULT 'PIX',
    tipo_cobranca tipo_cobranca DEFAULT 'AVULSA',
    valor DECIMAL(10, 2),
    asaas_customer_id VARCHAR(100),
    cadastro_completo BOOLEAN DEFAULT FALSE,
    ativo BOOLEAN DEFAULT TRUE,
    ultimo_estado_conversa VARCHAR(100),
    dados_temporarios JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pacientes_telefone ON pacientes(telefone);
CREATE INDEX idx_pacientes_cpf ON pacientes(cpf);

-- Tabela: consultas
CREATE TABLE consultas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES pacientes(id),
    data DATE NOT NULL,
    horario TIME NOT NULL,
    data_hora_inicio TIMESTAMP NOT NULL,
    data_hora_fim TIMESTAMP NOT NULL,
    status_consulta status_consulta DEFAULT 'AGENDADA',
    status_pagamento status_pagamento DEFAULT 'PENDENTE',
    google_calendar_event_id VARCHAR(255),
    valor DECIMAL(10, 2) NOT NULL,
    lembrete_24h_enviado BOOLEAN DEFAULT FALSE,
    lembrete_2h_enviado BOOLEAN DEFAULT FALSE,
    motivo_cancelamento TEXT,
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_consultas_paciente ON consultas(paciente_id);
CREATE INDEX idx_consultas_data ON consultas(data);
CREATE INDEX idx_consultas_status ON consultas(status_consulta);

-- Tabela: pagamentos
CREATE TABLE pagamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consulta_id UUID NOT NULL UNIQUE REFERENCES consultas(id),
    asaas_payment_id VARCHAR(100) UNIQUE,
    valor DECIMAL(10, 2) NOT NULL,
    metodo_pagamento metodo_pagamento NOT NULL,
    status status_pagamento_asaas DEFAULT 'PENDING',
    link_pagamento TEXT,
    linha_digitavel TEXT,
    pix_copia_cola TEXT,
    qr_code_url TEXT,
    data_vencimento DATE,
    data_pagamento TIMESTAMP,
    data_confirmacao TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pagamentos_consulta ON pagamentos(consulta_id);
CREATE INDEX idx_pagamentos_asaas ON pagamentos(asaas_payment_id);
CREATE INDEX idx_pagamentos_status ON pagamentos(status);

-- Tabela: auditoria
CREATE TABLE auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_evento tipo_evento_auditoria NOT NULL,
    paciente_id UUID,
    consulta_id UUID,
    pagamento_id UUID,
    dados_anteriores JSONB,
    dados_novos JSONB,
    metadata JSONB,
    ip_origem VARCHAR(50),
    user_agent TEXT,
    idempotency_key VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_auditoria_tipo ON auditoria(tipo_evento);
CREATE INDEX idx_auditoria_paciente ON auditoria(paciente_id);
CREATE INDEX idx_auditoria_consulta ON auditoria(consulta_id);
CREATE INDEX idx_auditoria_idempotency ON auditoria(idempotency_key);
CREATE INDEX idx_auditoria_created ON auditoria(created_at);

-- Tabela: handoffs
CREATE TABLE handoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES pacientes(id),
    status status_handoff DEFAULT 'AGUARDANDO',
    motivo motivo_handoff NOT NULL,
    descricao TEXT,
    atendente VARCHAR(255),
    inicio_atendimento TIMESTAMP,
    fim_atendimento TIMESTAMP,
    resolucao TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_handoffs_paciente ON handoffs(paciente_id);
CREATE INDEX idx_handoffs_status ON handoffs(status);

-- Tabela: webhook_events (idempotência)
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(50) NOT NULL,
    event_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    processed_at TIMESTAMP,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhook_events_source ON webhook_events(source);
CREATE INDEX idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_pacientes_updated_at BEFORE UPDATE ON pacientes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_consultas_updated_at BEFORE UPDATE ON consultas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pagamentos_updated_at BEFORE UPDATE ON pagamentos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
