import { Module } from '@nestjs/common';
import { TutoriaController } from './tutoria.controller';
import { TutoriaService } from './tutoria.service';
import { TutoriaSyncService } from './tutoria-sync.service';
import { DbModule } from '../db/db.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [DbModule, CacheModule],
  controllers: [TutoriaController],
  providers: [TutoriaService, TutoriaSyncService],
  exports: [TutoriaService, TutoriaSyncService],
})
export class TutoriaModule {}
