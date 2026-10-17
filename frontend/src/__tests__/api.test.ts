import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ApiError, cancelBooking, createBooking, deleteChat, getBooking, getChatSession,
  getFlight, getHealth, getMe, listAirlines, listBookings, listChatSessions, login,
  logout, register, request, requestBody, searchAirports, searchFlights, sendChat,
  setAccessToken, setUnauthorizedHandler,
} from '../api.ts'
import { getAdminUser, listAdminUsers, updateAdminUserStatus } from '../adminApi.js'

function mockJson(body: unknown, status = 200) {
  let captured: { path: string; init: RequestInit } | null = null
  globalThis.fetch = (async (path: string | URL | Request, init: RequestInit = {}) => {
    captured = { path: String(path), init }
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  return () => captured
}

test('requestBody preserves the response body while request returns only data', async () => {
  const body = { data: { users: [] }, meta: { page: 1 } }
  mockJson(body)
  assert.deepEqual(await requestBody('/example'), body)
  assert.deepEqual(await request('/example'), body.data)
})

test('request preserves a null data value without falling back to the response body', async () => {
  mockJson({ data: null, meta: { message: 'No result' } })
  assert.equal(await request('/example'), null)
})

test('ordinary API methods return the entire data object without extracting its properties', async () => {
  const cases = [
    { read: () => getMe(), data: { user: { id: 'user' } } },
    { read: () => getFlight('flight'), data: { flight: { id: 'flight' } } },
    { read: () => getBooking('booking'), data: { booking: { id: 'booking' } } },
    { read: () => listAirlines(), data: { airlines: [{ code: 'CX', name: 'Cathay Pacific' }] } },
    { read: () => searchAirports('HKG'), data: { airports: [{ id: 'airport' }] } },
    { read: () => listBookings(), data: { bookings: [], pagination: { page: 1 } } },
    { read: () => listChatSessions(), data: { sessions: [{ sessionId: 'session' }] } },
    { read: () => getChatSession('session'), data: { session: { sessionId: 'session' } } },
    { read: () => login('user@example.com', 'demo-password'), data: { user: { id: 'user' }, accessToken: 'token' } },
  ]
  for (const { read, data } of cases) {
    mockJson({ data, meta: { ignored: true } })
    assert.deepEqual(await read(), data)
  }
})

test('health checks preserve their unwrapped response body', async () => {
  const body = { status: 'ok', timestamp: '2026-10-15T00:00:00Z', database: { status: 'connected' } }
  mockJson(body)
  assert.deepEqual(await getHealth(), body)
})

test('both request variants preserve backend errors and abort errors', async () => {
  for (const read of [requestBody, request]) {
    mockJson({ error: {
      code: 'INVALID_REQUEST', message: 'Invalid page',
      details: { fields: [{ field: 'page', message: 'page must be an integer' }] },
    } }, 400)
    await assert.rejects(read('/example'), (reason: unknown) =>
      reason instanceof ApiError && reason.status === 400 && reason.code === 'INVALID_REQUEST' &&
      reason.fields[0]?.field === 'page',
    )
    const aborted = new DOMException('Cancelled', 'AbortError')
    globalThis.fetch = async () => { throw aborted }
    await assert.rejects(read('/example'), (reason: unknown) => reason === aborted)
  }
})

test('flight range pagination uses the search API and preserves filters and abort signal', async () => {
  const data = { flights: [], pagination: { page: 2, limit: 5, totalItems: 25, totalPages: 5 } }
  const captured = mockJson({ data })
  const controller = new AbortController()
  assert.deepEqual(await searchFlights({
    origin: 'PEK', destination: 'HKG', departureDateFrom: '2026-12-01', departureDateTo: '2026-12-31',
    passengers: 2, departurePeriod: 'MORNING', airlineCode: 'CX',
    sortBy: 'departureAt', sortOrder: 'asc', page: 2, limit: 5,
  }, controller.signal), data)
  const request = captured()!
  const url = new URL(request.path, 'http://localhost')
  assert.equal(url.pathname, '/api/flights/search')
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    origin: 'PEK', destination: 'HKG', departureDateFrom: '2026-12-01', departureDateTo: '2026-12-31',
    passengers: '2', departurePeriod: 'MORNING', airlineCode: 'CX',
    sortBy: 'departureAt', sortOrder: 'asc', page: '2', limit: '5',
  })
  assert.equal(request.init.signal, controller.signal)
})

