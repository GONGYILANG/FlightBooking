import { stringifyQuery } from 'vue-router'
import { request } from './api.ts'

export async function listAdminUsers(query, signal) {
  const params = stringifyQuery(query)
  const response = await request(`/api/admin/users${params ? `?${params}` : ''}`, { signal }, true)
  return response.data
}

export async function getAdminUser(userId, signal) {
  const response = await request(`/api/admin/users/${encodeURIComponent(userId)}`, { signal }, true)
  return response.data
}
