import { SetMetadata } from '@nestjs/common'

/** 标记接口免鉴权（如登录接口） */
export const IS_PUBLIC_KEY = 'isPublic'
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
