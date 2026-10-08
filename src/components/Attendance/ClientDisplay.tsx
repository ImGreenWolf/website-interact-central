'use client'

import { useEffect } from 'react'

import type { Meeting } from '@/payload-types'

import getUserLocation from '../Checkin/locationManager'

export default function Component({
  meeting,
  setUserLocation,
}: {
  meeting: Meeting
  setUserLocation: (
    meetingID: string,
    location: Awaited<ReturnType<typeof getUserLocation>>,
  ) => Promise<void>
}) {
  useEffect(() => {
    let isMounted = true

    getUserLocation()
      .then((location) => {
        if (isMounted) void setUserLocation(meeting.id, location)
      })
      .catch(() => undefined)

    return () => {
      isMounted = false
    }
  }, [meeting.id, setUserLocation])

  return null
}
