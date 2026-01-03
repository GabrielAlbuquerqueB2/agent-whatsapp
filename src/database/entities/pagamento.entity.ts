import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';

// Tipo para evitar import circular
interface ConsultaRelation {
  id: string;
  paciente_id: string;
}

export enum MetodoPagamento {
  PIX = 'PIX',
  BOLETO = 'BOLETO',
  CARTAO_CREDITO = 'CARTAO_CREDITO',
}

export enum StatusPagamentoAsaas {
  PENDING = 'PENDING',
  RECEIVED = 'RECEIVED',
  CONFIRMED = 'CONFIRMED',
  OVERDUE = 'OVERDUE',
  REFUNDED = 'REFUNDED',
  RECEIVED_IN_CASH = 'RECEIVED_IN_CASH',
  REFUND_REQUESTED = 'REFUND_REQUESTED',
  CHARGEBACK_REQUESTED = 'CHARGEBACK_REQUESTED',
  CHARGEBACK_DISPUTE = 'CHARGEBACK_DISPUTE',
  AWAITING_CHARGEBACK_REVERSAL = 'AWAITING_CHARGEBACK_REVERSAL',
  DUNNING_REQUESTED = 'DUNNING_REQUESTED',
  DUNNING_RECEIVED = 'DUNNING_RECEIVED',
  AWAITING_RISK_ANALYSIS = 'AWAITING_RISK_ANALYSIS',
}

@Entity('pagamentos')
export class Pagamento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  consulta_id: string;

  @OneToOne('Consulta', 'pagamento')
  @JoinColumn({ name: 'consulta_id' })
  consulta: ConsultaRelation;

  @Index({ unique: true })
  @Column({ nullable: true })
  asaas_payment_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  valor: number;

  @Column({
    type: 'enum',
    enum: MetodoPagamento,
  })
  metodo_pagamento: MetodoPagamento;

  @Column({
    type: 'enum',
    enum: StatusPagamentoAsaas,
    default: StatusPagamentoAsaas.PENDING,
  })
  status: StatusPagamentoAsaas;

  @Column({ nullable: true })
  link_pagamento: string;

  @Column({ nullable: true })
  linha_digitavel: string;

  @Column({ nullable: true })
  pix_copia_cola: string;

  @Column({ nullable: true })
  qr_code_url: string;

  @Column({ type: 'date', nullable: true })
  data_vencimento: Date;

  @Column({ type: 'timestamp', nullable: true })
  data_pagamento: Date;

  @Column({ type: 'timestamp', nullable: true })
  data_confirmacao: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
