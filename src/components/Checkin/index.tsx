'use client'

import { Gutter, LoadingOverlay } from '@payloadcms/ui'
import { CalendarClock, CheckCircle2, LoaderCircle, MapPin, ShieldAlert } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

import ClientDisplay from './ClientDisplay'
import { verifyAttendance } from './actions'
import './index.scss'
import type { ClientLocation } from './locationManager'

const baseClass = 'attendance-view'

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
  const distance = result?.distance
  const meetingDate = meeting
    ? new Date(meeting.meetingDate).toLocaleString('ro-RO', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null
  const status = !result
    ? 'pending'
    : message?.includes('Marcat') || message?.includes('deja')
      ? 'success'
      : 'blocked'
  const StatusIcon =
    status === 'pending' ? LoaderCircle : status === 'success' ? CheckCircle2 : ShieldAlert

  return (
    <Gutter>
      <ClientDisplay setUserLocation={setLocation} />

      <section className={`${baseClass} ${baseClass}--checkin`}>
        {!result && <LoadingOverlay />}

        <div className={`${baseClass}__header`}>
          <div>
            <p className={`${baseClass}__eyebrow`}>Check-in prezenta</p>
            <h1>Confirmare sedinta</h1>
          </div>
          <span className={`${baseClass}__badge ${baseClass}__badge--${status}`}>
            {status === 'pending' ? 'Se verifica' : status === 'success' ? 'Confirmat' : 'Blocat'}
          </span>
        </div>

        <div className={`${baseClass}__status ${baseClass}__status--${status}`}>
          <div className={`${baseClass}__status-icon`}>
            <StatusIcon size={24} aria-hidden />
          </div>
          <div>
            <p className={`${baseClass}__status-label`}>
              {status === 'pending' ? 'Se obtine locatia' : 'Status prezenta'}
            </p>
            <h2>{message ?? 'Verificam daca esti in zona sedintei.'}</h2>
          </div>
        </div>

        <div className={`${baseClass}__details`}>
          <div className={`${baseClass}__detail`}>
            <CalendarClock size={18} aria-hidden />
            <div>
              <span>Sedinta</span>
              <strong>{meetingDate ?? 'Nicio sedinta activa'}</strong>
            </div>
          </div>
          <div className={`${baseClass}__detail`}>
            <MapPin size={18} aria-hidden />
            <div>
              <span>Distanta fata de locatie</span>
              <strong>
                {typeof distance === 'number' ? `${Math.round(distance)} m` : 'In asteptare'}
              </strong>
            </div>
          </div>
        </div>
      </section>
    </Gutter>
  )
}