test('register sends the backend field names', async () => {
  const captured = mockJson({ data: { user: { id: 'u' }, accessToken: 'token', expiresIn: '24h' } })
  await register('Student', 'student@example.com', 'password123')
  const request = captured()
  assert.equal(request?.path, '/api/auth/register')
  assert.equal(request?.init.method, 'POST')
  assert.deepEqual(JSON.parse(String(request?.init.body)), {
    displayName: 'Student',
    email: 'student@example.com',
    password: 'password123',
  })
})

test('cancel uses PATCH and the bearer token', async () => {
  const body = { data: { booking: { id: 'booking' } }, meta: { alreadyCancelled: false } }
  const captured = mockJson(body)
  setAccessToken('jwt-value')
  assert.deepEqual(await cancelBooking('booking'), body)
  const request = captured()
  assert.equal(request?.path, '/api/bookings/booking/cancel')
  assert.equal(request?.init.method, 'PATCH')
  assert.equal(new Headers(request?.init.headers).get('Authorization'), 'Bearer jwt-value')
})

test('booking creation preserves data and idempotent replay metadata', async () => {
  const body = { data: { booking: { id: 'booking' } }, meta: { idempotentReplay: true } }
  mockJson(body)
  assert.deepEqual(await createBooking('flight', 2, 'request-key'), body)
})

test('chat preserves structured tool events', async () => {
  mockJson({ sessionId: 'session', requestId: 'request', message: 'Found one.', replayed: false, events: [{ tool: 'search_flights', result: { ok: true, status: 200, data: { flights: [] } } }] })
  const result = await sendChat('Find a flight', 'session', 'request')
  assert.equal(result.events[0]?.tool, 'search_flights')
})

test('logout and chat deletion send bearer authentication and accept 204', async () => {
  const calls: Array<{ path: string; method?: string; authorization: string | null }> = []
  globalThis.fetch = (async (path, init = {}) => {
    calls.push({ path: String(path), method: init.method, authorization: new Headers(init.headers).get('Authorization') })
    return new Response(null, { status: 204 })
  }) as typeof fetch
  setAccessToken('current-token')
  assert.equal(await deleteChat('conversation'), undefined)
  assert.equal(await logout(), undefined)
  assert.deepEqual(calls, [
    { path: '/chat-api/chat/conversation', method: 'DELETE', authorization: 'Bearer current-token' },
    { path: '/api/auth/logout', method: 'POST', authorization: 'Bearer current-token' },
  ])
})

test('expired and disabled accounts clear auth, but a stale 401 cannot clear a newer login', async () => {
  let cleared = 0
  setUnauthorizedHandler(() => cleared++)
  for (const [status, code] of [[401, 'TOKEN_REVOKED'], [403, 'ACCOUNT_NOT_ACTIVE']] as const) {
    mockJson({ error: { code, message: 'Sign in again' } }, status)
    await assert.rejects(getMe())
  }
  assert.equal(cleared, 2)
  let finish!: (response: Response) => void
  globalThis.fetch = () => new Promise<Response>((resolve) => { finish = resolve })
  const oldRequest = getMe()
  setAccessToken('new-login-token')
  finish(new Response(JSON.stringify({ error: { code: 'TOKEN_REVOKED' } }), { status: 401 }))
  await assert.rejects(oldRequest)
  assert.equal(cleared, 2)
})

test('admin user list leaves default pagination to the backend', async () => {
  const data = { users: [], pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } }
  const captured = mockJson({ data })
  setAccessToken('admin-token')
  assert.deepEqual(await listAdminUsers({}), data)
  const request = captured()!
  assert.equal(request.path, '/api/admin/users')
  assert.equal(new Headers(request.init.headers).get('Authorization'), 'Bearer admin-token')
})

