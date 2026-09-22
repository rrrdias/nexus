import { Module, forwardRef } from '@nestjs/common';
import { AvaReportsController } from './ava-reports.controller';
import { AvaReportsService } from './ava-reports.service';
import { AvaSyncModule } from '../ava-sync/ava-sync.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [AvaSyncModule, forwardRef(() => JobsModule)],
  controllers: [AvaReportsController],
  providers: [AvaReportsService]
})
export class AvaReportsModule {}
