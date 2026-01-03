import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum TipoEventoAuditoria {
  // Paciente
  PACIENTE_CRIADO = 'PACIENTE_CRIADO',
  PACIENTE_ATUALIZADO = 'PACIENTE_ATUALIZADO',
  
  // Consulta
  CONSULTA_AGENDADA = 'CONSULTA_AGENDADA',
  CONSULTA_CONFIRMADA = 'CONSULTA_CONFIRMADA',
  CONSULTA_REALIZADA = 'CONSULTA_REALIZADA',
  CONSULTA_CANCELADA = 'CONSULTA_CANCELADA',
  CONSULTA_REAGENDADA = 'CONSULTA_REAGENDADA',
  CONSULTA_NAO_COMPARECEU = 'CONSULTA_NAO_COMPARECEU',
  
  // Pagamento
  COBRANCA_CRIADA = 'COBRANCA_CRIADA',
  PAGAMENTO_RECEBIDO = 'PAGAMENTO_RECEBIDO',
  PAGAMENTO_CONFIRMADO = 'PAGAMENTO_CONFIRMADO',
  PAGAMENTO_VENCIDO = 'PAGAMENTO_VENCIDO',
  PAGAMENTO_REEMBOLSADO = 'PAGAMENTO_REEMBOLSADO',
  
  // Asaas
  CLIENTE_ASAAS_CRIADO = 'CLIENTE_ASAAS_CRIADO',
  WEBHOOK_ASAAS_RECEBIDO = 'WEBHOOK_ASAAS_RECEBIDO',
  
  // WhatsApp
  MENSAGEM_ENVIADA = 'MENSAGEM_ENVIADA',
  MENSAGEM_RECEBIDA = 'MENSAGEM_RECEBIDA',
  LEMBRETE_ENVIADO = 'LEMBRETE_ENVIADO',
  
  // Handoff
  HANDOFF_INICIADO = 'HANDOFF_INICIADO',
  HANDOFF_FINALIZADO = 'HANDOFF_FINALIZADO',
}

@Entity('auditoria')
export class Auditoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({
    type: 'enum',
    enum: TipoEventoAuditoria,
  })
  tipo_evento: TipoEventoAuditoria;

  @Column({ nullable: true })
  paciente_id: string;

  @Column({ nullable: true })
  consulta_id: string;

  @Column({ nullable: true })
  pagamento_id: string;

  @Column({ type: 'jsonb', nullable: true })
  dados_anteriores: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  dados_novos: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  ip_origem: string;

  @Column({ nullable: true })
  user_agent: string;

  @Index()
  @Column({ nullable: true })
  idempotency_key: string;

  @CreateDateColumn()
  created_at: Date;
}
