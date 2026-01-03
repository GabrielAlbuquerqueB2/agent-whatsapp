import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LembretesController } from './lembretes.controller';
import { LembretesService } from './lembretes.service';
import { Paciente, Auditoria } from '../../database/entities';
import { ConsultasModule } from '../consultas/consultas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Paciente, Auditoria]),
    ConsultasModule,
  ],
  controllers: [LembretesController],
  providers: [LembretesService],
  exports: [LembretesService],
})
export class LembretesModule {}
