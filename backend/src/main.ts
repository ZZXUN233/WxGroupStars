import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

// Prisma 返回 BigInt id，JSON 序列化需转 number（MVP 量级远未超安全整数范围）
;(BigInt.prototype as any).toJSON = function () {
  return Number(this)
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  // API 通过独立域名 gs.zzxun.cn 提供，接口直接使用根路径。
  app.enableCors({
    origin: [
      'https://gs.zzxun.cn',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
    ],
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
