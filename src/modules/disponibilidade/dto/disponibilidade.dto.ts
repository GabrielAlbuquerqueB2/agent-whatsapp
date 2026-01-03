import { IsEnum, IsString, IsInt, IsOptional, IsBoolean, Min, Max, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiaSemana } from '../../../database/entities/disponibilidade.entity';

export class CreateDisponibilidadeDto {
  @ApiProperty({
    enum: DiaSemana,
    description: 'Dia da semana (0=Domingo, 1=Segunda, ..., 6=Sábado)',
    example: 1,
  })
  @IsEnum(DiaSemana)
  diaSemana: DiaSemana;

  @ApiProperty({
    description: 'Horário de início (HH:MM)',
    example: '08:00',
  })
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Horário deve estar no formato HH:MM',
  })
  horarioInicio: string;

  @ApiProperty({
    description: 'Horário de fim (HH:MM)',
    example: '18:00',
  })
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Horário deve estar no formato HH:MM',
  })
  horarioFim: string;

  @ApiPropertyOptional({
    description: 'Duração de cada consulta em minutos',
    example: 50,
    default: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(180)
  duracaoConsulta?: number;

  @ApiPropertyOptional({
    description: 'Intervalo entre consultas em minutos',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  intervaloConsultas?: number;
}

export class UpdateDisponibilidadeDto {
  @ApiPropertyOptional({
    enum: DiaSemana,
    description: 'Dia da semana',
  })
  @IsOptional()
  @IsEnum(DiaSemana)
  diaSemana?: DiaSemana;

  @ApiPropertyOptional({
    description: 'Horário de início (HH:MM)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Horário deve estar no formato HH:MM',
  })
  horarioInicio?: string;

  @ApiPropertyOptional({
    description: 'Horário de fim (HH:MM)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Horário deve estar no formato HH:MM',
  })
  horarioFim?: string;

  @ApiPropertyOptional({
    description: 'Duração de cada consulta em minutos',
  })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(180)
  duracaoConsulta?: number;

  @ApiPropertyOptional({
    description: 'Intervalo entre consultas em minutos',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  intervaloConsultas?: number;

  @ApiPropertyOptional({
    description: 'Se a disponibilidade está ativa',
  })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
