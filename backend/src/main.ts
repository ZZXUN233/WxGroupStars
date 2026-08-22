import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

// Prisma 返回 BigInt id，JSON 序列化需转 number（MVP 量级远未超安全整数范围）
;(BigInt.prototype as any).toJSON = function () {
  return Number(this)
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  // 与前端契约 BASE_URL 对齐（https://api.zzxun.cn/group-stars）
  app.setGlobalPrefix('group-stars')
  app.enableCors({
    origin: ['https://gs.zzxun.cn'],
    credentials: true,
  })
  app.getHttpAdapter().get('/health', (_request, response) => {
    response.status(200).send({ status: 'ok' })
  })
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  )
  await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
