import { UploadsService } from './uploads.service'

describe('UploadsService', () => {
  const config: any = {
    getOrThrow: jest.fn((k: string) =>
      ({ COS_BUCKET: 'zzx-wxgs-1251818151', COS_SECRET_ID: 'AKID-test', COS_SECRET_KEY: 'secret-key' })[k],
    ),
    get: jest.fn((k: string, d: unknown) =>
      k === 'COS_BASE_URL' ? 'https://zzx-wxgs-1251818151.cos.ap-guangzhou.myqcloud.com/' : d,
    ),
  }
  const svc = new UploadsService(config)

  it('生成 works/{userId}/ 前缀 key + 完整表单签名字段', () => {
    const r = svc.presign(7, 'photo.jpg')
    expect(r.key).toMatch(/^works\/7\/\d+-[0-9a-f]{8}\.jpg$/)
    expect(r.url).toBe('https://zzx-wxgs-1251818151.cos.ap-guangzhou.myqcloud.com/')
    expect(r.fields.key).toBe(r.key)
    expect(r.fields['q-sign-algorithm']).toBe('sha1')
    expect(r.fields['q-ak']).toBe('AKID-test')
    expect(r.fields['q-sign-time']).toMatch(/^\d+;\d+$/)
    expect(r.fields['q-signature']).toMatch(/^[0-9a-f]{40}$/)
    // policy 约束到本用户目录，防复用覆盖他人对象
    expect(Buffer.from(r.fields.policy, 'base64').toString('utf8')).toContain('works/7/')
  })

  it('拒绝白名单外扩展名与无扩展名', () => {
    expect(() => svc.presign(7, 'virus.exe')).toThrow('不支持的媒体类型')
    expect(() => svc.presign(7, 'noext')).toThrow('不支持的媒体类型')
  })

  it('大小写扩展名归一为小写', () => {
    const r = svc.presign(7, 'video.MP4')
    expect(r.key.endsWith('.mp4')).toBe(true)
  })
})
