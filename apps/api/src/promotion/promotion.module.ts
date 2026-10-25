import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module';
import { FeesModule } from '../fees/fees.module';
import { SetupModule } from '../setup/setup.module';
import { StudentsModule } from '../students/students.module';
import { PromotionController } from './promotion.controller';
import { PromotionService } from './promotion.service';

@Module({
  imports: [StudentsModule, FeesModule, SetupModule, ApprovalsModule],
  controllers: [PromotionController],
  providers: [PromotionService],
})
export class PromotionModule {}
