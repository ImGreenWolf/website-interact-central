'use server'

import payloadConfig from '@payload-config'
import { getPayload } from 'payload'

import type { ClientLocation } from '../Checkin/locationManager'

export async function updateMeetingLocation(meetingID: string, location: ClientLocation) {
  const payload = await getPayload({
    config: payloadConfig,
  })

  if (meetingID)
    await payload.update({
      collection: 'meetings',
      where: {
        id: {
          equals: meetingID,
        },
      },
      data: {
        location,
      },
    })
}
