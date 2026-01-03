import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum StatusHandoff {
  AGUARDANDO = 'AGUARDANDO',
  EM_ATENDIMENTO = 'EM_ATENDIMENTO',
  FINALIZADO = 'FINALIZADO',
}

export enum MotivoHandoff {
  SOLICITACAO_PACIENTE = 'SOLICITACAO_PACIENTE',
  DUVIDA_FINANCEIRA = 'DUVIDA_FINANCEIRA',
  PROBLEMA_TECNICO = 'PROBLEMA_TECNICO',
  EMERGENCIA = 'EMERGENCIA',
  OUTRO = 'OUTRO',
}

@Entity('handoffs')
export class Handoff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  paciente_id: string;

  @Column({
    type: 'enum',
    enum: StatusHandoff,
    default: StatusHandoff.AGUARDANDO,
  })
  status: StatusHandoff;

  @Column({
    type: 'enum',
    enum: MotivoHandoff,
  })
  motivo: MotivoHandoff;

  @Column({ type: 'text', nullable: true })
  descricao: string;

  @Column({ nullable: true })
  atendente: string;

  @Column({ type: 'timestamp', nullable: true })
  inicio_atendimento: Date;

  @Column({ type: 'timestamp', nullable: true })
  fim_atendimento: Date;

  @Column({ type: 'text', nullable: true })
  resolucao: string;

  @CreateDateColumn()
  created_at: Date;
}
