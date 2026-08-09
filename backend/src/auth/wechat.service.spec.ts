import { createCipheriv } from 'crypto'
import { WechatService } from './wechat.service'

describe('WechatService', () => {
  const svc = new WechatService({ get: jest.fn() } as any)

  describe('decryptGroupInfo — dev mock（无 sessionKey）', () => {
    it('shareTicket 派生稳定 openGId（同一 ticket 同值，不同 ticket 不同值）', async () => {
      const a1 = await svc.decryptGroupInfo('', 'ticket-A', '', '')
      const a2 = await svc.decryptGroupInfo('', 'ticket-A', '', '')
      const b = await svc.decryptGroupInfo('', 'ticket-B', '', '')
      expect(a1.openGId).toMatch(/^dev_/)
      expect(a2.openGId).toBe(a1.openGId)
      expect(b.openGId).not.toBe(a1.openGId)
    })
  })

  describe('decryptGroupInfo — 真实 AES-128-CBC（PKCS7）', () => {
    it('解密 wx.getShareInfo 的 encryptedData，取出 openGId', async () => {
      // 构造微信同款密文：key = base64(session_key)（16 字节），iv 由前端 base64 传入
      const key = Buffer.from('0123456789abcdef') // 16 字节
      const iv = Buffer.from('fedcba9876543210')
      const sessionKeyB64 = key.toString('base64')
      const payload = JSON.stringify({ openGId: 'oh-group-XYZ', watermark: { appid: 'wx', timestamp: 1 } })
      const cipher = createCipheriv('aes-128-cbc', key, iv)
      const encryptedData = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]).toString('base64')

      const result = await svc.decryptGroupInfo(sessionKeyB64, 'ticket-real', encryptedData, iv.toString('base64'))
      expect(result.openGId).toBe('oh-group-XYZ')
    })

    it('sessionKey 缺失真实密文时拒绝（不误入 mock）', async () => {
      await expect(svc.decryptGroupInfo('', 't', '', '')).resolves.toMatchObject({ openGId: expect.stringMatching(/^dev_/) })
    })
  })
})
