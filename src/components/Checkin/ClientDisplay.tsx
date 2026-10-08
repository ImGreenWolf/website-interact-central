'use client'

import { useEffect } from 'react'

import getUserLocation, { type ClientLocation } from '../Checkin/locationManager'

export default function Component({
  setUserLocation,
}: {
  setUserLocation: (location: ClientLocation | null) => void
}) {
  useEffect(() => {
    let isMounted = true

    getUserLocation()
      .then((location) => {
        if (isMounted) setUserLocation(location)
      })
      .catch(() => {
        if (isMounted) setUserLocation(null)
      })

    return () => {
      isMounted = false
    }
  }, [setUserLocation])

  return null
}
