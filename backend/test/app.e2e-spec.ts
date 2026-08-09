import { ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from './../src/app.module'

describe('App (e2e)', () => {
  let app: INestApplication<App>

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('group-stars')
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('未登录访问受保护接口 → 401 统一错误包裹', () => {
    return request(app.getHttpServer())
      .get('/group-stars/spaces/mine')
      .expect(401)
      .expect({ code: 401, message: '未登录', data: null })
  })

  it('登录缺 code → 400 校验错误', () => {
    return request(app.getHttpServer())
      .post('/group-stars/auth/login')
      .send({})
      .expect(400)
      .expect((res) => {
        expect(res.body.code).toBe(400)
        expect(res.body.data).toBeNull()
      })
  })
})
