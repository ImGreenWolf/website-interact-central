'use server'

import payloadConfig from '@payload-config'
import { getPayload } from 'payload'

import { getPayloadAuthHeaders } from '@/utilities/payloadAuth'
import { getRotaryYearRange, getRotaryYearStart } from '@/utilities/rotaryYear'
import type { ClientLocation } from './locationManager'

type Coords = {
  latitude: number
  longitude: number
}

const ATTENDANCE_DISTANCE_THRESHOLD_METERS = 200
const EARTH_RADIUS_METERS = 6371000

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

export async function verifyAttendance(clientLocation: ClientLocation | null) {
  const payload = await getPayload({
    config: payloadConfig,
  })

  const meeting = await getTodayMeeting()

  const auth = await payload.auth({
    headers: await getPayloadAuthHeaders(),
  })

  if (!auth.user) return { message: 'Trebuie sa te loghezi in contrul tau' }
  if (!meeting) return { message: 'Nu exista nicio sedinta activa' }

  const existingAttendance = (
    await payload.find({
      collection: 'attendances',
      where: {
        and: [
          {
            user: {
              equals: auth.user.id,
            },
          },
          {
            meeting: {
              equals: meeting.id,
            },
          },
        ],
      },
    })
  ).docs[0]

  if (existingAttendance) return { message: 'Esti deja prezent pentru aceasta sedinta', meeting }
  if (!clientLocation) return { message: 'Nu am putut obtine locatia ta', meeting }

  const meetingLocation = normalizeMeetingLocation(meeting.location)
  if (!meetingLocation)
    return { message: 'Nu exista locatie setata pentru aceasta sedinta', meeting }

  const distance = getDistanceInMeters(clientLocation, meetingLocation)
  if (distance > ATTENDANCE_DISTANCE_THRESHOLD_METERS) {
    return {
      message: `Esti prea departe de locatia sedintei (${Math.round(distance)} m).`,
      meeting,
      distance,
    }
  }

  const attendance = await payload.create({
    collection: 'attendances',
    data: {
      meeting: meeting.id,
      user: auth.user.id,
    },
    overrideAccess: true,
  })

  if (attendance) return { message: 'Marcat ca prezent', meeting, distance }

  return { message: 'presence marking failed', meeting }
}

function normalizeMeetingLocation(location: unknown): Coords | null {
  if (!location) return null

  if (typeof location === 'string') {
    try {
      return normalizeMeetingLocation(JSON.parse(location))
    } catch {
      return null
    }
  }

  if (typeof location !== 'object') return null

  const maybeLocation = location as Partial<Coords>
  if (typeof maybeLocation.latitude === 'number' && typeof maybeLocation.longitude === 'number') {
    return {
      latitude: maybeLocation.latitude,
      longitude: maybeLocation.longitude,
    }
  }

  return null
}

function getDistanceInMeters(coordA: Coords, coordB: Coords) {
  const latitudeA = toRadians(coordA.latitude)
  const latitudeB = toRadians(coordB.latitude)
  const deltaLatitude = toRadians(coordB.latitude - coordA.latitude)
  const deltaLongitude = toRadians(coordB.longitude - coordA.longitude)

  const haversine =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2)

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180
}
