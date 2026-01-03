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
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PacientesService, CriarPacienteDto, AtualizarPacienteDto } from './pacientes.service';

@ApiTags('pacientes')
@Controller('pacientes')
export class PacientesController {
  constructor(private readonly pacientesService: PacientesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todos os pacientes ativos' })
  @ApiResponse({ status: 200, description: 'Lista de pacientes' })
  async listar() {
    return this.pacientesService.listarAtivos();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca paciente por ID' })
  @ApiParam({ name: 'id', description: 'ID do paciente' })
  @ApiResponse({ status: 200, description: 'Dados do paciente' })
  @ApiResponse({ status: 404, description: 'Paciente não encontrado' })
  async buscarPorId(@Param('id') id: string) {
    const paciente = await this.pacientesService.findById(id);
    if (!paciente) {
      throw new HttpException('Paciente não encontrado', HttpStatus.NOT_FOUND);
    }
    return paciente;
  }

  @Get('telefone/:telefone')
  @ApiOperation({ summary: 'Busca paciente por telefone' })
  @ApiParam({ name: 'telefone', description: 'Telefone do paciente' })
  async buscarPorTelefone(@Param('telefone') telefone: string) {
    const paciente = await this.pacientesService.findByTelefone(telefone);
    if (!paciente) {
      throw new HttpException('Paciente não encontrado', HttpStatus.NOT_FOUND);
    }
    return paciente;
  }

  @Post()
  @ApiOperation({ summary: 'Cria novo paciente' })
  @ApiResponse({ status: 201, description: 'Paciente criado com sucesso' })
  async criar(@Body() dto: CriarPacienteDto) {
    return this.pacientesService.criar(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza dados do paciente' })
  @ApiParam({ name: 'id', description: 'ID do paciente' })
  @ApiResponse({ status: 200, description: 'Paciente atualizado' })
  async atualizar(@Param('id') id: string, @Body() dto: AtualizarPacienteDto) {
    return this.pacientesService.atualizar(id, dto);
  }

  @Post(':id/sincronizar-asaas')
  @ApiOperation({ summary: 'Sincroniza paciente com Asaas' })
  @ApiParam({ name: 'id', description: 'ID do paciente' })
  @ApiResponse({ status: 200, description: 'Paciente sincronizado com Asaas' })
  async sincronizarAsaas(@Param('id') id: string) {
    const asaasId = await this.pacientesService.sincronizarComAsaas(id);
    return { asaas_customer_id: asaasId };
  }

  @Get('pendentes/pagamento')
  @ApiOperation({ summary: 'Lista pacientes com pagamento pendente' })
  async listarPendentesPagamento() {
    return this.pacientesService.listarComPagamentoPendente();
  }
}
