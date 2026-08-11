# ADR-0017: 昵称头像使用微信「头像昵称填写」能力

## 状态
已接受

## 背景
微信 code2session 登录只返回 openid/session_key，自 2021 年起不再静默下发昵称与头像；
新小程序必须由用户主动授权。此前系统所有用户（dev 与真实）的 nickname/avatarUrl 均为
NULL，作品/评论/成员列表等处只能显示占位，且前端按非空处理、直接 `nickname.slice(0,1)`
会导致渲染崩溃。

## 决策
- **微信官方「头像昵称填写」**：编辑资料页用 `button open-type="chooseAvatar"` 选头像、
  `input type="nickname"` 输昵称，调已有 `PATCH /auth/profile` 保存——后端接口早已预留，
  前端补齐调用。
- **昵称与头像一起更新（不锁定）**：微信不提供静默获取真实昵称，但 `input type="nickname"`
  昵称键盘可一键填入最新微信昵称。编辑资料页昵称输入框始终可用，用户聚焦后用「微信昵称」
  按钮填入最新昵称，与头像一起 `PATCH /auth/profile` 保存，随时可再同步——微信昵称变更后
  再次进入即可更新。产品层不做"首次设置后锁定"。
- **头像直传 COS 复用 ADR-0005**：选中临时文件先 `getPresign + uploadToCos` 直传，落库
  COS 完整 URL（与发布媒体一致）。
- **后端语义修正**：`updateProfile` 中 avatarUrl 传 `null` 明确清除头像（此前 `?? undefined`
  把 null 也吞成 undefined，清不掉）。
- **NULL 兜底**：`User.nickname` 类型改为 `string | null`；新增 `displayName()`（未设置时
  显示「微信用户」）与 `initial()`（占位首字「微」），全部展示点统一接入，杜绝崩溃。
- 登录后不自动弹授权；入口在个人星轨页「编辑资料」，未设置昵称时星轨页顶部显示引导
  banner，设置后 `refreshUser()` 刷新全局用户态。

## 后果
- 昵称头像由用户主动维护，未设置时全端统一显示占位，不再崩溃。
- 依赖微信基础库的 chooseAvatar/nickname 能力（已支持基础库 2.21.2+，满足小程序最低版本）。
- 头像经 COS 存储，沿用既有上传/鉴权链路，无新增后端存储。