test('admin user search sends q, both filters, pagination and the abort signal', async () => {
  setAccessToken('admin-token')
  const captured = mockJson({ data: { users: [], pagination: {} } })
  const controller = new AbortController()
  await listAdminUsers(
    { q: 'Maya + Chen@example.com', status: 'LOCKED', role: 'USER', page: 2, limit: 20 },
    controller.signal,
  )
  const request = captured()!
  const url = new URL(request.path, 'http://localhost')
  assert.equal(url.pathname, '/api/admin/users')
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    q: 'Maya + Chen@example.com',
    status: 'LOCKED',
    role: 'USER',
    page: '2',
    limit: '20',
  })
  assert.equal(request.init.signal, controller.signal)
  assert.equal(new Headers(request.init.headers).get('Authorization'), 'Bearer admin-token')
})

test('admin user query preserves repeated and bare values for backend validation', async () => {
  const captured = mockJson({ data: { users: [], pagination: {} } })
  await listAdminUsers({ q: ['Maya', 'Chen'], status: null, page: 'abc' })
  const url = new URL(captured()!.path, 'http://localhost')
  assert.deepEqual(url.searchParams.getAll('q'), ['Maya', 'Chen'])
  assert.equal(url.searchParams.get('status'), '')
  assert.equal(url.searchParams.get('page'), 'abc')
  assert.equal(url.searchParams.has('limit'), false)
})

test('admin user query does not normalize enum values or truncate the search', async () => {
  const captured = mockJson({ data: { users: [], pagination: {} } })
  const q = 'x'.repeat(101)
  await listAdminUsers({ q, status: ' locked ', role: 'user', limit: '50' })
  const url = new URL(captured()!.path, 'http://localhost')
  assert.equal(url.searchParams.get('q'), q)
  assert.equal(url.searchParams.get('status'), ' locked ')
  assert.equal(url.searchParams.get('role'), 'user')
  assert.equal(url.searchParams.get('limit'), '50')
})

test('admin user details unwrap booking counts and the latest status change', async () => {
  setAccessToken('admin-token')
  const data = {
    user: {
      id: 'user',
      displayName: 'Maya',
      email: 'maya@example.com',
      role: 'USER',
      status: 'LOCKED',
      createdAt: null,
      updatedAt: null,
    },
    bookingSummary: { total: 10, confirmed: 7, cancelled: 3 },
    statusChange: { updatedAt: '2026-10-14T02:00:00Z', updatedBy: null, reason: 'Account review' },
  }
  const captured = mockJson({ data })
  const controller = new AbortController()
  assert.deepEqual(await getAdminUser('user/id', controller.signal), data)
  assert.equal(captured()!.path, '/api/admin/users/user%2Fid')
  assert.equal(captured()!.init.signal, controller.signal)
  assert.equal(new Headers(captured()!.init.headers).get('Authorization'), 'Bearer admin-token')
})

test('admin status updates send the reason and preserve change metadata', async () => {
  setAccessToken('admin-token')
  const value = { status: 'LOCKED', reason: ' Account review ' }
  for (const changed of [true, false]) {
    const body = { data: { user: { id: 'user', status: 'LOCKED' } }, meta: { changed } }
    const captured = mockJson(body)
    assert.deepEqual(await updateAdminUserStatus('user/id', value), body)
    const request = captured()!
    assert.equal(request.path, '/api/admin/users/user%2Fid/status')
    assert.equal(request.init.method, 'PATCH')
    assert.deepEqual(JSON.parse(String(request.init.body)), value)
    assert.equal(new Headers(request.init.headers).get('Authorization'), 'Bearer admin-token')
  }
})

test('admin user errors preserve USER_NOT_FOUND and ADMIN_REQUIRED without logging out a normal user', async () => {
  let cleared = 0
  setUnauthorizedHandler(() => cleared++)
  for (const [status, code] of [
    [404, 'USER_NOT_FOUND'],
    [403, 'ADMIN_REQUIRED'],
  ] as const) {
    mockJson({ error: { code, message: 'Unavailable' } }, status)
    await assert.rejects(
      getAdminUser('user'),
      (reason: unknown) =>
        reason instanceof ApiError && reason.status === status && reason.code === code,
    )
  }
  assert.equal(cleared, 0)
})
