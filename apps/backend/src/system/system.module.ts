import { Module } from '@nestjs/common';
import { SystemService } from './system.service';
import { SystemController } from './system.controller';
import { DbModule } from '../db/db.module';

@Module({
  imports: [DbModule],
  providers: [SystemService],
  controllers: [SystemController]
})
export class SystemModule {}
