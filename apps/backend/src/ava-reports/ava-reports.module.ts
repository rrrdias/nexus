import { Module } from '@nestjs/common';
import { AvaReportsController } from './ava-reports.controller';
import { AvaReportsService } from './ava-reports.service';
import { AvaSyncModule } from '../ava-sync/ava-sync.module';

@Module({
  imports: [AvaSyncModule],
  controllers: [AvaReportsController],
  providers: [AvaReportsService]
})
export class AvaReportsModule {}
