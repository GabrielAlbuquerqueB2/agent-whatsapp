import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReagendamentoService } from './reagendamento.service';
import { Paciente, Consulta } from '../../database/entities';
import { ConsultasModule } from '../consultas/consultas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Paciente, Consulta]),
    ConsultasModule,
  ],
  providers: [ReagendamentoService],
  exports: [ReagendamentoService],
})
export class ReagendamentoModule {}
