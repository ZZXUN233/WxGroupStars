import { PrismaClient } from '@prisma/client'

/** 批量取「我是否已点赞」集合（ADR-0007 幂等 toggle + 冗余计数） */
export async function likedProjectionIds(
  prisma: PrismaClient,
  projectionIds: Array<number | bigint>,
  userId: number,
): Promise<Set<number>> {
  if (!projectionIds.length) return new Set()
  const rows = await prisma.like.findMany({
    where: { projectionId: { in: projectionIds as any }, userId },
    select: { projectionId: true },
  })
  return new Set(rows.map((r) => Number(r.projectionId)))
}
