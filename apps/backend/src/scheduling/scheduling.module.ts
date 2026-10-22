import { Module } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { SchedulingController } from './scheduling.controller';
import { PublicSchedulingController } from './public-scheduling.controller';

@Module({
  providers: [SchedulingService],
  controllers: [SchedulingController, PublicSchedulingController],
  exports: [SchedulingService],
})
export class SchedulingModule {}
