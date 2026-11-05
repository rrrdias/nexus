import { Module } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { SchedulingController } from './scheduling.controller';
import { PublicSchedulingController } from './public-scheduling.controller';
import { StudentSessionGuard } from './guards/student-session.guard';

@Module({
  providers: [SchedulingService, StudentSessionGuard],
  controllers: [SchedulingController, PublicSchedulingController],
  exports: [SchedulingService, StudentSessionGuard],
})
export class SchedulingModule {}
