import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { commentToDto } from '../common/mappers'
import { requireMember } from '../common/membership'
import type { CommentDto, CreateCommentInput } from '../types/api'

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 投影需存在且可见（is_active + work.is_active） */
  private async visibleProjection(projectionId: number) {
    const p = await this.prisma.projection.findUnique({
      where: { id: projectionId },
      include: { work: true },
    })
    if (!p || !p.isActive || !p.work.isActive) throw new NotFoundException('作品不存在或已隐藏')
    return p
  }

  /** 两级扁平评论（ADR-0007）：顶层评论 + 一级回复 */
  async getByProjection(userId: number, projectionId: number): Promise<CommentDto[]> {
    const p = await this.visibleProjection(projectionId)
    await requireMember(this.prisma, userId, p.spaceId)

    const comments = await this.prisma.comment.findMany({
      where: { projectionId, isActive: true, parentId: null },
      include: {
        user: true,
        replyToUser: true,
        replies: {
          where: { isActive: true },
          include: { user: true, replyToUser: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    })
    return comments.map((c) => commentToDto(c, userId))
  }

  async create(userId: number, projectionId: number, input: CreateCommentInput): Promise<CommentDto> {
    const p = await this.visibleProjection(projectionId)
    await requireMember(this.prisma, userId, p.spaceId)

    const parentId = input.parentId ?? null
    if (parentId) {
      const parent = await this.prisma.comment.findFirst({
        where: { id: parentId, projectionId, isActive: true },
      })
      if (!parent) throw new BadRequestException('回复的评论不存在')
    }
    const replyToUserId = input.replyToUserId ?? null
    if (replyToUserId) {
      const target = await this.prisma.user.findUnique({ where: { id: replyToUserId } })
      if (!target) throw new BadRequestException('@ 的用户不存在')
    }

    const comment = await this.prisma.$transaction(async (tx) => {
      const c = await tx.comment.create({
        data: { projectionId, userId, content: input.content, parentId, replyToUserId },
        include: { user: true, replyToUser: true },
      })
      await tx.projection.update({
        where: { id: projectionId },
        data: { commentCount: { increment: 1 } },
      })
      return c
    })
    return commentToDto({ ...comment, replies: [] }, userId)
  }

  /** 删除评论：评论者本人或作品作者（ADR-0007），软删 is_active=0 */
  async remove(userId: number, commentId: number): Promise<null> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { projection: { include: { work: true } } },
    })
    if (!comment || !comment.isActive) throw new NotFoundException('评论不存在')

    const isMine = Number(comment.userId) === userId
    const isWorkAuthor = Number(comment.projection.work.authorId) === userId
    if (!isMine && !isWorkAuthor) throw new ForbiddenException('无权删除该评论')

    await this.prisma.$transaction([
      this.prisma.comment.update({ where: { id: commentId }, data: { isActive: false } }),
      this.prisma.projection.update({
        where: { id: comment.projectionId },
        data: { commentCount: { decrement: 1 } },
      }),
    ])
    return null
  }
}
