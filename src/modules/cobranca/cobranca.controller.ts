import { Controller, Post, Param, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { CobrancaService } from './cobranca.service';

@ApiTags('cobranca')
@Controller('cobranca')
export class CobrancaController {
  constructor(private readonly cobrancaService: CobrancaService) {}

  @Post('gerar/:consultaId')
  @ApiOperation({ summary: 'Gera cobrança para uma consulta realizada' })
  @ApiParam({ name: 'consultaId', description: 'ID da consulta' })
  async gerarCobranca(@Param('consultaId') consultaId: string) {
    return this.cobrancaService.gerarCobrancaManual(consultaId);
  }

  @Post('processar')
  @ApiOperation({ summary: 'Executa manualmente o processamento de cobranças' })
  async processarCobrancas() {
    await this.cobrancaService.processarConsultasRealizadas();
    return { message: 'Processamento de cobranças executado' };
  }
}
