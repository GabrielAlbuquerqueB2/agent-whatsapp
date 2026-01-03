import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Paciente } from './paciente.entity';

// Tipo para evitar import circular
interface PagamentoRelation {
  id: string;
  consulta_id: string;
}

export enum StatusConsulta {
  AGENDADA = 'AGENDADA',
  CONFIRMADA = 'CONFIRMADA',
  REALIZADA = 'REALIZADA',
  CANCELADA = 'CANCELADA',
  NAO_COMPARECEU = 'NAO_COMPARECEU',
  REAGENDADA = 'REAGENDADA',
}

export enum StatusPagamento {
  PENDENTE = 'PENDENTE',
  COBRANCA_GERADA = 'COBRANCA_GERADA',
  PAGO = 'PAGO',
  CANCELADO = 'CANCELADO',
  VENCIDO = 'VENCIDO',
  REEMBOLSADO = 'REEMBOLSADO',
}

@Entity('consultas')
export class Consulta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  paciente_id: string;

  @ManyToOne(() => Paciente, (paciente) => paciente.consultas)
  @JoinColumn({ name: 'paciente_id' })
  paciente: Paciente;

  @Column({ type: 'date' })
  data: Date;

  @Column({ type: 'time' })
  horario: string;

  @Column({ type: 'timestamp' })
  data_hora_inicio: Date;

  @Column({ type: 'timestamp' })
  data_hora_fim: Date;

  @Column({
    type: 'enum',
    enum: StatusConsulta,
    default: StatusConsulta.AGENDADA,
  })
  status_consulta: StatusConsulta;

  @Column({
    type: 'enum',
    enum: StatusPagamento,
    default: StatusPagamento.PENDENTE,
  })
  status_pagamento: StatusPagamento;

  @Column({ nullable: true })
  google_calendar_event_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  valor: number;

  @Column({ default: false })
  lembrete_24h_enviado: boolean;

  @Column({ default: false })
  lembrete_2h_enviado: boolean;

  @Column({ nullable: true })
  motivo_cancelamento: string;

  @Column({ nullable: true })
  observacoes: string;

  @OneToOne('Pagamento', 'consulta')
  pagamento: PagamentoRelation;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
