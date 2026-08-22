import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

// Prisma 返回 BigInt id，JSON 序列化需转 number（MVP 量级远未超安全整数范围）
;(BigInt.prototype as any).toJSON = function () {
  return Number(this)
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const logger = new Logger('Bootstrap')
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
  const port = process.env.PORT ?? 3000
  logger.log(
    `配置摘要: NODE_ENV=${process.env.NODE_ENV ?? 'undefined'}, PORT=${port}, ` +
    `DATABASE_URL=${databaseSummary(process.env.DATABASE_URL)}, ` +
    `WX_APPID=${process.env.WX_APPID ? '已配置' : '未配置'}, ` +
    `WX_SECRET=${process.env.WX_SECRET ? '已配置' : '未配置'}, ` +
    `DEV_OPENID=${process.env.DEV_OPENID ? '已配置' : '未配置'}, ` +
    `COS=${cosSummary()}`,
  )
  await app.listen(port)
  logger.log(`服务已启动: http://0.0.0.0:${port}`)
}

function databaseSummary(value: string | undefined): string {
  if (!value) return '未配置'
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.hostname}:${url.port || '默认端口'}${url.pathname}`
  } catch {
    return '格式无效'
  }
}

function cosSummary(): string {
  const configured = ['COS_SECRET_ID', 'COS_SECRET_KEY', 'COS_BUCKET', 'COS_REGION', 'COS_BASE_URL']
    .filter((name) => Boolean(process.env[name]))
  return configured.length ? `已配置(${configured.join(',')})` : '未配置'
}
bootstrap()
