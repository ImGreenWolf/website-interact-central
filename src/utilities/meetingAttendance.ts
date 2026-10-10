import type { Payload } from 'payload'

import type { Attendance, Meeting, User } from '@/payload-types'
import { canCalculateMeetingAbsences } from '@/utilities/meetingTime'

export const meetingAttendanceMemberRoles = ['Membru Activ'] satisfies NonNullable<User['role']>[]

type MeetingAttendanceRecord = Pick<Attendance, 'user'>
type MeetingWithTiming = Pick<Meeting, 'id' | 'meetingDate'>
type MeetingMember = Pick<User, 'id' | 'joinedAt'>

export type MeetingMemberAttendance = {
  memberId: string
  status: 'present' | 'absent'
}

export function getRelationId(value: string | { id: string }) {
  return typeof value === 'string' ? value : value.id
}

export function isMemberEligibleForMeeting(
  member: Pick<User, 'joinedAt'>,
  meeting: Pick<Meeting, 'meetingDate'>,
) {
  return new Date(member.joinedAt).getTime() <= new Date(meeting.meetingDate).getTime()
}

export function calculateMeetingMemberAttendance(args: {
  attendance: MeetingAttendanceRecord[]
  meeting: MeetingWithTiming
  now?: Date
  members: MeetingMember[]
}): MeetingMemberAttendance[] {
  const { attendance, meeting, members, now = new Date() } = args

  if (!canCalculateMeetingAbsences(meeting, now)) return []

  const attendanceByMember = new Map(
    attendance.map((record) => [getRelationId(record.user), 'present']),
  )

  return members
    .filter((member) => isMemberEligibleForMeeting(member, meeting))
    .map((member) => ({
      memberId: member.id,
      status: attendanceByMember.has(member.id) ? 'present' : 'absent',
    }))
}

export function calculateMeetingAbsenteeIds(args: {
  attendance: MeetingAttendanceRecord[]
  meeting: MeetingWithTiming
  now?: Date
  members: MeetingMember[]
}) {
  return calculateMeetingMemberAttendance(args)
    .filter((record) => record.status === 'absent')
    .map((record) => record.memberId)
}

export async function getMeetingAbsenteeIds(
  payload: Payload,
  meeting: MeetingWithTiming,
  now = new Date(),
) {
  if (!canCalculateMeetingAbsences(meeting, now)) return []

  const [membersDocs, attendanceDocs] = await Promise.all([
    payload.find({
      collection: 'users',
      depth: 0,
      limit: 1000,
      pagination: false,
      where: {
        role: {
          in: meetingAttendanceMemberRoles,
        },
      },
    }),
    payload.find({
      collection: 'attendances',
      depth: 0,
      limit: 1000,
      pagination: false,
      where: {
        meeting: {
          equals: meeting.id,
        },
      },
    }),
  ])

  return calculateMeetingAbsenteeIds({
    attendance: attendanceDocs.docs as Attendance[],
    meeting,
    members: membersDocs.docs as User[],
    now,
  })
}
