# ADR-0012: 数据访问层用 Prisma ORM

## 状态
已接受

## 背景
ADR-0003 定了后端 NestJS + MySQL，但数据访问层未定。候选有 Prisma、TypeORM、
Knex/裸 SQL。这是有"换起来要一个季度"的技术锁定决策。

## 决策
- 数据访问层用 **Prisma ORM**：schema 驱动、类型安全、迁移工具成熟。
- `schema.prisma` 与 `docs/schema.md` 对齐，作为表结构的单一事实来源。
- NestJS 侧通过 PrismaService 注入，复杂原生 SQL 用 `$queryRaw` 兜底。

## 后果
- 实体由 schema 生成、非装饰器风格，与 NestJS 惯用的 TypeORM 风格不同，需引入
  prisma generate 步骤；换来迁移可靠性与端到端类型安全。
- 不再引入 TypeORM/Knex 双写，避免两套访问模式并存。
