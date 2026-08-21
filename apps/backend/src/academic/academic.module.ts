import { Module } from '@nestjs/common';
import { AcademicController } from './academic.controller';
import { AcademicService } from './academic.service';
import { AcademicSyncService } from './academic-sync.service';

@Module({
  controllers: [AcademicController],
  providers: [AcademicService, AcademicSyncService],
  exports: [AcademicService],
})
export class AcademicModule {}
