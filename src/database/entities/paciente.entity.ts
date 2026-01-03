import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Consulta } from './consulta.entity';

export enum TipoPessoa {
  FISICA = 'FISICA',
  JURIDICA = 'JURIDICA',
}

export enum TipoPagamento {
  PIX = 'PIX',
  BOLETO = 'BOLETO',
  CARTAO_CREDITO = 'CARTAO_CREDITO',
}

export enum TipoCobranca {
  AVULSA = 'AVULSA',
  RECORRENTE = 'RECORRENTE',
}

@Entity('pacientes')
export class Paciente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  nome: string;

  @Column({ length: 14, nullable: true })
  cpf: string;

  @Column({ length: 255, nullable: true })
  email: string;

  @Index({ unique: true })
  @Column({ length: 20 })
  telefone: string; // Identificador único - formato: 5511999999999

  @Column({
    type: 'enum',
    enum: TipoPessoa,
    default: TipoPessoa.FISICA,
  })
  tipo_pessoa: TipoPessoa;

  @Column({
    type: 'enum',
    enum: TipoPagamento,
    default: TipoPagamento.PIX,
  })
  tipo_pagamento: TipoPagamento;

  @Column({
    type: 'enum',
    enum: TipoCobranca,
    default: TipoCobranca.AVULSA,
  })
  tipo_cobranca: TipoCobranca;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  valor: number;

  @Column({ nullable: true })
  asaas_customer_id: string;

  @Column({ default: false })
  cadastro_completo: boolean;

  @Column({ default: true })
  ativo: boolean;

  @Column({ nullable: true })
  ultimo_estado_conversa: string;

  @Column({ type: 'jsonb', nullable: true })
  dados_temporarios: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Consulta, (consulta) => consulta.paciente)
  consultas: Consulta[];
}
