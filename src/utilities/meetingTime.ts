import type { Attendance, Meeting } from '@/payload-types'

export const DEFAULT_MEETING_DURATION_MINUTES = 60
export const DEFAULT_MEETING_LATE_BUFFER = 15
export const DEFAULT_MEETING_ENDED_BUFFER_MINUTES = 60

export type MeetingTiming = Pick<Meeting, 'meetingDate'> & {
  durationMinutes?: number | null
  endedBufferMinutes?: number | null
}

export type MeetingWindowStatus = 'upcoming' | 'ongoing' | 'ended' | 'expired'

export type MeetingWindow = {
  bufferEndAt: Date
  durationMinutes: number
  endAt: Date
  endedBufferMinutes: number
  startAt: Date
  status: MeetingWindowStatus
}

function normalizeMinutes(value: number | null | undefined, fallback: number, minimum = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback

  return Math.max(minimum, Math.round(value))
}

export function getMeetingDurationMinutes(meeting: MeetingTiming) {
  return normalizeMinutes(meeting.durationMinutes, DEFAULT_MEETING_DURATION_MINUTES, 1)
}

export function getMeetingEndedBufferMinutes(meeting: MeetingTiming) {
  return normalizeMinutes(meeting.endedBufferMinutes, DEFAULT_MEETING_ENDED_BUFFER_MINUTES, 0)
}

export function getMeetingWindow(meeting: MeetingTiming, now = new Date()): MeetingWindow {
  const startAt = new Date(meeting.meetingDate)
  const durationMinutes = getMeetingDurationMinutes(meeting)
  const endedBufferMinutes = getMeetingEndedBufferMinutes(meeting)
  const endAt = new Date(startAt.getTime() + durationMinutes * 60_000)
  const bufferEndAt = new Date(endAt.getTime() + endedBufferMinutes * 60_000)
  const nowTime = now.getTime()
  let status: MeetingWindowStatus = 'expired'

  if (nowTime < startAt.getTime()) {
    status = 'upcoming'
  } else if (nowTime < endAt.getTime()) {
    status = 'ongoing'
  } else if (nowTime < bufferEndAt.getTime()) {
    status = 'ended'
  }

  return {
    bufferEndAt,
    durationMinutes,
    endAt,
    endedBufferMinutes,
    startAt,
    status,
  }
}

export function canCalculateMeetingAbsences(meeting: MeetingTiming, now = new Date()) {
  return now.getTime() >= getMeetingWindow(meeting, now).endAt.getTime()
}



export function shouldShowMeetingOnMemberDashboard(meeting: MeetingTiming, now = new Date()) {
  return getMeetingWindow(meeting, now).status !== 'expired'
}
