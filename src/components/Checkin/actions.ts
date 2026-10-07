'use server'

import payloadConfig from '@payload-config'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'

import type { Attendance, User } from '@/payload-types'
import { getPayloadAuthHeaders } from '@/utilities/payloadAuth'
import { getRotaryYearRange, getRotaryYearStart } from '@/utilities/rotaryYear'
import { getMeetingWindow } from '@/utilities/meetingTime'

type ScannedUser = Pick<User, 'email' | 'id' | 'name'>

type ScanResponse = {
  counted?: boolean
  err?: string
  // status?: Attendance['status']
  user?: ScannedUser
}




export async function getTodayMeeting() {
  const payload = await getPayload({ config: payloadConfig })
  const now = new Date()
  const dayEnd = new Date(now)

  dayEnd.setHours(24, 0, 0, 0)

  const meetingsDocs = await payload.find({
    collection: 'meetings',
    where: {
      meetingDate: {
        greater_than_equal: getRotaryYearRange(getRotaryYearStart(now)).start.toISOString(),
        less_than: dayEnd.toISOString(),
      },
    },
    sort: 'meetingDate',
    limit: 20,
    depth: 0,
  })

  return meetingsDocs.docs[0]
}
