# ADR-0007: 互动模型——独立可 toggle + 冗余计数 + 软保留联动

## 状态
已接受

## 背景
作品互动包含点赞、评论、收藏。互动按"投影"隔离（各群独立计数），
且投影可被作者撤销（软保留，重新投影时数据复活）。需要定义互动的幂等性、
计数策略与软删除的联动。

## 决策
- **点赞/收藏幂等**：同一 `(user_id, projection_id)` 只能点赞/收藏一次，
  再次触发 = 取消（toggle）。在 likes/collects 表加 `UNIQUE(user_id, projection_id)`。
- **冗余计数**：projection 表冗余 `like_count / comment_count / collect_count`，
  写入时在后端事务中原子自增/自减（`UPDATE projection SET like_count=like_count+1`），
  展示直接读取，避免实时 COUNT。
- **软保留联动**：撤销投影 = 将投影置为 inactive（软删），其互动行保留在库中；
  重新投影 = 投影恢复 active，其互动数据（含各成员点赞/评论/收藏记录）随之可见，
  计数同样恢复。
- **评论**：单独模型，`comments(projection_id, user_id, content, parent_id, ...)`，
  支持回复（parent_id）与 @（附 mention 字段）。评论计数也计入冗余列。

## 后果
- 互动数据干净、计数准确、幂等；撤销/复活数据不丢。
- 点赞/收藏的 toggle 需在事务里同时维护唯一约束与冗余计数，注意并发下的
  原子性（用 `INSERT ... ON DUPLICATE KEY` 或先查后写 + 索引兜底）。
- 冗余计数与真实记录行的一致性需靠事务保证；若未来量级极大，可引入异步对账。
