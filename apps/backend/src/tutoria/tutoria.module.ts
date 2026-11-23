import { Module } from '@nestjs/common';
import { TutoriaController } from './tutoria.controller';
import { TutoriaService } from './tutoria.service';
import { TutoriaSyncService } from './tutoria-sync.service';
import { TutoriaTeologiaController } from './tutoria-teologia.controller';
import { TutoriaTeologiaService } from './tutoria-teologia.service';
import { DbModule } from '../db/db.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [DbModule, CacheModule],
  controllers: [TutoriaController, TutoriaTeologiaController],
  providers: [TutoriaService, TutoriaSyncService, TutoriaTeologiaService],
  exports: [TutoriaService, TutoriaSyncService, TutoriaTeologiaService],
})
export class TutoriaModule {}
