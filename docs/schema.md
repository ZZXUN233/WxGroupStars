# 《群星闪耀》MySQL Schema

技术栈：Node.js (TS) 后端 + MySQL。所有表使用 InnoDB，UTF8MB4 字符集。
所有 id 用 BIGINT UNSIGNED 自增。时间用 DATETIME(3)。

## 表清单
`user` / `user_identity` / `space` / `member` / `work` / `projection` /
`comment` / `like` / `collect`

---

### 1. user 用户（自建 id 主键）
对应 ADR-0004。用户中立身份，可绑定多种登录方式。
```sql
CREATE TABLE `user` (
  `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `nickname`    VARCHAR(64)  DEFAULT NULL COMMENT '昵称（微信资料）',
  `avatar_url`  VARCHAR(512) DEFAULT NULL COMMENT '头像（微信资料/cos?）',
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2. user_identity 登录方式绑定
对应 ADR-0004。openid 只是"一种登录标识"，一个 user 可绑定多种。
```sql
CREATE TABLE `user_identity` (
  `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id`     BIGINT UNSIGNED NOT NULL,
  `provider`    VARCHAR(16)  NOT NULL COMMENT 'wechat / h5 / sms...',
  `openid`      VARCHAR(128) NOT NULL COMMENT '微信 openid 等外部标识',
  `unionid`     VARCHAR(128) DEFAULT NULL COMMENT '跨应用归并键（未来接 auth-center 统一身份用）',
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY `uk_provider_openid` (`provider`,`openid`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
> 索引：按 openid 快速找 user（登录时用）。

### 3. space 群空间（自建 spaceId 主键）
对应 ADR-0001。openGId 仅辅助去重，非主键。
```sql
CREATE TABLE `space` (
  `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`        VARCHAR(64)  NOT NULL COMMENT '群名（创建者手动填）',
  `creator_id`  BIGINT UNSIGNED NOT NULL COMMENT '创建者 user.id',
  `open_gid`    VARCHAR(128) DEFAULT NULL COMMENT '微信 openGId，仅辅助去重（非主键）',
  `cover_url`   VARCHAR(512) DEFAULT NULL COMMENT '群空间封面',
  `is_active`   TINYINT(1) NOT NULL DEFAULT 1 COMMENT '软删除',
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                ON UPDATE CURRENT_TIMESTAMP(3),
  KEY `idx_open_gid` (`open_gid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 4. member 群成员（openid↔space）
对应 ADR-0006（封闭性用它在读接口校验）、ADR-0008（群上下文门禁加入）。
投影到某群 = 作者须先加入该群。
```sql
CREATE TABLE `member` (
  `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `space_id`    BIGINT UNSIGNED NOT NULL,
  `user_id`     BIGINT UNSIGNED NOT NULL,
  `role`        VARCHAR(16) NOT NULL DEFAULT 'member'
                              COMMENT 'member / admin / owner',
  `joined_at`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_active`   TINYINT(1) NOT NULL DEFAULT 1 COMMENT '软删除（退出群）',
  UNIQUE KEY `uk_space_user` (`space_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
> 加入方式：群内打开分享卡片（shareTicket→openGId 命中该空间）自动加入；创建者即 owner。

### 5. work 作品本体（跨群唯一）
对应 PRD 7.3、ADR-0009（可编辑/软删）、ADR 单表+类型枚举。不含互动计数（属于投影）。
```sql
CREATE TABLE `work` (
  `id`             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `author_id`      BIGINT UNSIGNED NOT NULL COMMENT '作者 user.id',
  `title`          VARCHAR(128) NOT NULL,
  `type`           ENUM('text','image','audio_video','tech','external')
                   NOT NULL COMMENT '作品类型',
  `text_content`   MEDIUMTEXT DEFAULT NULL COMMENT '文字作品正文',
  `media_url`      VARCHAR(512) DEFAULT NULL COMMENT '图片：COS key 数组json(1-9张)；音视频：单 key；配合ADR-0005',
  `tech_code`      MEDIUMTEXT DEFAULT NULL COMMENT '技术作品：代码/方案',
  `external_link`  VARCHAR(512) DEFAULT NULL COMMENT '外部作品：链接',
  `cover_url`      VARCHAR(512) DEFAULT NULL COMMENT '封面图 COS key（必填；未传默认取第一张图片）',
  `tags`           JSON DEFAULT NULL COMMENT '标签数组（MVP 作者手填 ≤5；AI 自动分类 V2）',
  `review_status` VARCHAR(16) NOT NULL DEFAULT 'pass'
                              COMMENT '内容审核(ADR-0014)：pass/pending/fail（图片异步审核）',
  `is_active`      TINYINT(1) NOT NULL DEFAULT 1 COMMENT '软删：0=作品被删除，隐藏全部投影',
  `created_at`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                 ON UPDATE CURRENT_TIMESTAMP(3),
  KEY `idx_author` (`author_id`),
  KEY `idx_type`   (`type`),
  FULLTEXT KEY `ft_title_content` (`title`,`text_content`) /* 可选，搜索 */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 6. projection 群内投影 + 冗余计数
对应 ADR-0002（可增删/软保留）、ADR-0007（交互计数冗余列）。
软保留：撤投影 = `is_active=0`；重新投影 = `is_active=1`，互动复用。
```sql
CREATE TABLE `projection` (
  `id`              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `work_id`         BIGINT UNSIGNED NOT NULL,
  `space_id`        BIGINT UNSIGNED NOT NULL,
  `author_id`       BIGINT UNSIGNED NOT NULL COMMENT '冗余作者，便于按投影查',
  `is_active`       TINYINT(1) NOT NULL DEFAULT 1 COMMENT '0=撤销(软)',
  `like_count`      INT UNSIGNED NOT NULL DEFAULT 0,
  `comment_count`   INT UNSIGNED NOT NULL DEFAULT 0,
  `collect_count`   INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                    ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY `uk_work_space` (`work_id`,`space_id`),
  KEY `idx_space_active` (`space_id`,`is_active`,`created_at`) /* 群内时间轴 */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
> `is_active` 用于时间轴/列表过滤，软保留的互动随投影复活复用。

### 7. comment 评论
对应 ADR-0007（挂 projection 隔离，两级结构：评论 + 一级回复）、ADR-0002。
```sql
CREATE TABLE `comment` (
  `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `projection_id` BIGINT UNSIGNED NOT NULL,
  `user_id`       BIGINT UNSIGNED NOT NULL,
  `content`       TEXT NOT NULL,
  `parent_id`     BIGINT UNSIGNED DEFAULT NULL COMMENT '所属评论 id（一级回复统一挂评论，不嵌套）',
  `reply_to_user_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '@的目标 user.id',
  `is_active`     TINYINT(1) NOT NULL DEFAULT 1 COMMENT '软删除',
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY `idx_projection` (`projection_id`,`is_active`,`created_at`),
  KEY `idx_parent`    (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 8. like 点赞（幂等 + toggle）
对应 ADR-0007。唯一约束实现幂等；重复点 = 删除行（toggle）。
```sql
CREATE TABLE `like` (
  `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `projection_id` BIGINT UNSIGNED NOT NULL,
  `user_id`       BIGINT UNSIGNED NOT NULL,
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY `uk_proj_user` (`projection_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 9. collect 收藏（群内收藏，挂投影）
对应 ADR-0007 + 收藏挂投影决策。
```sql
CREATE TABLE `collect` (
  `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `projection_id` BIGINT UNSIGNED NOT NULL,
  `user_id`       BIGINT UNSIGNED NOT NULL,
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY `uk_proj_user` (`projection_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 10. session 会话（不透明随机 token）
对应 ADR-0004。MVP 落 DB 会话表，量级上来再迁 Redis/缓存。
```sql
CREATE TABLE `session` (
  `id`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `token`       VARCHAR(64) NOT NULL,
  `user_id`     BIGINT UNSIGNED NOT NULL,
  `expires_at`  DATETIME(3) NOT NULL,
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY `uk_token` (`token`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 冗余计数一致性（ADR-0007）
- 点赞/取消：事务内 `DELETE ... WHERE (proj,user)` + `UPDATE projection SET like_count`.
  （若靠 `INSERT ON DUPLICATE KEY` 区分 toggle，需前端传目标状态。）
- 评论新增/删除：同样维护 `projection.comment_count`。
- 软保留联动：撤投影（`is_active=0`）不删互动行；换代不重记数（计数仍在行上）。
