import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GroupsModule } from './groups/groups.module';
import { AvaReportsModule } from './ava-reports/ava-reports.module';
import { AvaSyncModule } from './ava-sync/ava-sync.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { SystemModule } from './system/system.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { AcademicModule } from './academic/academic.module';

@Module({
  imports: [
    DbModule,
    AuthModule,
    UsersModule,
    GroupsModule,
    AvaReportsModule,
    AvaSyncModule,
    SystemModule,
    SchedulingModule,
    AcademicModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
