import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgendamentoService } from './agendamento.service';
import { Paciente } from '../../database/entities';
import { ConsultasModule } from '../consultas/consultas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Paciente]),
    ConsultasModule,
  ],
  providers: [AgendamentoService],
  exports: [AgendamentoService],
})
export class AgendamentoModule {}
