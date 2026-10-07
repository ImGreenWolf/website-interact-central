import { getPayload, type AdminViewServerProps } from 'payload'

import { Gutter } from '@payloadcms/ui'
import React from 'react'
import { getTodayMeeting } from './actions'
import { QRCode } from 'react-qr-code'

import payloadConfig from '@payload-config'
import { getPayloadAuthHeaders } from '@/utilities/payloadAuth'

export default async function MyCustomView(props: AdminViewServerProps) {
   
  const {meeting, message} = await verifyAttendance()
  return (
    <Gutter>
      {meeting ?
      <h1>Sedinta { new Date(meeting.meetingDate).toLocaleString('ro-RO')}</h1>
      :
      <h1>Nu exista sedinta</h1>
        
      }
      {meeting && 
       new Date(meeting.meetingDate).toLocaleString('ro-RO')
      }
      {
       message
      }
      
    </Gutter>
  )
}

async function verifyAttendance() {

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
    return {message: 'please log in'}

  if(!meeting)
    return {message: 'no meeting'}

  const existingAttendance = (await payload.find({
    collection: 'attendances',
    where: {
      and: [
        {
          user: {
            equals: auth.user
          }
        },
        {
          meeting: {
            equals: meeting
          }
        }
      ]
    }
  })).docs[0]

  if(existingAttendance)
    return {message: 'already present', meeting: meeting}
  
  const attendance = await payload.create({
    collection: 'attendances',
    data: {
      meeting: meeting,
      user: auth.user,
    },
    overrideAccess: true,
  })
  if(attendance)
    return {message: 'presence marked', meeting: meeting}
  else
    return {message: 'presence marking failed', meeting: meeting}


  
}