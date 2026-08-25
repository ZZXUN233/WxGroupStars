# 需求确认单：邀请码准入机制

## 背景

小程序为个人开发，仅服务于部分朋友。需要在后端对入口用户做定向拦截，确保只有持有邀请码的新用户才能注册使用，已有用户不受影响。

---

## 用户故事

| ID | 角色 | 希望 | 以便 |
|----|------|------|------|
| US-01 | 未授权用户 | 打开小程序时看到友善提示，告知需要邀请码 | 了解如何获得使用权限 |
| US-02 | 未授权用户 | 在登录页面输入邀请码完成注册 | 获得使用小程序的权限 |
| US-03 | 管理员（你） | 通过 API 生成一次性邀请码 | 分享给朋友让他们注册使用 |
| US-04 | 管理员（你） | 管理接口仅限管理员调用 | 防止邀请码被滥用 |
| US-05 | 已有用户 | 启用机制后自动获得豁免，无需重新操作 | 继续正常使用小程序 |
| US-06 | 管理员（你） | 邀请码 24 小时后自动失效 | 控制邀请码的有效期 |

---

## 功能点清单

| ID | 功能点 | 优先级 | 涉及模块 |
|----|--------|--------|----------|
| F-01 | User 模型新增 `role` 字段 | P0 | 后端 (Prisma Schema) |
| F-02 | 新增 InviteCode 数据模型 | P0 | 后端 (Prisma Schema) |
| F-03 | 登录接口支持邀请码参数 | P0 | 后端 (Auth Module) |
| F-04 | 管理接口：生成邀请码 | P1 | 后端 (Auth/Admin Module) |
| F-05 | 管理员角色守卫 | P1 | 后端 (Common/Guards) |
| F-06 | 前端登录页增加邀请码输入 | P1 | 前端 (Auth/Page) |
| F-07 | 前端未授权提示页 | P2 | 前端 (Auth/Page) |
| F-08 | 邀请码定时清理任务 | P2 | 后端 (Scheduler) |

---

## 边界条件 & 异常场景

| 场景 | 预期行为 |
|------|----------|
| 未授权用户不输入邀请码直接登录 | 返回错误：`INVITE_CODE_REQUIRED`，前端展示邀请码输入界面 |
| 邀请码已使用 | 返回错误：`INVITE_CODE_USED`，提示"该邀请码已被使用" |
| 邀请码已过期（>24h） | 返回错误：`INVITE_CODE_EXPIRED`，提示"该邀请码已过期" |
| 邀请码不存在 | 返回错误：`INVITE_CODE_INVALID`，提示"邀请码无效" |
| 已有用户登录 | 正常登录，不受邀请码机制影响（豁免） |
| 管理员调用生成接口但未登录 | 返回 401 未授权 |
| 非管理员调用生成接口 | 返回 403 禁止访问 |
| 邀请码格式错误（长度/字符不对） | 返回 400 参数错误 |

---

## 非功能需求

- **安全性**：邀请码为 6-8 位字母数字混合，单次使用，24 小时过期
- **兼容性**：已有用户自动豁免，无需任何操作
- **可维护性**：管理接口仅限管理员角色调用，便于后续扩展管理页面
- **前端改动最小化**：前端需过微信审批，改动应尽量精简

---

## 实施决策

### 数据模型变更

**User 模型新增字段：**
```prisma
model User {
  id        BigInt   @id @default(autoincrement())
  nickname  String?  @db.VarChar(64)
  avatarUrl String?  @map("avatar_url") @db.VarChar(512)
  role      String   @default("user") @db.VarChar(16)  // 新增：'user' | 'admin'
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
}
```

**新增 InviteCode 模型：**
```prisma
model InviteCode {
  id        BigInt   @id @default(autoincrement())
  code      String   @unique @db.VarChar(8)  // 6-8位短码
  createdBy BigInt   @map("created_by")      // 创建者（管理员）
  usedBy    BigInt?  @map("used_by")         // 使用者（可为 null）
  expiresAt DateTime @map("expires_at")      // 过期时间（创建后 24h）
  createdAt DateTime @default(now()) @map("created_at")

  creator   User     @relation(fields: [createdBy], references: [id])
  user      User?    @relation(fields: [usedBy], references: [id])
}
```

### 登录流程变更

**原流程：**
```
POST /auth/login { code } → { token, user }
```

**新流程：**
```
POST /auth/login { code, inviteCode? } 
  ├─ 用户已存在（豁免） → { token, user }
  ├─ inviteCode 为空 → { code: 403, message: "INVITE_CODE_REQUIRED" }
  ├─ inviteCode 无效/过期/已使用 → { code: 400, message: "INVITE_CODE_INVALID/EXPIRED/USED" }
  └─ inviteCode 有效 → 创建用户 + 标记邀请码已使用 → { token, user }
```

### 管理接口

```
POST /admin/invites
Headers: Authorization: Bearer <user_token>
Body: { "count": 5 }  // 可选，默认生成 1 个

Response: { code: 0, data: { invites: ["A3Bx7K", "B2Cy8L", ...] } }
```

**权限要求：**
- 用户必须已登录
- 用户 `role` 必须为 `admin`

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

---

## 需求疑问（待确认）

| 状态 | 问题 | 回复 |
|------|------|------|
| ✅ 已确认 | 拦截层级 | 应用级，登录接口拦截 |
| ✅ 已确认 | 白名单标识 | 邀请码，一次性使用，24 小时过期 |
| ✅ 已确认 | 管理方式 | REST API，仅管理员可调用 |
| ✅ 已确认 | 未授权体验 | 友善提示 + 邀请码输入 |
| ✅ 已确认 | 邀请码格式 | 6-8 位短码，字母数字混合 |
| ✅ 已确认 | 邀请码生命周期 | 一次性，24 小时过期 |
| ✅ 已确认 | 已有用户处理 | 自动豁免 |
| ✅ 已确认 | 管理员鉴权 | 基于用户角色字段 |
| ✅ 已确认 | 登录流程 | 邀请码作为登录的一部分 |
