-- Migration: Adiciona tabela de disponibilidades
-- Data: 2026-01-02

-- Criar enum para dia da semana
CREATE TYPE dia_semana_enum AS ENUM ('0', '1', '2', '3', '4', '5', '6');

-- Criar tabela de disponibilidades
CREATE TABLE IF NOT EXISTS disponibilidades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dia_semana INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
    horario_inicio TIME NOT NULL,
    horario_fim TIME NOT NULL,
    duracao_consulta INTEGER NOT NULL DEFAULT 50,
    intervalo_consultas INTEGER NOT NULL DEFAULT 10,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Validações
    CONSTRAINT horario_valido CHECK (horario_inicio < horario_fim),
    CONSTRAINT duracao_minima CHECK (duracao_consulta >= 15),
    CONSTRAINT intervalo_valido CHECK (intervalo_consultas >= 0)
);

-- Criar índices
CREATE INDEX idx_disponibilidades_dia_semana ON disponibilidades(dia_semana);
CREATE INDEX idx_disponibilidades_ativo ON disponibilidades(ativo);

-- Comentários
COMMENT ON TABLE disponibilidades IS 'Configuração de disponibilidade de horários da psicóloga';
COMMENT ON COLUMN disponibilidades.dia_semana IS 'Dia da semana: 0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado';
COMMENT ON COLUMN disponibilidades.horario_inicio IS 'Horário de início do expediente neste dia';
COMMENT ON COLUMN disponibilidades.horario_fim IS 'Horário de fim do expediente neste dia';
COMMENT ON COLUMN disponibilidades.duracao_consulta IS 'Duração de cada consulta em minutos';
COMMENT ON COLUMN disponibilidades.intervalo_consultas IS 'Intervalo entre consultas em minutos';
