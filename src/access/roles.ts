import { User } from '@/payload-types'
import type { Access, ClientUser, FieldAccess, PayloadRequest } from 'payload'

type UserWithRole = {
  id?: number | string
  role?: User['role'] | null
}

const getRole = (user: UserWithRole | null | undefined): User['role'] | undefined => {
  const role = user?.role

  return role
}

export const isBoardMember = (user: UserWithRole | null | undefined): boolean =>
  (user && getRole(user) )? [ 'Președinte',
        'Vicepreședinte',
        'Secretar',
        'Trezorier',
        'PM Director',
        'PR Director',
        'IR Director',
        'HR Director',
        'board',
        'Past-President'].includes(getRole(user)!) : false

export const isActiveMember = (user: UserWithRole | null | undefined): boolean =>
  getRole(user) === 'Membru Activ'

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
