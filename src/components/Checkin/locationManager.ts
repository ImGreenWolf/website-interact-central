'use client'

export type ClientLocation = {
  accuracy: number
  latitude: number
  longitude: number
}

export default async function getUserLocation(): Promise<ClientLocation> {
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject)
  })

  return {
    accuracy: position.coords.accuracy,
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  }
}
