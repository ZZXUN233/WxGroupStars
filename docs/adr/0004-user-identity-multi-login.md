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
