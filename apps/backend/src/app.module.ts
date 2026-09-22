import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GroupsModule } from './groups/groups.module';
import { AvaReportsModule } from './ava-reports/ava-reports.module';
import { AvaSyncModule } from './ava-sync/ava-sync.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RbacGuard } from './auth/rbac.guard';
import { SystemModule } from './system/system.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { AcademicModule } from './academic/academic.module';
import { JobsModule } from './jobs/jobs.module';
import { HealthModule } from './health/health.module';
import { CacheModule } from './cache/cache.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DbModule,
    CacheModule,
    AuthModule,
    UsersModule,
    GroupsModule,
    AvaReportsModule,
    AvaSyncModule,
    SystemModule,
    SchedulingModule,
    AcademicModule,
    JobsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RbacGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
