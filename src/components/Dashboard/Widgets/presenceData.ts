import type { Payload } from 'payload'

import type { Attendance, Meeting, User } from '@/payload-types'
import {
  calculateMeetingMemberAttendance,
  isMemberEligibleForMeeting,
  meetingAttendanceMemberRoles,
} from '@/utilities/meetingAttendance'
import { canCalculateMeetingAbsences } from '@/utilities/meetingTime'
import { getRotaryYearQueryBounds, getRotaryYearStart } from '@/utilities/rotaryYear'

import { formatShortDate, getRelationId, percentage } from './widgetUtils'



export type MeetingPresencePoint =  {
  date: string
  id: string
  label: string
  rate: number
  total: number
}

export type PresenceOverview =  {
  attendanceRate: number
  expectedRecords: number
  memberCount: number
  meetingCount: number
}

function emptyCounts() {
  return {
    absent: 0,
    present: 0,
  }
}

async function getPresenceSource(
  payload: Payload,
  now = new Date(),
  rotaryYearStart = getRotaryYearStart(now),
) {
  const bounds = getRotaryYearQueryBounds(rotaryYearStart, now)
  const [membersDocs, meetingsDocs, attendanceDocs] = await Promise.all([
    payload.find({
      collection: 'users',
      depth: 0,
      limit: 1000,
      pagination: false,
      sort: 'joinedAt',
      where: {
        role: {
          in: meetingAttendanceMemberRoles,
        },
      },
      joins: {
        attendance: {
          limit: 100
        }
      }
    }),
    payload.find({
      collection: 'meetings',
      depth: 0,
      limit: 1000,
      pagination: false,
      sort: 'meetingDate',
      where: {
        meetingDate: {
          greater_than_equal: bounds.start.toISOString(),
          [bounds.endOperator]: bounds.end.toISOString(),
        },
      },
      joins: {
        attendance: {
          limit: 100
        }
      }
    }),
    payload.find({
      collection: 'attendances',
      depth: 0,
      limit: 10000,
      pagination: false,
    }),
    
  ])

  return {
    attendance: attendanceDocs.docs as Attendance[],
    meetings: (meetingsDocs.docs as Meeting[]).filter((meeting) =>
      canCalculateMeetingAbsences(meeting, now),
    ),
    members: membersDocs.docs as User[],
  }
}

function calculateMeetingPoint(args: {
  attendance: Attendance[]
  meeting: Meeting
  members: User[]
}): MeetingPresencePoint {
  const { attendance, meeting, members } = args
  const eligibleMembers = members.filter((member) => isMemberEligibleForMeeting(member, meeting))
  const counts = emptyCounts()

  calculateMeetingMemberAttendance({
    attendance,
    meeting,
    members: eligibleMembers,
  }).forEach((record) => {
    counts[record.status] += 1
  })

  const effectiveTotal = Math.max(0, eligibleMembers.length)
  const rate = percentage(counts.present, effectiveTotal)

  return {
    ...counts,
    date: meeting.meetingDate,
    id: meeting.id,
    label: formatShortDate(meeting.meetingDate),
    rate,
    total: eligibleMembers.length,
  }
}

export async function getPresenceOverview(
  payload: Payload,
  now = new Date(),
  rotaryYearStart = getRotaryYearStart(now),
): Promise<PresenceOverview> {
  const { attendance, meetings, members } = await getPresenceSource(
    payload,
    now,
    rotaryYearStart,
  )
  const counts = emptyCounts()
  let expectedRecords = 0

  meetings.forEach((meeting) => {
    const meetingId = getRelationId(meeting.id)
    const records = calculateMeetingMemberAttendance({
      attendance: attendance.filter((record) => getRelationId(record.meeting) === meetingId),
      meeting,
      members,
      now,
    })

    expectedRecords += records.length
    records.forEach((record) => {
      counts[record.status] += 1
    })
  })

  const effectiveRecords = Math.max(0, expectedRecords)

  return {
    ...counts,
    attendanceRate: percentage(counts.present, effectiveRecords),
    expectedRecords,
    meetingCount: meetings.length,
    memberCount: members.length,
  }
}

export async function getPresenceGraphData(
  payload: Payload,
  now = new Date(),
  limit = 8,
  rotaryYearStart = getRotaryYearStart(now),
) {
  const { attendance, meetings, members } = await getPresenceSource(
    payload,
    now,
    rotaryYearStart,
  )
  const latestMeetings = meetings.slice(-limit)
  const attendanceByMeeting = new Map<string, Attendance[]>()

  attendance.forEach((record) => {
    const meetingId = getRelationId(record.meeting)
    const meetingAttendance = attendanceByMeeting.get(meetingId) ?? []

    meetingAttendance.push(record)
    attendanceByMeeting.set(meetingId, meetingAttendance)
  })


  return latestMeetings.map((meeting) =>
    calculateMeetingPoint({
      attendance: attendanceByMeeting.get(getRelationId(meeting.id)) ?? [],
      meeting,
      members,
    }),
  )
}
