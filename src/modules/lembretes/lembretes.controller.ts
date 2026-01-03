import { Controller, Post, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { LembretesService } from './lembretes.service';

@ApiTags('lembretes')
@Controller('lembretes')
export class LembretesController {
  constructor(private readonly lembretesService: LembretesService) {}

  @Post('enviar/:consultaId')
  @ApiOperation({ summary: 'Envia lembrete manual para uma consulta' })
  @ApiParam({ name: 'consultaId', description: 'ID da consulta' })
  async enviarLembreteManual(@Param('consultaId') consultaId: string) {
    await this.lembretesService.enviarLembreteManual(consultaId);
    return { message: 'Lembrete enviado com sucesso' };
  }

  @Post('executar/24h')
  @ApiOperation({ summary: 'Executa manualmente o job de lembretes 24h' })
  async executarJob24h() {
    await this.lembretesService.enviarLembretes24h();
    return { message: 'Job de lembretes 24h executado' };
  }

  @Post('executar/2h')
  @ApiOperation({ summary: 'Executa manualmente o job de lembretes 2h' })
  async executarJob2h() {
    await this.lembretesService.enviarLembretes2h();
    return { message: 'Job de lembretes 2h executado' };
  }
}
