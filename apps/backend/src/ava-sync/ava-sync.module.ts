import { Module } from '@nestjs/common';
import { AvaSyncController } from './ava-sync.controller';
import { AvaSyncService } from './ava-sync.service';

@Module({
  controllers: [AvaSyncController],
  providers: [AvaSyncService],
  exports: [AvaSyncService]
})
export class AvaSyncModule {}
