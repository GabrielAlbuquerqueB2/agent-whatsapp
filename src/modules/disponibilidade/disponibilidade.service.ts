import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Disponibilidade, DiaSemana } from '../../database/entities/disponibilidade.entity';
import { CreateDisponibilidadeDto, UpdateDisponibilidadeDto } from './dto/disponibilidade.dto';

@Injectable()
export class DisponibilidadeService {
  private readonly logger = new Logger(DisponibilidadeService.name);

  constructor(
    @InjectRepository(Disponibilidade)
    private readonly disponibilidadeRepository: Repository<Disponibilidade>,
  ) {}

  async findAll(): Promise<Disponibilidade[]> {
    return this.disponibilidadeRepository.find({
      order: { diaSemana: 'ASC', horarioInicio: 'ASC' },
    });
  }

  async findAtivas(): Promise<Disponibilidade[]> {
    return this.disponibilidadeRepository.find({
      where: { ativo: true },
      order: { diaSemana: 'ASC', horarioInicio: 'ASC' },
    });
  }

  async findByDia(diaSemana: DiaSemana): Promise<Disponibilidade[]> {
    return this.disponibilidadeRepository.find({
      where: { diaSemana, ativo: true },
      order: { horarioInicio: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Disponibilidade> {
    const disponibilidade = await this.disponibilidadeRepository.findOne({
      where: { id },
    });

    if (!disponibilidade) {
      throw new NotFoundException('Disponibilidade não encontrada');
    }

    return disponibilidade;
  }

  async create(dto: CreateDisponibilidadeDto): Promise<Disponibilidade> {
    // Validar horários
    if (dto.horarioInicio >= dto.horarioFim) {
      throw new BadRequestException('Horário de início deve ser anterior ao horário de fim');
    }

    // Verificar conflito de horários no mesmo dia
    const existentes = await this.findByDia(dto.diaSemana);
    for (const existente of existentes) {
      if (this.temConflito(dto.horarioInicio, dto.horarioFim, existente.horarioInicio, existente.horarioFim)) {
        throw new BadRequestException(
          `Conflito de horário com disponibilidade existente: ${existente.horarioInicio} - ${existente.horarioFim}`,
        );
      }
    }

    const disponibilidade = this.disponibilidadeRepository.create({
      diaSemana: dto.diaSemana,
      horarioInicio: dto.horarioInicio,
      horarioFim: dto.horarioFim,
      duracaoConsulta: dto.duracaoConsulta || 50,
      intervaloConsultas: dto.intervaloConsultas || 10,
      ativo: true,
    });

    const saved = await this.disponibilidadeRepository.save(disponibilidade);
    this.logger.log(`Disponibilidade criada: ${DiaSemana[dto.diaSemana]} ${dto.horarioInicio}-${dto.horarioFim}`);

    return saved;
  }

  async update(id: string, dto: UpdateDisponibilidadeDto): Promise<Disponibilidade> {
    const disponibilidade = await this.findOne(id);

    if (dto.horarioInicio && dto.horarioFim && dto.horarioInicio >= dto.horarioFim) {
      throw new BadRequestException('Horário de início deve ser anterior ao horário de fim');
    }

    // Verificar conflito se horários forem alterados
    if (dto.horarioInicio || dto.horarioFim) {
      const inicio = dto.horarioInicio || disponibilidade.horarioInicio;
      const fim = dto.horarioFim || disponibilidade.horarioFim;
      const dia = dto.diaSemana !== undefined ? dto.diaSemana : disponibilidade.diaSemana;

      const existentes = await this.findByDia(dia);
      for (const existente of existentes) {
        if (existente.id !== id && this.temConflito(inicio, fim, existente.horarioInicio, existente.horarioFim)) {
          throw new BadRequestException(
            `Conflito de horário com disponibilidade existente: ${existente.horarioInicio} - ${existente.horarioFim}`,
          );
        }
      }
    }

    Object.assign(disponibilidade, dto);
    return this.disponibilidadeRepository.save(disponibilidade);
  }

  async remove(id: string): Promise<void> {
    const disponibilidade = await this.findOne(id);
    await this.disponibilidadeRepository.remove(disponibilidade);
    this.logger.log(`Disponibilidade removida: ${id}`);
  }

  async toggleAtivo(id: string): Promise<Disponibilidade> {
    const disponibilidade = await this.findOne(id);
    disponibilidade.ativo = !disponibilidade.ativo;
    return this.disponibilidadeRepository.save(disponibilidade);
  }

  /**
   * Retorna os horários disponíveis para uma data específica
   */
  async getHorariosDisponiveis(data: Date): Promise<string[]> {
    const diaSemana = data.getDay() as DiaSemana;
    const disponibilidades = await this.findByDia(diaSemana);

    const horarios: string[] = [];

    for (const disp of disponibilidades) {
      const slots = this.gerarSlots(disp.horarioInicio, disp.horarioFim, disp.duracaoConsulta, disp.intervaloConsultas);
      horarios.push(...slots);
    }

    return horarios.sort();
  }

  /**
   * Gera os slots de horário baseado na configuração
   */
  private gerarSlots(inicio: string, fim: string, duracao: number, intervalo: number): string[] {
    const slots: string[] = [];
    const [horaInicio, minInicio] = inicio.split(':').map(Number);
    const [horaFim, minFim] = fim.split(':').map(Number);

    let minutoAtual = horaInicio * 60 + minInicio;
    const minutoFim = horaFim * 60 + minFim;

    while (minutoAtual + duracao <= minutoFim) {
      const hora = Math.floor(minutoAtual / 60);
      const minuto = minutoAtual % 60;
      slots.push(`${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`);
      minutoAtual += duracao + intervalo;
    }

    return slots;
  }

  private temConflito(inicio1: string, fim1: string, inicio2: string, fim2: string): boolean {
    return inicio1 < fim2 && fim1 > inicio2;
  }

  /**
   * Retorna um resumo da configuração de disponibilidade
   */
  async getResumo(): Promise<{
    diasAtivos: number[];
    totalHorasSemana: number;
    slotsDisponiveis: number;
  }> {
    const disponibilidades = await this.findAtivas();
    
    const diasAtivos = [...new Set(disponibilidades.map(d => d.diaSemana))];
    
    let totalMinutos = 0;
    let totalSlots = 0;

    for (const disp of disponibilidades) {
      const [horaInicio, minInicio] = disp.horarioInicio.split(':').map(Number);
      const [horaFim, minFim] = disp.horarioFim.split(':').map(Number);
      const minutos = (horaFim * 60 + minFim) - (horaInicio * 60 + minInicio);
      totalMinutos += minutos;
      
      const slots = this.gerarSlots(disp.horarioInicio, disp.horarioFim, disp.duracaoConsulta, disp.intervaloConsultas);
      totalSlots += slots.length;
    }

    return {
      diasAtivos,
      totalHorasSemana: Math.round(totalMinutos / 60 * 10) / 10,
      slotsDisponiveis: totalSlots,
    };
  }
}
