import { Module, forwardRef } from '@nestjs/common';
import { AcademicController } from './academic.controller';
import { AcademicService } from './academic.service';
import { AcademicSyncService } from './academic-sync.service';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [forwardRef(() => JobsModule)],
  controllers: [AcademicController],
  providers: [AcademicService, AcademicSyncService],
  exports: [AcademicService, AcademicSyncService],
})
export class AcademicModule {}

