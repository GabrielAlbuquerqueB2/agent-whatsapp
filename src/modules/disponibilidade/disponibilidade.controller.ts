import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { DisponibilidadeService } from './disponibilidade.service';
import { CreateDisponibilidadeDto, UpdateDisponibilidadeDto } from './dto/disponibilidade.dto';
import { Disponibilidade, DiaSemana } from '../../database/entities/disponibilidade.entity';

@ApiTags('Disponibilidade')
@Controller('disponibilidade')
export class DisponibilidadeController {
  constructor(private readonly disponibilidadeService: DisponibilidadeService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todas as configurações de disponibilidade' })
  @ApiResponse({ status: 200, description: 'Lista de disponibilidades' })
  async findAll(): Promise<Disponibilidade[]> {
    return this.disponibilidadeService.findAll();
  }

  @Get('ativas')
  @ApiOperation({ summary: 'Lista apenas disponibilidades ativas' })
  @ApiResponse({ status: 200, description: 'Lista de disponibilidades ativas' })
  async findAtivas(): Promise<Disponibilidade[]> {
    return this.disponibilidadeService.findAtivas();
  }

  @Get('resumo')
  @ApiOperation({ summary: 'Retorna resumo da configuração de disponibilidade' })
  @ApiResponse({ status: 200, description: 'Resumo da disponibilidade' })
  async getResumo() {
    return this.disponibilidadeService.getResumo();
  }

  @Get('dia/:diaSemana')
  @ApiOperation({ summary: 'Lista disponibilidades de um dia específico' })
  @ApiQuery({ name: 'diaSemana', enum: DiaSemana })
  @ApiResponse({ status: 200, description: 'Lista de disponibilidades do dia' })
  async findByDia(@Param('diaSemana', ParseIntPipe) diaSemana: number): Promise<Disponibilidade[]> {
    return this.disponibilidadeService.findByDia(diaSemana as DiaSemana);
  }

  @Get('horarios/:data')
  @ApiOperation({ summary: 'Retorna horários disponíveis para uma data' })
  @ApiResponse({ status: 200, description: 'Lista de horários disponíveis' })
  async getHorariosDisponiveis(@Param('data') data: string): Promise<string[]> {
    const dataObj = new Date(data);
    return this.disponibilidadeService.getHorariosDisponiveis(dataObj);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca disponibilidade por ID' })
  @ApiResponse({ status: 200, description: 'Disponibilidade encontrada' })
  @ApiResponse({ status: 404, description: 'Disponibilidade não encontrada' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Disponibilidade> {
    return this.disponibilidadeService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria nova configuração de disponibilidade' })
  @ApiResponse({ status: 201, description: 'Disponibilidade criada' })
  @ApiResponse({ status: 400, description: 'Dados inválidos ou conflito de horário' })
  async create(@Body() dto: CreateDisponibilidadeDto): Promise<Disponibilidade> {
    return this.disponibilidadeService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza configuração de disponibilidade' })
  @ApiResponse({ status: 200, description: 'Disponibilidade atualizada' })
  @ApiResponse({ status: 404, description: 'Disponibilidade não encontrada' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDisponibilidadeDto,
  ): Promise<Disponibilidade> {
    return this.disponibilidadeService.update(id, dto);
  }

  @Put(':id/toggle')
  @ApiOperation({ summary: 'Ativa/desativa disponibilidade' })
  @ApiResponse({ status: 200, description: 'Status alterado' })
  async toggleAtivo(@Param('id', ParseUUIDPipe) id: string): Promise<Disponibilidade> {
    return this.disponibilidadeService.toggleAtivo(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove configuração de disponibilidade' })
  @ApiResponse({ status: 200, description: 'Disponibilidade removida' })
  @ApiResponse({ status: 404, description: 'Disponibilidade não encontrada' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    await this.disponibilidadeService.remove(id);
    return { message: 'Disponibilidade removida com sucesso' };
  }
}
