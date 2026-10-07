import { cookies, headers } from 'next/headers'

export async function getPayloadAuthHeaders() {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()])
  const authHeaders = new Headers(requestHeaders)

  authHeaders.set('cookie', cookieStore.toString())

  if (!authHeaders.has('sec-fetch-site')) {
    authHeaders.set('sec-fetch-site', 'same-origin')
  }

  return authHeaders
}
