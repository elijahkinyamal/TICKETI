// discovery-search — proxies the Ticketmaster Discovery API so the API key
// stays server-side (never shipped to the browser). Requires a signed-in user
// to avoid becoming an open proxy for the key.
//
// type: "events" (default) → returns rich event objects (name, date, venue,
//   lat/lng, poster image, AND the venue seat-map image) for Create-Event autofill.
// type: "venues" → returns venues (name + location only), for the Venues toggle.
import { corsHeaders, json } from '../_shared/cors.ts'
import { requireUser, HttpError } from '../_shared/auth.ts'

const TM_KEY = Deno.env.get('TICKETMASTER_API_KEY')
const TM_EVENTS = 'https://app.ticketmaster.com/discovery/v2/events.json'
const TM_VENUES = 'https://app.ticketmaster.com/discovery/v2/venues.json'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    await requireUser(req)
    if (!TM_KEY) throw new HttpError(500, 'TICKETMASTER_API_KEY is not set')

    const { keyword = '', city = '', size = 20, page = 0, type = 'events', countryCode = '', sort = '', classificationName = '' } = await req.json().catch(() => ({}))

    if (type === 'venues') {
      const url = new URL(TM_VENUES)
      url.searchParams.set('apikey', TM_KEY)
      if (keyword) url.searchParams.set('keyword', String(keyword))
      url.searchParams.set('size', String(Math.min(Number(size) || 20, 50)))
      const res = await fetch(url)
      if (!res.ok) throw new HttpError(502, `Ticketmaster returned ${res.status}`)
      const data = await res.json()
      const venues = (data._embedded?.venues ?? []).map(simplifyVenue)
      return json({ venues })
    }

    const url = new URL(TM_EVENTS)
    url.searchParams.set('apikey', TM_KEY)
    if (keyword) url.searchParams.set('keyword', String(keyword))
    if (city) url.searchParams.set('city', String(city))
    if (countryCode) url.searchParams.set('countryCode', String(countryCode))
    if (classificationName) url.searchParams.set('classificationName', String(classificationName))
    if (sort) url.searchParams.set('sort', String(sort))
    url.searchParams.set('size', String(Math.min(Number(size) || 20, 50)))
    url.searchParams.set('page', String(Number(page) || 0))

    const res = await fetch(url)
    if (!res.ok) throw new HttpError(502, `Ticketmaster returned ${res.status}`)
    const data = await res.json()

    const events = (data._embedded?.events ?? []).map(simplifyEvent)
    return json({ events, page: data.page ?? null })
  } catch (e) {
    return json({ error: (e as Error).message }, (e as HttpError).status ?? 500)
  }
})

// Flatten Ticketmaster's deeply-nested event shape into the fields our
// `events` table + Create-Event autofill actually use.
function simplifyEvent(e: any) {
  const venue = e._embedded?.venues?.[0]
  // Prefer a wide 16:9 poster; fall back to the largest image available.
  const images = [...(e.images ?? [])]
  const wide = images.filter((i) => i.ratio === '16_9').sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]
  const biggest = images.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]
  const img = wide || biggest
  return {
    tm_id: e.id,
    name: e.name,
    url: e.url ?? null,
    starts_at: e.dates?.start?.dateTime ?? null,
    venue: venue
      ? [venue.name, venue.city?.name, venue.state?.stateCode].filter(Boolean).join(', ')
      : null,
    lat: venue?.location?.latitude ? Number(venue.location.latitude) : null,
    lng: venue?.location?.longitude ? Number(venue.location.longitude) : null,
    poster_url: img?.url ?? null,
    seat_map_url: e.seatmap?.staticUrl ?? null, // the stadium seating chart image
    price_min: e.priceRanges?.[0]?.min ?? null,
    currency: e.priceRanges?.[0]?.currency ?? null,
  }
}

function simplifyVenue(v: any) {
  return {
    tm_id: v.id,
    name: v.name,
    venue: [v.name, v.city?.name, v.state?.stateCode].filter(Boolean).join(', '),
    lat: v.location?.latitude ? Number(v.location.latitude) : null,
    lng: v.location?.longitude ? Number(v.location.longitude) : null,
  }
}
