# ADR-0004: 用户身份建模——自建 id 主键 + 多登录方式绑定

## 状态
已接受

## 背景
产品要求"必须是微信登录的用户本人"。同时前端用 Taro，未来可能多端编译（如 H5）。
微信 openid 仅在微信小程序端可稳定获取，H5 端没有 openid。若以 openid 直接作为
用户主键，跨端会遇到"同一人多端标识不同"的问题。

## 决策
- **user 表**以自建自增 `id` 为主键，承载中立用户身份，含 nickname/avatar 等资料。
- 另建 **登录方式绑定表**（如 `user_identity` / `user_auth`），以 `(provider, openid)`
  唯一，指向 `user.id`。一个用户可绑定多种登录方式（微信 openid、未来 H5 邮箱/手机等）。
- 微信登录走 code2session 拿 openid，落到绑定表；后端生成**自定义 session token**
  （JWT 或随机 token 存缓存），后端鉴权以 `user.id` 为准。

## 后果
- openid 从"用户主键"降级为"一种登录标识"，为多端与多登录方式预留了空间。
- 需要额外的绑定表与"openid → user.id"的一次查询映射（可按 openid 建立索引缓存）。
- 作者页/星轨/互动归属统一用 `user.id`，与具体登录方式解耦。

## 补充：会话 token 采用不透明随机 token
- 登录成功后，后端生成**不透明随机 token**（随机串），存会话表/缓存（含 `user_id`、
  有效期），前端随请求携带，后端查表校验；鉴权以 `user.id` 为准。
- 选它而非 JWT：MVP 是单实例自建后端，无分布式无状态需求；查一次表即可换取
  **可随时吊销**与无密钥管理负担。JWT 的无状态优势在此用不上。
- 存储可先落 DB 会话表（MVP），量级上来再迁 Redis/缓存。

## 补充：与 auth-center 统一认证的渐进策略（MVP 独立，预留归并缝）
- MVP 由本后端**自行 code2session**（拿 `openid` + `session_key`）。`session_key` 是
  门禁登录（ADR-0008，解密 shareTicket 取 openGId）的必要凭证，必须留在本后端。
- `user_identity` 现在即落 `openid` + **`unionid`**：`unionid` 是跨应用/跨端归并用户
  身份的唯一键（openid 按 appid 隔离，不可跨项目复用）。
- **V2 集成项**：给 auth-center 新增"小程序登录"provider（以 unionid 归并到其 User、
  发 OAuth token）；本后端校验 token 后按 `authCenterId` 映射本地 user（届时本地 user
  表增加 `auth_center_id` 字段）。前提：小程序需绑定微信开放平台主体以获取 unionid。
- MVP 明确不依赖 auth-center 的可用性。
