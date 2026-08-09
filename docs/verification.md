# 《群星闪耀》业务验证全流程

> 版本：MVP 联调（2026-08-09）
> 用途：本地/联调环境下，按业务旅程逐项验证前后端链路是否跑通。
> 数据模型见 [schema.md](schema.md)，实现地图见 [roadmap.md](roadmap.md)，门禁设计见 [ADR-0008](adr/0008-group-context-join-gate.md)。

## 〇、前置环境

| 项 | 要求 |
|---|---|
| 后端 | `cd backend && npm run build && node dist/main.js`，监听 `:3000` |
| 数据库 | 远程 MySQL（`backend/.env` 的 `DATABASE_URL`）；`npx prisma db push` 已应用 |
| 前端 | `cd frontend && npm run build:weapp`，微信开发者工具打开 `frontend/` |
| 开发者工具 | 详情 → 本地设置 → 勾选「不校验合法域名」 |
| 请求地址 | 前端 [http.ts](../frontend/src/api/http.ts) `BASE_URL = http://localhost:3000/group-stars` |

**统一响应契约**：所有接口返回 `{ code, message, data }`；`code=0` 成功，非 0 失败（`code` 即 HTTP 状态）。

---

## 一、自动验证（不依赖 UI）

在 `backend/` 下：

```bash
npm test        # 单测：28 个（mappers / auth / spaces / wechat 解密）
npm run test:e2e # e2e：未登录 401、非法入参 400
```

覆盖的关键用例：
- 用户 DTO 空昵称兜底为 `星友<id>`（[mappers.spec](../backend/src/common/mappers.spec.ts)）
- `decryptGroupInfo`：dev mock 稳定派生 / 真实 AES-128-CBC 自洽解密（[wechat.service.spec](../backend/src/auth/wechat.service.spec.ts)）
- `groupInfo` 透传 sessionKey 与入参（[auth.service.spec](../backend/src/auth/auth.service.spec.ts)）
- join 门禁：已绑定且不匹配 → Forbidden；未绑定首次群内打开 → 绑定 openGid + 加入（[spaces.service.spec](../backend/src/spaces/spaces.service.spec.ts)）

**门禁端到端冒烟**（临时脚本，跑完清理）：
创建空间 → 用户 A 从「群A」分享进入绑定 openGid → 用户 B 从「群B」进入被 403 拦截 → B 改用群A openGid 加入成功 → B 群外访问放行。**本次已跑通** ✅

---

## 二、手动业务旅程（按序点击验证）

### 1. 启动与登录
- 操作：打开小程序（或重新编译）
- 预期：无感自动登录。dev 模式用本机持久化 `gs_dev_uid` 当 code，后端 `openid=dev_<code>`；「我的」页显示 `星友N`（昵称为空兜底）
- 验证点：无登录失败提示；`gs_token` 已写入本地缓存

### 2. 创建群空间
- 操作：首页「＋ 创建群空间」→ 填名称（+可选封面）→ 提交
- 预期：空间出现在首页「我的群」，标记「我管理」（owner=创建者）；新空间 `memberCount=1, workCount=0`
- 验证点：**无需任何微信群 id**（ADR-0001，群名仅手动填写）

### 3. 发布作品（投影）
- 操作：空间页「＋」→ 选作品类型（text/image/audio_video/tech/external）→ 填内容/媒体 → 勾选目标群 → 发布
- 预期：后端事务建 work + 每群建 projection；空间时间轴与首页 feed 出现该作品
- 验证点：作者仅可投自己加入的群（非成员 403）；图片 mediaUrl 存 JSON 数组串（ADR-0005）

### 4. 时间轴切片
- 操作：空间页切 今日/本周/本月/年度
- 预期：按**投影时间**（projectedAt）过滤，日历口径（ADR-0002），倒序分页

### 5. 互动（点赞 / 评论）
- 操作：作品详情页点赞 → 再点取消；发评论 → 点评论回复
- 预期：点赞幂等 toggle，`likeCount` 同步；两级扁平评论（评论+一级回复）
- 验证点：回复他人评论带 `@昵称`；删除权=评论者本人或作品作者（ADR-0007）

