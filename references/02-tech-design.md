# 技术方案：邀请码准入机制

## 问题陈述

小程序为个人开发，仅服务于部分朋友。需要在后端对入口用户做定向拦截，确保只有持有邀请码的新用户才能注册使用，已有用户不受影响。

## 解决方案

在登录接口（`POST /auth/login`）增加邀请码验证逻辑。新用户必须提供有效的一次性邀请码才能完成注册；已有用户自动豁免。管理员可通过 API 生成邀请码。

## 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    前端 (Taro)                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  登录页                                          │   │
│  │  - 微信登录按钮                                   │   │
│  │  - 邀请码输入框（条件显示）                         │   │
│  │  - 错误提示（INVITE_CODE_REQUIRED/INVALID/...）    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    后端 (NestJS)                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  AuthController                                  │   │
│  │  POST /auth/login { code, inviteCode? }          │   │
│  └─────────────────────────────────────────────────┘   │
│                           │                             │
│                           ▼                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │  AuthService.login()                             │   │
│  │  1. code2session → openid                        │   │
│  │  2. 查找 UserIdentity                            │   │
│  │  3. IF 新用户:                                    │   │
│  │     - 检查 inviteCode 参数                        │   │
│  │     - 验证邀请码有效性                             │   │
│  │     - 创建 User + 标记邀请码已使用                  │   │
│  │  4. 创建 Session → 返回 token                     │   │
│  └─────────────────────────────────────────────────┘   │
│                           │                             │
│                           ▼                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │  AdminController (新增)                          │   │
│  │  POST /admin/invites { count? }                  │   │
│  │  - 校验用户角色为 admin                            │   │
│  │  - 生成一次性邀请码                                │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    数据库 (MySQL)                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │  user 表 (新增 role 字段)                         │   │
│  │  invite_code 表 (新增)                            │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 数据模型变更

### User 模型新增字段

```prisma
model User {
  id        BigInt   @id @default(autoincrement()) @db.UnsignedBigInt
  nickname  String?  @db.VarChar(64)
  avatarUrl String?  @map("avatar_url") @db.VarChar(512)
  role      String   @default("user") @db.VarChar(16)  // 新增：'user' | 'admin'
  createdAt DateTime @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.DateTime(3)

  // ... 现有 relations ...
  inviteCodesCreated InviteCode[] @relation("InviteCreator")
  inviteCodesUsed    InviteCode[] @relation("InviteUser")

  @@map("user")
}
```

### 新增 InviteCode 模型

```prisma
model InviteCode {
  id        BigInt    @id @default(autoincrement()) @db.UnsignedBigInt
  code      String    @unique @db.VarChar(8)  // 6-8 位短码
  createdBy BigInt    @map("created_by") @db.UnsignedBigInt
  usedBy    BigInt?   @map("used_by") @db.UnsignedBigInt
  expiresAt DateTime  @map("expires_at") @db.DateTime(3)
  createdAt DateTime  @default(now()) @map("created_at") @db.DateTime(3)

  creator User  @relation("InviteCreator", fields: [createdBy], references: [id])
  user    User? @relation("InviteUser", fields: [usedBy], references: [id])

  @@index([code], name: "idx_code")
  @@index([expiresAt], name: "idx_expires")
  @@map("invite_code")
}
```

---

## 接口设计

### 1. 登录接口变更

**POST /auth/login**

请求：
```typescript
{
  code: string           // 微信登录 code（必填）
  inviteCode?: string    // 邀请码（新用户必填）
}
```

成功响应：
```typescript
{
  code: 0,
  message: "ok",
  data: {
    token: string,
    user: UserDto
  }
}
```

错误响应：

| 错误码 | HTTP Status | message | 场景 |
|--------|-------------|---------|------|
| `INVITE_CODE_REQUIRED` | 403 | 邀请码是新用户注册的必要条件 | 新用户未提供邀请码 |
| `INVITE_CODE_INVALID` | 400 | 邀请码无效 | 邀请码不存在 |
| `INVITE_CODE_EXPIRED` | 400 | 邀请码已过期 | 邀请码超过 24 小时 |
| `INVITE_CODE_USED` | 400 | 邀请码已被使用 | 邀请码已被其他用户使用 |

### 2. 管理接口（新增）

**POST /admin/invites**

请求头：
```
Authorization: Bearer <token>
```

请求体：
```typescript
{
  count?: number  // 生成数量，可选，默认 1，最大 20
}
```

