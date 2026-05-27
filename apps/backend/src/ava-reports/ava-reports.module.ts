import { Module } from '@nestjs/common';
import { AvaReportsController } from './ava-reports.controller';
import { AvaReportsService } from './ava-reports.service';

@Module({
  controllers: [AvaReportsController],
  providers: [AvaReportsService]
})
export class AvaReportsModule {}
