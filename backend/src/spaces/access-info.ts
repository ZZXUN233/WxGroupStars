import type { SpaceDto, UserDto } from '../types/api'

export type SpaceAccessState = 'active' | 'pending' | 'rejected' | 'none'

export interface SpaceAccessInfoDto {
  space: Pick<SpaceDto, 'id' | 'name' | 'coverUrl' | 'creatorId' | 'createdAt'>
  owner: UserDto
  state: SpaceAccessState
}