成功响应：
```typescript
{
  code: 0,
  message: "ok",
  data: {
    invites: string[]  // 生成的邀请码列表
  }
}
```

错误响应：

| 错误码 | HTTP Status | message | 场景 |
|--------|-------------|---------|------|
| `ADMIN_REQUIRED` | 403 | 仅管理员可操作 | 用户角色不是 admin |

---

## 实施决策

### 1. AuthService.login 修改

**位置**：`backend/src/auth/auth.service.ts`

**逻辑变更**：

```typescript
async login(code: string, inviteCode?: string): Promise<SessionDto> {
  const { openid, unionid, sessionKey } = await this.wechat.code2session(code)

  let identity = await this.prisma.userIdentity.findUnique({
    where: { uk_provider_openid: { provider: 'wechat', openid } },
  })

  let user: User
  let isNewUser = false

  if (!identity) {
    // 新用户：需要邀请码
    isNewUser = true
    if (!inviteCode) {
      throw new ForbiddenException('INVITE_CODE_REQUIRED')
    }
    // 验证并使用邀请码
    await this.validateAndUseInviteCode(inviteCode)
    // 创建用户
    user = await this.prisma.user.create({ data: { nickname: null, avatarUrl: null } })
    identity = await this.prisma.userIdentity.create({
      data: { userId: user.id, provider: 'wechat', openid, unionid },
    })
  } else {
    // 老用户：自动豁免
    user = await this.prisma.user.findUniqueOrThrow({ where: { id: identity.userId } })
    if (unionid && identity.unionid !== unionid) {
      await this.prisma.userIdentity.update({ where: { id: identity.id }, data: { unionid } })
    }
  }

  // 创建 session
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 864e5)
  await this.prisma.session.create({ data: { token, userId: user.id, sessionKey, expiresAt } })

  return { token, user: userToDto(user) }
}
```

### 2. 邀请码验证方法

**位置**：`backend/src/auth/auth.service.ts`

```typescript
private async validateAndUseInviteCode(code: string): Promise<void> {
  const invite = await this.prisma.inviteCode.findUnique({ where: { code } })

  if (!invite) {
    throw new BadRequestException('INVITE_CODE_INVALID')
  }
  if (invite.usedBy) {
    throw new BadRequestException('INVITE_CODE_USED')
  }
  if (invite.expiresAt < new Date()) {
    throw new BadRequestException('INVITE_CODE_EXPIRED')
  }

  // 标记为已使用（在创建用户后会设置 usedBy）
  // 注意：实际使用时在事务中设置 usedBy
}
```

### 3. 邀请码生成方法

**位置**：`backend/src/auth/auth.service.ts`

```typescript
async generateInviteCodes(userId: number, count: number = 1): Promise<string[]> {
  // 校验管理员权限
  const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
  if (user.role !== 'admin') {
    throw new ForbiddenException('ADMIN_REQUIRED')
  }

  const codes: string[] = []
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 小时后过期

  for (let i = 0; i < count; i++) {
    const code = this.generateRandomCode()
    await this.prisma.inviteCode.create({
      data: {
        code,
        createdBy: userId,
        expiresAt,
      },
    })
    codes.push(code)
  }

  return codes
}

private generateRandomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const length = 6 + Math.floor(Math.random() * 3) // 6-8 位
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
```

### 4. AuthController 修改

**位置**：`backend/src/auth/auth.controller.ts`

```typescript
@Public()
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Post('login')
login(@Body() dto: LoginDto) {
  return this.authService.login(dto.code, dto.inviteCode)
}
```

### 5. LoginDto 修改

**位置**：`backend/src/auth/dto.ts`

```typescript
export class LoginDto {
  @IsString()
  @IsNotEmpty()
  code: string

  @IsOptional()
  @IsString()
  @MaxLength(8)
  inviteCode?: string
}
```

### 6. AdminController 新增

**位置**：`backend/src/auth/admin.controller.ts`（新文件）

```typescript
import { Body, Controller, Post } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { AuthUser } from '../common/decorators/current-user.decorator'
import { AuthService } from './auth.service'
import { GenerateInviteDto } from './dto'

@Controller('admin')
export class AdminController {
  constructor(private readonly authService: AuthService) {}

  @Post('invites')
  generateInvites(@CurrentUser() user: AuthUser, @Body() dto: GenerateInviteDto) {
    return this.authService.generateInviteCodes(user.id, dto.count ?? 1)
  }
}
```

