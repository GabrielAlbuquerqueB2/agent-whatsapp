import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DiaSemana {
  DOMINGO = 0,
  SEGUNDA = 1,
  TERCA = 2,
  QUARTA = 3,
  QUINTA = 4,
  SEXTA = 5,
  SABADO = 6,
}

@Entity('disponibilidades')
export class Disponibilidade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: DiaSemana,
    name: 'dia_semana',
  })
  diaSemana: DiaSemana;

  @Column({ type: 'time', name: 'horario_inicio' })
  horarioInicio: string;

  @Column({ type: 'time', name: 'horario_fim' })
  horarioFim: string;

  @Column({ type: 'int', name: 'duracao_consulta', default: 50 })
  duracaoConsulta: number; // em minutos

  @Column({ type: 'int', name: 'intervalo_consultas', default: 10 })
  intervaloConsultas: number; // em minutos

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
