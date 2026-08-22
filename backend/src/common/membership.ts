import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import type { MemberStatus } from '../types/api'

/**
 * 群成员校验（ADR-0006 封闭性）：仅 status=active 且未退群的正式成员可通过。
 * pending（待审核）/rejected（已被拒）/已退出一律拒绝 —— 成员资格以 status 为准。
 */
export async function requireMember(prisma: PrismaClient, userId: number, spaceId: number | bigint) {
  const member = await prisma.member.findUnique({
    where: { uk_space_user: { spaceId, userId } },
  })
  if (!member || !member.isActive || (member.status && member.status !== 'active')) throw new ForbiddenException('你不是该群空间的成员')
  return member
}

/** 群空间存在且启用 */
export async function requireActiveSpace(prisma: PrismaClient, spaceId: number) {
  const space = await prisma.space.findUnique({ where: { id: spaceId } })
  if (!space || !space.isActive) throw new NotFoundException('群空间不存在')
  return space
}

/**
 * 结构化访问拒绝（ADR-0018）：非成员按准入状态区分，前端据此渲染「无权限页」。
 * 异常体携带 state 字段，由 AllExceptionsFilter 透传（code 仍对齐 HTTP 403）。
 */
export function memberForbidden(state: Exclude<MemberStatus, 'active'> | 'none'): ForbiddenException {
  const message =
    state === 'pending'
      ? '申请审核中，请等待群主审核'
      : state === 'rejected'
        ? '申请已被拒绝，可重新申请'
        : '你尚未加入该群空间'
  return new ForbiddenException({ message, state })
}
