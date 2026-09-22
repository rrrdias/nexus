import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_ACADEMIC_SYNC, QUEUE_AVA_SYNC } from './jobs.constants';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { AcademicSyncProcessor } from './processors/academic-sync.processor';
import { AvaSyncProcessor } from './processors/ava-sync.processor';
import { AcademicModule } from '../academic/academic.module';
import { AvaSyncModule } from '../ava-sync/ava-sync.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          retryStrategy: (times: number) => {
            return Math.min(times * 1000, 10000);
          },
        },
      }),
    }),
    BullModule.registerQueue(
      {
        name: QUEUE_ACADEMIC_SYNC,
      },
      {
        name: QUEUE_AVA_SYNC,
      },
    ),
    forwardRef(() => AcademicModule),
    forwardRef(() => AvaSyncModule),
  ],
  controllers: [JobsController],
  providers: [JobsService, AcademicSyncProcessor, AvaSyncProcessor],
  exports: [JobsService, BullModule],
})
export class JobsModule {}
