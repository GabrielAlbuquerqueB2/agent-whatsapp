import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RelatoriosService } from './relatorios.service';
import { TipoEventoAuditoria } from '../../database/entities';

@ApiTags('relatorios')
@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly relatoriosService: RelatoriosService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard resumido do sistema' })
  async getDashboard() {
    return this.relatoriosService.getDashboard();
  }

  @Get('financeiro')
  @ApiOperation({ summary: 'Resumo financeiro do período' })
  @ApiQuery({ name: 'dataInicio', required: true, type: String, description: 'Data início (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dataFim', required: true, type: String, description: 'Data fim (YYYY-MM-DD)' })
  async getResumoFinanceiro(
    @Query('dataInicio') dataInicio: string,
    @Query('dataFim') dataFim: string,
  ) {
    return this.relatoriosService.getResumoFinanceiro(
      new Date(dataInicio),
      new Date(dataFim + 'T23:59:59'),
    );
  }

  @Get('consultas')
  @ApiOperation({ summary: 'Relatório de consultas do período' })
  @ApiQuery({ name: 'dataInicio', required: true, type: String })
  @ApiQuery({ name: 'dataFim', required: true, type: String })
  async getRelatorioConsultas(
    @Query('dataInicio') dataInicio: string,
    @Query('dataFim') dataFim: string,
  ) {
    return this.relatoriosService.getRelatorioConsultas(
      new Date(dataInicio),
      new Date(dataFim + 'T23:59:59'),
    );
  }

  @Get('pagamentos/pendentes')
  @ApiOperation({ summary: 'Lista pagamentos pendentes' })
  async getPagamentosPendentes() {
    return this.relatoriosService.getPagamentosPendentes();
  }

  @Get('pagamentos/vencidos')
  @ApiOperation({ summary: 'Lista pagamentos vencidos' })
  async getPagamentosVencidos() {
    return this.relatoriosService.getPagamentosVencidos();
  }

  @Get('auditoria')
  @ApiOperation({ summary: 'Logs de auditoria' })
  @ApiQuery({ name: 'tipo', required: false, enum: TipoEventoAuditoria })
  @ApiQuery({ name: 'pacienteId', required: false, type: String })
  @ApiQuery({ name: 'consultaId', required: false, type: String })
  @ApiQuery({ name: 'dataInicio', required: false, type: String })
  @ApiQuery({ name: 'dataFim', required: false, type: String })
  @ApiQuery({ name: 'limite', required: false, type: Number })
  async getAuditoria(
    @Query('tipo') tipo?: TipoEventoAuditoria,
    @Query('pacienteId') pacienteId?: string,
    @Query('consultaId') consultaId?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('limite') limite?: number,
  ) {
    return this.relatoriosService.getLogsAuditoria(
      {
        tipo_evento: tipo,
        paciente_id: pacienteId,
        consulta_id: consultaId,
        dataInicio: dataInicio ? new Date(dataInicio) : undefined,
        dataFim: dataFim ? new Date(dataFim + 'T23:59:59') : undefined,
      },
      limite || 100,
    );
  }

  @Get('auditoria/financeira')
  @ApiOperation({ summary: 'Auditoria financeira do período' })
  @ApiQuery({ name: 'dataInicio', required: true, type: String })
  @ApiQuery({ name: 'dataFim', required: true, type: String })
  async getAuditoriaFinanceira(
    @Query('dataInicio') dataInicio: string,
    @Query('dataFim') dataFim: string,
  ) {
    return this.relatoriosService.getAuditoriaFinanceira(
      new Date(dataInicio),
      new Date(dataFim + 'T23:59:59'),
    );
  }
}
