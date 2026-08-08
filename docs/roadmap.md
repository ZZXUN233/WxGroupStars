# 《群星闪耀》实现路线图（Roadmap）

> 由 `/grill-with-docs` 会话收敛而成。设计决策均已固化为 ADR；本文档是它们的地图与实现顺序。
> 版本：MVP 规划（2026-08-08）

## 一、已确认的设计决策（索引）

### 身份与访问
- [ADR-0001](adr/0001-self-owned-space-id-not-opengid.md) 自建 spaceId 主键，openGId 仅去重；owner=创建者 + 手动转让（MVP）
- [ADR-0004](adr/0004-user-identity-multi-login.md) 用户自建 id + 多登录绑定；不透明随机 token；**MVP 独立 code2session，unionid 落位，auth-center 统一为 V2**
- [ADR-0006](adr/0006-closed-group-space-access-control.md) 群空间完全封闭，非成员不可见；分享卡片中性标题
- [ADR-0008](adr/0008-group-context-join-gate.md) 群上下文门禁加入；作者退群投影保留；治理 MVP 范围
- [ADR-0010](adr/0010-membership-filtered-aggregates.md) 跨群聚合按成员资格过滤；搜索为群内作用域

### 内容与生命周期
- [ADR-0002](adr/0002-projection-live-entity-soft-retain.md) 投影活实体 + 互动软保留；时间轴按投影时间、日历切片
- [ADR-0005](adr/0005-cos-media-storage.md) COS 存储；图片 1–9 张 / 音视频单文件 / 封面必填
- [ADR-0009](adr/0009-work-editable-soft-deletable.md) 作品可编辑 + 软删，媒体保留
- [ADR-0014](adr/0014-content-safety-review.md) 内容安全：文本同步 + 图片异步，违规隐藏不删

### 互动
- [ADR-0007](adr/0007-interaction-model-idempotent-count.md) 点赞/收藏幂等 + 冗余计数；评论两级；删除权=本人+作者；收藏/通知 V2

### 技术栈与部署
- [ADR-0003](adr/0003-self-hosted-backend-taro.md) Taro + NestJS + MySQL，不用微信云开发
- [ADR-0012](adr/0012-prisma-data-access.md) Prisma ORM
- [ADR-0013](adr/0013-docker-compose-self-hosted-deploy.md) Docker Compose 自建云服务器 + HTTPS，备案尽早启动

### 术语表
- [CONTEXT.md](../CONTEXT.md) 11 个术语；Schema 见 [docs/schema.md](schema.md)

## 二、MVP 范围

**必须做**：微信登录 · 创建/加入群空间 · 发布作品（5 类）· 时间轴（日历切片）· 群内搜索 · 点赞 · 两级评论 · 编辑/软删作品 · 投影追加/撤销 · owner 转让 · 星轨 · 最新星光 · 成员名单 · 内容安全审核 · 分享。

**明确不做（V2）**：收藏 · 通知 · 跨群搜索 · 解散空间 · auth-center 统一身份 · AI 分类/标签 · 年度群报告 · 音视频审核。

**V3（远景）**：AI 群助手 · 群文化档案 · 创作者成长体系。

## 三、实现顺序（前端先行 + Mock）

用户已确认 **先从前端开始**，接口契约先行、用 mock 数据支撑：

1. **前端基础**：Taro 骨架、路由、全局状态、请求封装（指向 mock 适配层）。
2. **接口契约**：按领域建模产出 TS 类型（Space/Work/Projection/Member/Comment/Like/Collect + 分页 + 错误码），后端按此实现。
3. **Mock 层**：mock 服务返回契约数据（内存实现 + 简单延迟），可切换真实 API。
4. **页面**：首页（我的群 + 最新星光）→ 群空间（时间轴）→ 作品详情（点赞/评论）→ 发布/编辑 → 星轨 → 群内搜索 → 创建/加入群空间。
5. **后端对接**：契约落地 NestJS + Prisma（ADR-0012），切换 mock → 真实 API。

## 四、遗留实现级细节（不阻塞开发，落地时定）

- 会话过期/刷新、分页、内容审核降级策略、STS 签发、微信头像昵称填写、隐私保护指引、错误码/日志
- openGId 首次绑定触发的端到端联调
- 小程序绑定微信开放平台主体（V2 统一身份的前置，可提前办）
