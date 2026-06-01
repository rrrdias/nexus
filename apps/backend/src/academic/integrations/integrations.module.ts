import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { AcademicModule } from '../academic.module';
import { DbModule } from '../../db/db.module';

@Module({
  imports: [DbModule, AcademicModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
