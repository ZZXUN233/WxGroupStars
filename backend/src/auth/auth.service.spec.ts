import { AuthService } from './auth.service'

describe('AuthService', () => {
  const openid = 'openid-abc'
  const unionid = 'unionid-xyz'

  const makePrisma = (overrides: Record<string, any> = {}) =>
    ({
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      userIdentity: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      session: {
        create: jest.fn(),
      },
      ...overrides,
    }) as any

  const makeWechat = () => ({
    code2session: jest.fn().mockResolvedValue({ openid, unionid, sessionKey: '' }),
    decryptGroupInfo: jest.fn(),
  }) as any

  describe('login', () => {
    it('新用户：创建 user + identity + session，返回 token 与 user', async () => {
      const prisma = makePrisma()
      const wechat = makeWechat()
      prisma.userIdentity.findUnique.mockResolvedValue(null)
      prisma.user.create.mockResolvedValue({ id: 1n, nickname: null, avatarUrl: null })
      prisma.userIdentity.create.mockResolvedValue({ id: 10n, userId: 1n, provider: 'wechat', openid, unionid })
      prisma.session.create.mockResolvedValue({ token: 'tok-1', userId: 1n })

      const svc = new AuthService(prisma, wechat)
      const result = await svc.login('code-1')

      expect(wechat.code2session).toHaveBeenCalledWith('code-1')
      expect(prisma.user.create).toHaveBeenCalled()
      expect(prisma.userIdentity.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { userId: 1n, provider: 'wechat', openid, unionid } }),
      )
      expect(prisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 1n }) }),
      )
      expect(result.token).toBeTruthy()
      // 空昵称兜底为 星友<id>（userToDto 归一）
      expect(result.user).toEqual({ id: 1, nickname: '星友1', avatarUrl: null })
    })

    it('老用户：不重建 identity；unionid 变化时补写', async () => {
      const prisma = makePrisma()
      const wechat = makeWechat()
      prisma.userIdentity.findUnique.mockResolvedValue({ id: 10n, userId: 1n, unionid: 'old-unionid' })
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 1n, nickname: '张三', avatarUrl: null })
      prisma.userIdentity.update.mockResolvedValue({ id: 10n, userId: 1n, unionid })
      prisma.session.create.mockResolvedValue({ token: 'tok-2', userId: 1n })

      const svc = new AuthService(prisma, wechat)
      const result = await svc.login('code-2')

      expect(prisma.user.create).not.toHaveBeenCalled()
      expect(prisma.userIdentity.update).toHaveBeenCalledWith({ where: { id: 10n }, data: { unionid } })
      expect(result.user.nickname).toBe('张三')
    })
  })

  describe('groupInfo', () => {
    it('透传 sessionKey 与入参给解密，返回 openGid（ADR-0008）', async () => {
      const wechat = makeWechat()
      wechat.decryptGroupInfo.mockResolvedValue({ openGId: 'oh-group-A' })
      const svc = new AuthService(makePrisma(), wechat)

      const result = await svc.groupInfo('real-session-key', { shareTicket: 'ticket-1', encryptedData: 'ed', iv: 'iv1' })

      expect(wechat.decryptGroupInfo).toHaveBeenCalledWith('real-session-key', 'ticket-1', 'ed', 'iv1')
      expect(result).toEqual({ openGid: 'oh-group-A' })
    })
  })

  describe('me', () => {
    it('返回当前用户最新资料（昵称/头像）', async () => {
      const prisma = makePrisma()
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 1n, nickname: '最新昵称', avatarUrl: 'http://a/z.png' })

      const svc = new AuthService(prisma, makeWechat())
      const result = await svc.me(1)

      expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 1 } })
      expect(result).toEqual({ id: 1, nickname: '最新昵称', avatarUrl: 'http://a/z.png' })
    })
  })

  describe('updateProfile', () => {
    it('更新昵称/头像并返回 UserDto', async () => {
      const prisma = makePrisma()
      prisma.user.update.mockResolvedValue({ id: 1n, nickname: '新昵称', avatarUrl: 'http://a/x.png' })

      const svc = new AuthService(prisma, makeWechat())
      const result = await svc.updateProfile(1, { nickname: '新昵称', avatarUrl: 'http://a/x.png' })

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { nickname: '新昵称', avatarUrl: 'http://a/x.png' },
      })
      expect(result).toEqual({ id: 1, nickname: '新昵称', avatarUrl: 'http://a/x.png' })
    })
  })
})
