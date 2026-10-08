import { getPayload, type AdminViewServerProps } from 'payload'

import { Gutter } from '@payloadcms/ui'
import { CalendarClock, ExternalLink, LinkIcon, MapPin, QrCode as QrCodeIcon } from 'lucide-react'
import React from 'react'
import { QRCode } from 'react-qr-code'

import payloadConfig from '@payload-config'
import { getPayloadAuthHeaders } from '@/utilities/payloadAuth'

import { getTodayMeeting } from '../Checkin/actions'
import '../Checkin/index.scss'
import ClientDisplay from './ClientDisplay'
import { updateMeetingLocation } from './actions'

const baseClass = 'attendance-view'

export default async function MyCustomView(props: AdminViewServerProps) {
  const payload = await getPayload({
    config: payloadConfig,
  })
  const meeting = await getTodayMeeting()

  const auth = await payload.auth({
    headers: await getPayloadAuthHeaders(),
  })

  if (!auth.user) return
  if (!meeting) return

  const meetingDate = new Date(meeting.meetingDate).toLocaleString('ro-RO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const checkinLink = `${process.env.NEXT_PUBLIC_SERVER_URL}/admin/collections/meetings/checkin?meeting=${meeting.id}`

  return (
    <Gutter>
      <section className={`${baseClass} ${baseClass}--scanner`}>
        <div className={`${baseClass}__header`}>
          <div>
            <p className={`${baseClass}__eyebrow`}>Scanare prezenta</p>
            <h1>Cod QR pentru check-in</h1>
          </div>
          <span className={`${baseClass}__badge ${baseClass}__badge--success`}>Sedinta activa</span>
        </div>

        <div className={`${baseClass}__scanner-grid`}>
          <div className={`${baseClass}__panel`}>
            <div className={`${baseClass}__panel-icon`}>
              <QrCodeIcon size={22} aria-hidden />
            </div>
            <h2>Invita membrii sa scaneze codul</h2>
            <p>
              Locatia acestui dispozitiv este salvata ca punct de referinta pentru sedinta curenta.
            </p>

            <div className={`${baseClass}__details`}>
              <div className={`${baseClass}__detail`}>
                <CalendarClock size={18} aria-hidden />
                <div>
                  <span>Sedinta</span>
                  <strong>{meetingDate}</strong>
                </div>
              </div>
              <div className={`${baseClass}__detail`}>
                <MapPin size={18} aria-hidden />
                <div>
                  <span>Prag check-in</span>
                  <strong>200 m fata de locatie</strong>
                </div>
              </div>
            </div>
          </div>

          <div className={`${baseClass}__qr-panel`}>
            <div className={`${baseClass}__qr-frame`}>
              <QRCode value={checkinLink} />
            </div>
            <div className={`${baseClass}__link-row`}>
              <LinkIcon size={16} aria-hidden />
              <a href={checkinLink}>{checkinLink}</a>
              <a className={`${baseClass}__icon-link`} href={checkinLink} title="Deschide link">
                <ExternalLink size={16} aria-hidden />
              </a>
            </div>
          </div>
        </div>

        <ClientDisplay meeting={meeting} setUserLocation={updateMeetingLocation} />
      </section>
    </Gutter>
  )
}
