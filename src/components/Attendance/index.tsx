import { getPayload, type AdminViewServerProps } from 'payload'

import { Gutter } from '@payloadcms/ui'
import React from 'react'
import { getTodayMeeting } from '../Checkin/actions'
import { QRCode } from 'react-qr-code'

import payloadConfig from '@payload-config'
import { getPayloadAuthHeaders } from '@/utilities/payloadAuth'

export default async function MyCustomView(props: AdminViewServerProps) {
   const payload = await getPayload({
    config: payloadConfig,
  })
  const [meeting, activeMembers] = await Promise.all([
    getTodayMeeting(),
    payload.count({
      collection: 'users',
      // where: {
      //   role: {
      //     equals: 'active',
      //   },
      // },
    }),
  ])

  const auth = await payload.auth({
      headers: await getPayloadAuthHeaders(),
    })
  if(!auth.user)
    return;

  if(!meeting)
    return;
  const attendance = await payload.create({
    collection: 'attendances',
    data: {
      meeting: meeting,
      user: auth.user,
    },
    overrideAccess: true,
  })

  const checkinLink = `${process.env.NEXT_PUBLIC_SERVER_URL}/checkin?meeting=${meeting?.id}`
  return (
    <Gutter>
      <h1>Scanare Prezenta</h1>
      <div className='flex flex-col' style={{display: 'flex'}}>
          {meeting && 
        <QRCode
          className='h-[80vh] w-auto mx-auto p-50'
          style={{height: '60vh', width:'auto', marginInline: 'auto'}}
          value={checkinLink}
          />
        }
        {/* <a href="checkinLink">{checkinLink}</a> */}
      </div>
      
      
    </Gutter>
  )
}