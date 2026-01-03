import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { HandoffService } from './handoff.service';

@ApiTags('handoff')
@Controller('handoff')
export class HandoffController {
  constructor(private readonly handoffService: HandoffService) {}

  @Get('aguardando')
  @ApiOperation({ summary: 'Lista handoffs aguardando atendimento' })
  async listarAguardando() {
    return this.handoffService.listarAguardando();
  }

  @Get('em-atendimento')
  @ApiOperation({ summary: 'Lista handoffs em atendimento' })
  async listarEmAtendimento() {
    return this.handoffService.listarEmAtendimento();
  }

  @Put(':id/iniciar')
  @ApiOperation({ summary: 'Inicia atendimento de um handoff' })
  @ApiParam({ name: 'id', description: 'ID do handoff' })
  async iniciarAtendimento(
    @Param('id') id: string,
    @Body('atendente') atendente: string,
  ) {
    return this.handoffService.iniciarAtendimento(id, atendente);
  }

  @Put(':id/finalizar')
  @ApiOperation({ summary: 'Finaliza atendimento de um handoff' })
  @ApiParam({ name: 'id', description: 'ID do handoff' })
  async finalizarAtendimento(
    @Param('id') id: string,
    @Body('resolucao') resolucao: string,
  ) {
    return this.handoffService.finalizarAtendimento(id, resolucao);
  }
}
