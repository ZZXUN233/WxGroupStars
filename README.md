# 群星闪耀 (Group Stars)

《群星闪耀》是一款微信小程序产品，为微信群构建「作品沉淀社区」。用户在群空间中提交作品，其他成员对作品进行点赞、评论、收藏，形成群体的内容沉淀与成长记录。微信负责关系、传播与互动，本产品负责记录、整理、展示与成长。

- **技术栈**：Taro 4 + React 微信小程序（前端）、NestJS 11 + Prisma 6 + MySQL（后端）
- **部署方式**：自建云服务器，Docker Compose + Nginx + HTTPS（ADR-0013）
- **架构取向**：作品本体（Work）跨群唯一，与群内投影（Projection）解耦；互动计数挂投影，实现「一次创作、多点沉淀」的领域模型

---

## 目录

- [核心概念](#核心概念)
- [功能特性](#功能特性)
- [项目结构](#项目结构)
- [技术架构](#技术架构)
- [快速开始](#快速开始)
  - [环境要求](#环境要求)
  - [后端](#后端)
  - [前端](#前端)
- [环境变量](#环境变量)
- [部署](#部署)
- [测试与验证](#测试与验证)
- [设计决策（ADR）](#设计决策adr)
- [路线图](#路线图)
- [相关文档](#相关文档)

---

## 核心概念

> 完整术语表见 [CONTEXT.md](./CONTEXT.md)。

| 术语 | 说明 |
| --- | --- |
| **群空间 (Group Space)** | 一个微信群对应一个独立作品空间，成员在此提交和浏览作品 |
| **作品 (Work)** | 用户创作、被系统沉淀的核心实体。仅含标题、作者、内容/封面、类型、标签、发布时间，跨群一致，不含互动计数 |
| **投影 (Projection)** | 作品在某个群空间的「软链接」。一个作品可投到多个群空间，每个投影独立持有点赞/评论/收藏数 |
| **成员 (Member)** | 通过群内分享入口加入群空间的用户，一个用户可属于多个群空间 |
| **待审核成员 (Pending Member)** | 提交了加入申请、尚未被 owner/admin 审核的用户（ADR-0018） |
| **个人分享 (Personal Share)** | 作者将作品本体（不带群投影）发给他人观看的通道，与投影通道完全隔离 |
| **成员管理 (Member Management)** | owner/admin 对空间成员的治理入口：审核待审核成员、指定/撤销 admin、踢出成员 |
| **发布 (Publish)** | 创建作品本体，并指定要展示到的若干群空间，形成该作品的投影 |
| **草稿 (Draft)** | 尚未投影到任何群空间的作品本体，仅作者可见 |
| **星轨 (Star Trail)** | 作者个人的作品档案主页，展示作品数量、分类分布与最近作品 |
| **最新星光 (Star Feed)** | 首页跨群展示「用户已加入的各群空间」最新投影的信息流 |
| **时间轴 (Timeline)** | 按时间展示群体创作历史的视图，支持今日/本周/本月/年度切片 |

---

## 功能特性

**已实现（MVP 核心）：**

- 微信登录（自建用户 + 多登录绑定，ADR-0004）
- 群空间创建 / 通过分享卡片加入（群上下文门禁，ADR-0008）
- 成员审核与成员管理（owner/admin 治理，ADR-0018）
- 作品发布 / 编辑 / 软删，支持 5 类作品：文字、图片、音视频、技术、外部链接
- 群内投影：一次发布可投到多个群空间，独立持有互动数据（ADR-0002）
- 时间轴（今日/本周/本月/年度日历切片）
- 群内搜索（群作用域，ADR-0010）
- 点赞（幂等 toggle + 冗余计数，ADR-0007）
- 两级扁平评论（评论 + 一级回复，支持回复 @用户）
- 作品草稿箱
- 星轨（作者作品档案，跨群去重）
- 最新星光（首页信息流）
- 内容安全审核（文本同步 + 图片异步，违规隐藏不删，ADR-0014）
- 个人分享 / 群内邀请链接

**V2 规划中**：收藏、通知、跨群搜索、解散空间、auth-center 统一身份、AI 分类/标签、年度群报告。

---

## 项目结构

```text
WxGroupStars/
├── backend/               # NestJS 11 API 服务
│   ├── src/
│   │   ├── auth/          # 认证（微信登录、会话）
│   │   ├── spaces/        # 群空间、成员、门禁加入
│   │   ├── works/         # 作品、草稿、个人分享
│   │   ├── projections/   # 群内投影
│   │   ├── comments/      # 两级评论
│   │   ├── likes/         # 点赞
│   │   ├── uploads/       # COS 媒体上传（预签名）
│   │   ├── aggregates/    # 跨群聚合（星轨 / 最新星光 / 时间轴）
│   │   ├── diagnostics/   # 健康检查 / 诊断
│   │   ├── prisma/        # Prisma Client 注入
│   │   └── common/        # 守卫、过滤器、拦截器、工具
│   ├── prisma/schema.prisma
│   └── Dockerfile
├── frontend/              # Taro 4 + React 微信小程序
│   └── src/
│       ├── pages/         # 首页/星轨/群空间/发布/搜索/草稿等 11 个页面
│       ├── api/           # HTTP 封装与业务 API
│       ├── store/         # 全局状态
│       ├── components/    # 作品卡片、评论列表、Markdown 等
│       └── types/         # 前后端契约 TS 类型
├── nginx/                 # Nginx 反代配置（H5 小程序 API 域名）
├── docs/                  # 需求、schema、路线图、验证、ADR
├── docker-compose.yml     # 自建部署编排
├── deploy.sh              # 部署脚本（构建 / 启动 / 日志等）
├── deploy_update.sh       # 镜像构建 + 推送脚本
├── CONTEXT.md             # 领域术语表（单一事实来源）
└── DEPLOYMENT.md          # 部署说明
```

---

## 技术架构

### 领域模型：作品本体与投影解耦

产品围绕「一次创作、多点沉淀」设计，核心是**作品本体（Work）与群内投影（Projection）的分离**：

- **Work** 跨群唯一，代表作者的创作本体，不含任何互动计数。
- **Projection** 是作品在某个群空间的软链接，独立持有该群内的点赞数、评论数、收藏数。
- 对投影的互动不影响作品本体，也不影响其他群的投影（ADR-0002 / ADR-0007）。

数据模型图与字段说明见 [docs/schema.md](./docs/schema.md)。

### 后端架构

- NestJS 11 模块化分层：`auth / spaces / works / projections / comments / likes / aggregates` 等业务模块。
- Prisma 6 数据访问（ADR-0012），MySQL 存储，BIGINT UNSIGNED 主键，统一 `{ code, message, data }` 响应契约。
- 统一鉴权守卫（`AuthGuard`）、异常过滤器、API 结果拦截器。
- COS 媒体存储：上传走预签名直传 COS（ADR-0005），图片 1–9 张、音视频单文件、封面必填。

### 前端架构

- Taro 4 + React 18，面向微信小程序（可扩展 H5/多端）。
- 页面级路由 + 全局状态（`store`），HTTP 封装支持登录兜底与并发去重。
- 前后端契约 TS 类型集中在 `frontend/src/types`，与后端实现对齐。

---

## 快速开始

### 环境要求

- Node.js（建议 18+）
- MySQL 8（远程或本机均可）
- 微信开发者工具（用于运行小程序）
- Docker（仅自建部署时需要）

### 后端

```bash
cd backend
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，至少配置 DATABASE_URL

# 应用数据库 schema（Prisma）
npx prisma db push

# 开发模式（监听 :3000）
npm run start:dev
```

### 前端

```bash
cd frontend
npm install

# 开发模式，构建微信小程序（watch）
npm run dev:weapp

# 产物输出到 frontend/dist，用微信开发者工具导入 frontend/ 目录
```

> 本地联调：后端默认监听 `http://localhost:3000`，前端开发环境默认访问本地后端；微信开发者工具需勾选「不校验合法域名」。生产将通过 `TARO_APP_BASE_URL` 注入正式域名。

---

## 环境变量

### 后端（`backend/.env`，从 `.env.example` 复制）

| 变量 | 说明 | 必需 |
| --- | --- | --- |
| `DATABASE_URL` | MySQL 连接串，如 `mysql://user:password@host:3306/wgs` | ✅ |
| `PORT` | API 端口，默认 `3000` | |
| `WX_APPID` / `WX_SECRET` | 微信小程序凭据；未配置时进入 dev 模式（固定 dev 身份） | |
| `DEV_OPENID` | dev 模式固定身份 | |
| `COS_SECRET_ID` / `COS_SECRET_KEY` | COS 媒体存储凭据 | 使用上传时 |
| `COS_BUCKET` / `COS_REGION` / `COS_BASE_URL` | COS 桶、地域、访问域名 | 使用上传时 |

### 前端

| 变量 | 说明 |
| --- | --- |
| `TARO_APP_ENV` | 环境标识（local / production） |
| `TARO_APP_BASE_URL` | 后端 API 根地址，如 `https://gs.zzxun.cn` |

---

## 部署

自建云服务器 + Docker Compose + Nginx + HTTPS（ADR-0013）。完整步骤见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

**一键部署脚本：**

```bash
./deploy.sh start             # 拉取镜像并启动 API 容器
./deploy.sh frontend-h5       # 构建 H5 并发布到 Nginx 静态目录
./deploy.sh frontend-weapp    # 构建微信小程序产物
./deploy.sh health            # 健康检查
./deploy_update.sh v1.0.0     # 构建并推送指定版本镜像
```

- 后端以 Docker 容器运行，镜像 `zzxun.cn:5000/group-stars-api:latest`，宿主机端口默认 `3007` → 容器 `3000`。
- Nginx 反代：`gs.zzxun.cn`（微信小程序 API），HTTPS + HSTS。
- 服务器需准备 `backend/.env`，其中 `DATABASE_URL` 为必需项。

---

## 测试与验证

```bash
# 后端单测（mappers / auth / spaces / wechat 解密等）
cd backend && npm test -- --runInBand

# 后端 e2e（未登录 401、非法入参 400）
cd backend && npm run test:e2e -- --runInBand

# 后端构建
cd backend && npm run build

# 前端构建
cd frontend && npm run build:weapp
```

业务验证全流程（含分享拉新、群上下文门禁端到端冒烟）见 [docs/verification.md](./docs/verification.md)。

---

## 设计决策（ADR)

本项目的关键架构决策均以 ADR 形式固化在 [docs/adr](./docs/adr) 目录，主要包括：

| ADR | 决策 |
| --- | --- |
| [0001](./docs/adr/0001-self-owned-space-id-not-opengid.md) | 自建 spaceId 主键，openGId 仅去重 |
| [0002](./docs/adr/0002-projection-live-entity-soft-retain.md) | 投影活实体 + 互动软保留 |
| [0003](./docs/adr/0003-self-hosted-backend-taro.md) | 自建后端 + Taro（不用微信云开发） |
| [0004](./docs/adr/0004-user-identity-multi-login.md) | 用户自建 id + 多登录绑定 |
| [0005](./docs/adr/0005-cos-media-storage.md) | COS 媒体存储 |
| [0006](./docs/adr/0006-closed-group-space-access-control.md) | 群空间完全封闭，非成员不可见 |
| [0007](./docs/adr/0007-interaction-model-idempotent-count.md) | 点赞/收藏幂等 + 冗余计数 |
| [0008](./docs/adr/0008-group-context-join-gate.md) | 群上下文门禁加入 |
| [0009](./docs/adr/0009-work-editable-soft-deletable.md) | 作品可编辑 + 软删 |
| [0010](./docs/adr/0010-membership-filtered-aggregates.md) | 跨群聚合按成员资格过滤 |
| [0012](./docs/adr/0012-prisma-data-access.md) | Prisma ORM |
| [0013](./docs/adr/0013-docker-compose-self-hosted-deploy.md) | Docker Compose 自建部署 + HTTPS |
| [0014](./docs/adr/0014-content-safety-review.md) | 内容安全审核 |
| [0016](./docs/adr/0016-lightweight-markdown-rendering.md) | 轻量 Markdown 渲染 |
| [0017](./docs/adr/0017-wechat-avatar-nickname.md) | 微信头像昵称 |
| [0018](./docs/adr/0018-member-approval-and-work-share.md) | 成员审核 + 作品分享 |

---

## 路线图

- **MVP（当前）**：微信登录、群空间、发布（5 类作品）、时间轴、群内搜索、点赞、两级评论、编辑/软删、星轨、最新星光、成员管理、内容安全、分享。
- **V2**：收藏、通知、跨群搜索、解散空间、auth-center 统一身份、AI 分类/标签、年度群报告。
- **V3（远景）**：AI 群助手、群文化档案、创作者成长体系。

实现地图与顺序详见 [docs/roadmap.md](./docs/roadmap.md)。

---

## 相关文档

- [CONTEXT.md](./CONTEXT.md) — 领域术语表（单一事实来源）
- [DEPLOYMENT.md](./DEPLOYMENT.md) — 部署与运维
- [docs/schema.md](./docs/schema.md) — 数据模型
- [docs/roadmap.md](./docs/roadmap.md) — 路线图与实现地图
- [docs/verification.md](./docs/verification.md) — 业务验证全流程
- [docs/adr](./docs/adr) — 架构决策记录
- 需求文档：`docs/群星-需求文档.html`
