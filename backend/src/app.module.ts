import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { AuthGuard } from './common/guards/auth.guard'
import { ApiResultInterceptor } from './common/interceptors/api-result.interceptor'
import { AuthModule } from './auth/auth.module'
import { PrismaModule } from './prisma/prisma.module'
import { SpacesModule } from './spaces/spaces.module'
import { WorksModule } from './works/works.module'
import { ProjectionsModule } from './projections/projections.module'
import { CommentsModule } from './comments/comments.module'
import { AggregatesModule } from './aggregates/aggregates.module'
import { UploadsModule } from './uploads/uploads.module'
import { DiagnosticsModule } from './diagnostics/diagnostics.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 安全审计 C-2：全局接口限流，60 秒内最多 60 次请求
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PrismaModule,
    AuthModule,
    SpacesModule,
    WorksModule,
    ProjectionsModule,
    CommentsModule,
    AggregatesModule,
    UploadsModule,
    DiagnosticsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: ApiResultInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
