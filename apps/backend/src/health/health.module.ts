import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { DbModule } from '../db/db.module';
import { JobsModule } from '../jobs/jobs.module';
import { AcademicModule } from '../academic/academic.module';

@Module({
  imports: [DbModule, JobsModule, AcademicModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