### 6. 作者管理
- 操作：作品详情「管理」→ 编辑 / 追加到其他群 / 撤销本群投影 / 删除作品
- 预期：编辑仅作者；追加需目标群成员；撤销=软删（互动数据软保留，重新投影复活，ADR-0002/0009）；删除=隐藏全部投影
- 验证点：撤销后该群成员看不到，但「我的」仍可见（若在别的群投影）

### 7. 星轨
- 操作：「我的」tab，或点他人昵称进入
- 预期：创作类型分布 + 近期作品；仅统计**与查看者有共同群**的该作者投影（ADR-0010）
- 验证点：他人昵称空时显示 `星友N`，不报 `Cannot read property 'slice' of null`

### 8. 群内搜索 / 群成员
- 操作：空间页 🔍 搜关键词；底部看成员列表
- 预期：按标题/正文/标签/作者昵称，**仅本群作用域**；成员名单全员可见
- 验证点：owner 可改名、转让管理权（目标须为本群成员）

### 9. 封闭性（非成员不可见）
- 操作：用**第二个账号**（换设备/清缓存/换 devUid）直接访问某空间的作品详情 URL
- 预期：`403 你不是该群空间的成员`（ADR-0006）

---

## 三、分享拉新 / 群上下文门禁（专项）

### 链路
```
群空间页 / 作品详情页「分享」
   → 卡片 path 带 spaceId(+projectionId)
   → 群友在群聊点开 → App.onAppShow 拿 shareTicket
   → wx.getShareInfo 得密文
   → POST /auth/group-info 用会话 sessionKey 解出 openGId
   → joinSpace(spaceId, openGid) 门禁
        已绑定 openGid 且不匹配 → 403「请从该群的分享卡片进入」
        未绑定 → 首次群内打开时绑定（一群一空间）
   → reLaunch 到作品详情 / 群空间
```

### 验证场景
| # | 场景 | 操作 | 预期 |
|---|---|---|---|
| A | 新用户从群内打开 | 群内点分享卡片 | 自动加入并跳转目标页；空间成员+1 |
| B | 从「别的群」打开 | 用另一 shareTicket 进入已绑定空间 | `403 请从该群的分享卡片进入` |
| C | 已加入成员群外访问 | 成员直接打开空间/作品 URL | 放行（校验成员资格，非群上下文） |
| D | 首次绑定 | 新空间首次从群内打开 | 空间绑定该群 openGid，此后一群一空间 |

### 联调说明
- **dev 模式**：后端无 sessionKey 时，用 `shareTicket` 派生稳定 `openGid=dev_<sha256 前24位>`（[wechat.service](../backend/src/auth/wechat.service.ts)），同一 ticket 代表同一群，可测 A–D 全部分支。
- **真实部署**：配置 `WX_APPID/WX_SECRET` 后，登录存真实 sessionKey，解密走 AES-128-CBC（代码已实现，需真机验证微信侧密文）。
- `wx.getShareInfo` 失败时前端降级为不带 openGid 的加入（保联调畅通）。

---

## 四、联调边界与生产切换点

| 项 | 联调现状 | 生产需切 |
|---|---|---|
| 登录 | devUid 持久化 → `openid=dev_<code>` | `Taro.login()` + 真实 AppID/Secret（[api/index.ts](../frontend/src/api/index.ts) 已标注） |
| 群解密 | shareTicket 派生 mock openGid | 真实 AES（配凭据即走真分支） |
| 后端地址 | `http://localhost:3000/group-stars` | 真机改局域网 IP；上线 `https://api.zzxun.cn/group-stars` |
| 群名 | 手动填写（微信不开放群名，ADR-0001） | 同左 |
| 内容安全 | reviewStatus=pass 乐观直出（ADR-0014） | 接审核服务 |

## 五、本次已通过验证的记录

- [ ] 后端构建 + 28 单测 + e2e ✅
- [ ] 前端 weapp 构建 ✅
- [ ] 门禁端到端冒烟（绑定/拦截/放行/成员访问）✅（2026-08-09，数据已清理）
- [ ] 手动旅程 1–9：**待工具/真机复跑**
- [ ] 分享卡片群内打开 A–D：**待工具/真机复跑**（工具需勾选不校验域名；真机需改 BASE_URL 为局域网 IP）
