import { Module, forwardRef } from '@nestjs/common';
import { JobsModule } from '../../jobs/jobs.module';
import { AcademicGradesController } from './academic-grades.controller';
import { AcademicGradesMirrorService } from './academic-grades-mirror.service';
import { AcademicGradesSearchService } from './academic-grades-search.service';

@Module({
  imports: [forwardRef(() => JobsModule)],
  controllers: [AcademicGradesController],
  providers: [AcademicGradesMirrorService, AcademicGradesSearchService],
  exports: [AcademicGradesMirrorService, AcademicGradesSearchService],
})
export class AcademicGradesModule {}