### 7. GenerateInviteDto 新增

**位置**：`backend/src/auth/dto.ts`

```typescript
export class GenerateInviteDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  count?: number
}
```

### 8. AuthModule 修改

**位置**：`backend/src/auth/auth.module.ts`

```typescript
import { Module } from '@nestjs/common'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { AdminController } from './admin.controller'
import { WechatService } from './wechat.service'

@Module({
  controllers: [AuthController, AdminController],
  providers: [AuthService, WechatService],
  exports: [AuthService],
})
export class AuthModule {}
```

---

## 测试接缝 & 测试决策

### 测试接缝位置

**核心接缝：`AuthService.login` 方法**

这是整个邀请码机制的关键边界。测试应验证：
- 外部行为（返回结果、错误码）
- 数据库交互（用户创建、邀请码标记）

### 测试决策

| 测试场景 | 测试类型 | 验证点 |
|----------|----------|--------|
| 老用户登录（豁免） | 单元测试 | 不检查邀请码，正常返回 token |
| 新用户无邀请码 | 单元测试 | 返回 INVITE_CODE_REQUIRED |
| 新用户有效邀请码 | 单元测试 | 创建用户，标记邀请码已使用，返回 token |
| 新用户无效邀请码 | 单元测试 | 返回 INVITE_CODE_INVALID |
| 新用户过期邀请码 | 单元测试 | 返回 INVITE_CODE_EXPIRED |
| 新用户已使用邀请码 | 单元测试 | 返回 INVITE_CODE_USED |
| 管理员生成邀请码 | 单元测试 | 返回邀请码列表，数据库有记录 |
| 非管理员生成邀请码 | 单元测试 | 返回 ADMIN_REQUIRED |

### 现有测试参照

- `backend/src/auth/auth.service.spec.ts` — 现有登录测试模式
- `backend/src/spaces/spaces.service.spec.ts` — 现有权限测试模式

### Mock 策略

```typescript
// 新增 mock
const makePrisma = (overrides: Record<string, any> = {}) =>
  ({
    // ... 现有 mock ...
    inviteCode: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    ...overrides,
  }) as any
```

---

## 改动范围表

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `backend/prisma/schema.prisma` | 修改 | User 新增 role 字段，新增 InviteCode 模型 |
| `backend/src/auth/auth.service.ts` | 修改 | login 方法增加 inviteCode 参数，新增验证/生成方法 |
| `backend/src/auth/auth.controller.ts` | 修改 | login 方法传递 inviteCode 参数 |
| `backend/src/auth/dto.ts` | 修改 | LoginDto 增加 inviteCode，新增 GenerateInviteDto |
| `backend/src/auth/auth.module.ts` | 修改 | 注册 AdminController |
| `backend/src/auth/admin.controller.ts` | 新增 | 管理接口 |
| `backend/src/auth/auth.service.spec.ts` | 修改 | 新增邀请码相关测试 |
| `backend/src/types/api.ts` | 无变更 | 现有类型已满足 |
| 前端 | 无变更 | 本期仅后端改动 |

---

## 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 邀请码被暴力枚举 | 低（6-8 位短码，空间足够大） | 登录接口已有限流（10 次/分钟） |
| 邀请码过期后清理 | 低（数据量小） | 可选：定时任务清理过期邀请码 |
| 管理员权限误操作 | 中（无法生成邀请码） | 手动在数据库设置 role='admin' |
| 前端需要审批 | 中（功能上线延迟） | 本期仅后端改动，前端可后续迭代 |

---

## Out of Scope

以下功能不在本期范围内：

- 前端管理页面（邀请码增删查）
- 邀请码统计/使用记录查看
- 批量导入/导出邀请码
- 邀请码有效期自定义（固定 24 小时）
- 邀请码多次使用（固定一次性）
- 手机号/邮箱验证
- 微信群验证（shareTicket 机制）
- 邀请码过期自动清理任务

---

## 拆分策略

### 后端（本期）

1. **数据模型**：Prisma schema 变更 + migration
2. **AuthService**：login 方法修改 + 邀请码验证/生成方法
3. **AdminController**：新增管理接口
4. **测试**：邀请码相关单元测试

### 前端（后续迭代）

1. 登录页增加邀请码输入框
2. 错误提示处理
3. 管理页面（可选）
