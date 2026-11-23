import { Module, forwardRef } from '@nestjs/common';
import { AcademicController } from './academic.controller';
import { AcademicService } from './academic.service';
import { AcademicSyncService } from './academic-sync.service';
import { AcademicGradesModule } from './grades/academic-grades.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [forwardRef(() => JobsModule), AcademicGradesModule],
  controllers: [AcademicController],
  providers: [AcademicService, AcademicSyncService],
  exports: [AcademicService, AcademicSyncService, AcademicGradesModule],
})
export class AcademicModule {}
