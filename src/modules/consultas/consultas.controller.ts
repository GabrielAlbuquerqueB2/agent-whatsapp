import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ConsultasService, CriarConsultaDto } from './consultas.service';

@ApiTags('consultas')
@Controller('consultas')
export class ConsultasController {
  constructor(private readonly consultasService: ConsultasService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Busca consulta por ID' })
  @ApiParam({ name: 'id', description: 'ID da consulta' })
  async buscarPorId(@Param('id') id: string) {
    const consulta = await this.consultasService.findById(id);
    if (!consulta) {
      throw new HttpException('Consulta não encontrada', HttpStatus.NOT_FOUND);
    }
    return consulta;
  }

  @Get('paciente/:pacienteId')
  @ApiOperation({ summary: 'Lista consultas de um paciente' })
  @ApiParam({ name: 'pacienteId', description: 'ID do paciente' })
  @ApiQuery({ name: 'apenasAgendadas', required: false, type: Boolean })
  async listarPorPaciente(
    @Param('pacienteId') pacienteId: string,
    @Query('apenasAgendadas') apenasAgendadas?: boolean,
  ) {
    return this.consultasService.findByPaciente(pacienteId, apenasAgendadas);
  }

  @Get('paciente/:pacienteId/proximas')
  @ApiOperation({ summary: 'Lista próximas consultas de um paciente' })
  @ApiParam({ name: 'pacienteId', description: 'ID do paciente' })
  async proximasConsultas(@Param('pacienteId') pacienteId: string) {
    return this.consultasService.findProximasConsultas(pacienteId);
  }

  @Get('data/:data')
  @ApiOperation({ summary: 'Lista consultas de uma data específica' })
  @ApiParam({ name: 'data', description: 'Data no formato YYYY-MM-DD' })
  async listarPorData(@Param('data') data: string) {
    return this.consultasService.findByData(new Date(data));
  }

  @Post()
  @ApiOperation({ summary: 'Cria nova consulta' })
  @ApiResponse({ status: 201, description: 'Consulta criada com sucesso' })
  async criar(@Body() dto: CriarConsultaDto) {
    return this.consultasService.criar(dto);
  }

  @Put(':id/realizar')
  @ApiOperation({ summary: 'Marca consulta como realizada' })
  @ApiParam({ name: 'id', description: 'ID da consulta' })
  async marcarRealizada(@Param('id') id: string) {
    return this.consultasService.marcarComoRealizada(id);
  }

  @Put(':id/confirmar')
  @ApiOperation({ summary: 'Confirma consulta' })
  @ApiParam({ name: 'id', description: 'ID da consulta' })
  async confirmar(@Param('id') id: string) {
    return this.consultasService.confirmar(id);
  }

  @Put(':id/cancelar')
  @ApiOperation({ summary: 'Cancela consulta' })
  @ApiParam({ name: 'id', description: 'ID da consulta' })
  async cancelar(@Param('id') id: string, @Body('motivo') motivo?: string) {
    return this.consultasService.cancelar(id, motivo);
  }

  @Put(':id/nao-compareceu')
  @ApiOperation({ summary: 'Marca consulta como não compareceu' })
  @ApiParam({ name: 'id', description: 'ID da consulta' })
  async naoCompareceu(@Param('id') id: string) {
    return this.consultasService.marcarNaoCompareceu(id);
  }

  @Get('pendentes/cobranca')
  @ApiOperation({ summary: 'Lista consultas realizadas pendentes de cobrança' })
  async pendentesCobranca() {
    return this.consultasService.findRealizadasSemCobranca();
  }
}
