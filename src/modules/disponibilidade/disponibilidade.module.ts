import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Disponibilidade } from '../../database/entities/disponibilidade.entity';
import { DisponibilidadeController } from './disponibilidade.controller';
import { DisponibilidadeService } from './disponibilidade.service';

@Module({
  imports: [TypeOrmModule.forFeature([Disponibilidade])],
  controllers: [DisponibilidadeController],
  providers: [DisponibilidadeService],
  exports: [DisponibilidadeService],
})
export class DisponibilidadeModule {}
