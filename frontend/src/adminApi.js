import { stringifyQuery } from 'vue-router'
import { request, requestBody } from './api.ts'

export function listAdminUsers(query, signal) {
  const params = stringifyQuery(query)
  return request(`/api/admin/users${params ? `?${params}` : ''}`, { signal }, true)
}

export function getAdminUser(userId, signal) {
  return request(`/api/admin/users/${encodeURIComponent(userId)}`, { signal }, true)
}

export function updateAdminUserStatus(userId, value) {
  return requestBody(
    `/api/admin/users/${encodeURIComponent(userId)}/status`,
    { method: 'PATCH', body: JSON.stringify(value) },
    true,
  )
}
