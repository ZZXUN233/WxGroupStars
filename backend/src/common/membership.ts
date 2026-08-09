import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

/** 群成员校验（ADR-0006 封闭性）：非成员或已退群一律拒绝 */
export async function requireMember(prisma: PrismaClient, userId: number, spaceId: number | bigint) {
  const member = await prisma.member.findUnique({
    where: { uk_space_user: { spaceId, userId } },
  })
  if (!member || !member.isActive) throw new ForbiddenException('你不是该群空间的成员')
  return member
}

/** 群空间存在且启用 */
export async function requireActiveSpace(prisma: PrismaClient, spaceId: number) {
  const space = await prisma.space.findUnique({ where: { id: spaceId } })
  if (!space || !space.isActive) throw new NotFoundException('群空间不存在')
  return space
}
