import { Module } from '@nestjs/common';
import { SetupModule } from '../setup/setup.module';
import {
  EnrollmentsController,
  StudentsController,
} from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [SetupModule],
  controllers: [StudentsController, EnrollmentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
