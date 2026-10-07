import type { Access, ClientUser, FieldAccess, PayloadRequest } from 'payload'

type MemberRole = 'active' | 'board'
type UserWithRole = {
  id?: number | string
  role?: MemberRole | null
}

const getRole = (user: UserWithRole | null | undefined): MemberRole | undefined => {
  const role = user?.role

  return role === 'active' || role === 'board' ? role : undefined
}

export const isBoardMember = (user: UserWithRole | null | undefined): boolean =>
  getRole(user) === 'board'

export const isActiveMember = (user: UserWithRole | null | undefined): boolean =>
  getRole(user) === 'active'

export const board: Access = ({ req: { user } }) => isBoardMember(user)

export const boardAdminAccess = ({ req: { user } }: { req: PayloadRequest }): boolean =>
  isBoardMember(user)

export const boardAdminHidden = ({ user }: { user: ClientUser }): boolean => !isBoardMember(user)

export const boardFieldAccess: FieldAccess = ({ req: { user } }) => isBoardMember(user)

export const boardOrSelf: Access = ({ req: { user } }) => {
  if (isBoardMember(user)) return true
  if (!user) return false

  return {
    id: {
      equals: user.id,
    },
  }
}

export const boardOrPublished: Access = ({ req: { user } }) => {
  if (isBoardMember(user)) return true

  return {
    _status: {
      equals: 'published',
    },
  }
}

export const boardOrOwnAttendance: Access = ({ req: { user } }) => {
  if (isBoardMember(user)) return true
  if (!user || !isActiveMember(user)) return false

  return {
    user: {
      equals: user.id,
    },
  }
}

export const memberAdminAccess = ({ req: { user } }: { req: PayloadRequest }): boolean =>
  isBoardMember(user) || isActiveMember(user)
