import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    SpacesModule,
    WorksModule,
    ProjectionsModule,
    CommentsModule,
    AggregatesModule,
    UploadsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: ApiResultInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
