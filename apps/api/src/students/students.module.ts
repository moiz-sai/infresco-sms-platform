import { Module } from '@nestjs/common';
import { SetupModule } from '../setup/setup.module';
import { GuardiansController, StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [SetupModule],
  controllers: [StudentsController, GuardiansController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
