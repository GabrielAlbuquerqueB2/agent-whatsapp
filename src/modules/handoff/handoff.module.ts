import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HandoffController } from './handoff.controller';
import { HandoffService } from './handoff.service';
import { Paciente, Handoff, Auditoria } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Paciente, Handoff, Auditoria])],
  controllers: [HandoffController],
  providers: [HandoffService],
  exports: [HandoffService],
})
export class HandoffModule {}
