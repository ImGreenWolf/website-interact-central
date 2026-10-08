'use client'

import { Gutter, LoadingOverlay } from '@payloadcms/ui'
import React, { useEffect, useRef, useState } from 'react'

import ClientDisplay from './ClientDisplay'
import { verifyAttendance } from './actions'
import type { ClientLocation } from './locationManager'

export default function MyCustomView() {
  const [location, setLocation] = useState<ClientLocation | null | undefined>(undefined)
  const [result, setResult] = useState<Awaited<ReturnType<typeof verifyAttendance>> | null>(null)
  const hasSubmittedAttendance = useRef(false)

  useEffect(() => {
    if (location === undefined) return
    if (hasSubmittedAttendance.current) return

    let isMounted = true

    if (location === null) {
      setResult({ message: 'Nu am putut obtine locatia ta' })
      return
    }

    hasSubmittedAttendance.current = true

    verifyAttendance(location)
      .then((attendanceResult) => {
        if (isMounted) setResult(attendanceResult)
      })
      .catch(() => {
        if (isMounted) setResult({ message: 'Nu am putut marca prezenta' })
      })

    return () => {
      isMounted = false
    }
  }, [location])

  const meeting = result?.meeting
  const message = result?.message
  

  return (
    <Gutter>
      <ClientDisplay setUserLocation={setLocation} />

      {!result && <LoadingOverlay />}

      {result &&
        (meeting ? (
          <>
            <h1>Sedinta {new Date(meeting.meetingDate).toLocaleString('ro-RO')}</h1>
            {new Date(meeting.meetingDate).toLocaleString('ro-RO')}
          </>
        ) : (
          <h1>Nu exista sedinta</h1>
        ))}

      {message}
      dist: {result?.distance}
    </Gutter>
  )
}
