<script setup>
import {
  ElAlert,
  ElButton,
  ElSkeleton,
  ElTag,
} from 'element-plus'
import { ArrowLeft, History, Tickets } from 'lucide-vue-next'
import { onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import { getAdminUser } from '../adminApi.js'

const route = useRoute()
const details = ref(null)
const loading = ref(true)
const error = ref('')
let controller

async function loadUser() {
  controller?.abort()
  const request = new AbortController()
  controller = request
  loading.value = true
  error.value = ''
  try {
    const result = await getAdminUser(route.params.userId, request.signal)
    if (!request.signal.aborted) details.value = result
  } catch (reason) {
    if (!request.signal.aborted) error.value = reason.message
  } finally {
    if (!request.signal.aborted) loading.value = false
  }
}

watch(() => route.params.userId, loadUser, { immediate: true })
onBeforeUnmount(() => controller?.abort())

function formatDate(value) {
  return value ? new Date(value).toLocaleString('en-US') : '—'
}
</script>

<template>
  <AppShell>
    <RouterLink
      to="/admin/users"
      class="mb-6 inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline"
    >
      <ArrowLeft :size="18" aria-hidden="true" />Back to users
    </RouterLink>
    <div v-if="loading" class="py-8" role="status">
      <p class="mb-4 text-slate-500">Loading user details…</p>
      <ElSkeleton :rows="6" animated />
    </div>
    <div v-else-if="error" class="grid gap-4">
      <h1 class="text-2xl font-semibold tracking-tight">
        Unable to load user
      </h1>
      <ElAlert :title="error" type="error" :closable="false" role="alert" />
      <ElButton class="justify-self-start" @click="loadUser">Try again</ElButton>
    </div>
    <section v-else-if="details" class="space-y-6" aria-labelledby="user-heading">
      <div>
        <p class="mb-2 text-sm font-semibold tracking-widest text-blue-700 uppercase">
          Administration · User details
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <h1 id="user-heading" class="text-2xl font-semibold tracking-tight break-all">
            {{ details.user.displayName }}
          </h1>
          <ElTag
            :type="
              details.user.status === 'ACTIVE'
                ? 'success'
                : details.user.status === 'LOCKED'
                  ? 'warning'
                  : 'danger'
            "
          >
            {{ details.user.status === 'ACTIVE' ? 'Active'
              : details.user.status === 'LOCKED' ? 'Locked' : 'Disabled' }}
          </ElTag>
          <ElTag :type="details.user.role === 'ADMIN' ? 'primary' : 'info'" effect="plain">
            {{ details.user.role === 'ADMIN' ? 'Admin' : 'User' }}
          </ElTag>
        </div>
        <p class="mt-2 break-all text-sm text-slate-500">{{ details.user.email }}</p>
      </div>

      <section
        class="rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm shadow-slate-900/5 sm:p-6"
        aria-labelledby="account-heading"
      >
        <h2 id="account-heading" class="mb-5 text-lg font-semibold">Personal information</h2>
        <div class="overflow-x-auto rounded-2xl border border-slate-300">
          <table class="details-table" aria-labelledby="account-heading">
            <tbody>
              <tr>
                <th scope="row">User ID</th>
                <td class="break-all">{{ details.user.id }}</td>
              </tr>
              <tr>
                <th scope="row">Display name</th>
                <td class="wrap-anywhere">{{ details.user.displayName }}</td>
              </tr>
              <tr>
                <th scope="row">Email</th>
                <td class="wrap-anywhere">{{ details.user.email }}</td>
              </tr>
              <tr>
                <th scope="row">Role</th>
                <td>{{ details.user.role === 'ADMIN' ? 'Admin' : 'User' }}</td>
              </tr>
              <tr>
                <th scope="row">Account status</th>
                <td>
                  {{ details.user.status === 'ACTIVE' ? 'Active'
                    : details.user.status === 'LOCKED' ? 'Locked' : 'Disabled' }}
                </td>
              </tr>
              <tr>
                <th scope="row">Joined</th>
                <td>{{ formatDate(details.user.createdAt) }}</td>
              </tr>
              <tr>
                <th scope="row">Last updated</th>
                <td>{{ formatDate(details.user.updatedAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="bookings-heading">
        <h2 id="bookings-heading" class="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Tickets :size="20" aria-hidden="true" />Booking summary
        </h2>
        <dl class="grid gap-4 sm:grid-cols-3">
          <div class="rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm shadow-slate-900/5">
            <dt class="text-sm text-slate-500">Total bookings</dt>
            <dd class="mt-3 text-3xl font-semibold text-slate-900">
              {{ details.bookingSummary.total }}
            </dd>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm shadow-slate-900/5">
            <dt class="text-sm text-slate-500">Confirmed</dt>
            <dd class="mt-3 text-3xl font-semibold text-blue-700">
              {{ details.bookingSummary.confirmed }}
            </dd>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm shadow-slate-900/5">
            <dt class="text-sm text-slate-500">Cancelled</dt>
            <dd class="mt-3 text-3xl font-semibold text-slate-700">
              {{ details.bookingSummary.cancelled }}
            </dd>
          </div>
        </dl>
        <p v-if="details.bookingSummary.total === 0" class="mt-3 text-sm text-slate-500">
          This user has no bookings yet.
        </p>
      </section>

      <section
        class="rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm shadow-slate-900/5 sm:p-6"
        aria-labelledby="status-heading"
      >
        <h2 id="status-heading" class="mb-2 flex items-center gap-2 text-lg font-semibold">
          <History :size="20" aria-hidden="true" />Status change record
        </h2>
        <template v-if="details.statusChange">
          <p class="mb-5 text-sm text-slate-500">Most recent account status change</p>
          <div class="overflow-x-auto rounded-2xl border border-slate-300">
            <table class="details-table" aria-labelledby="status-heading">
              <tbody>
                <tr>
                  <th scope="row">Changed at</th>
                  <td>{{ formatDate(details.statusChange.updatedAt) }}</td>
                </tr>
                <tr>
                  <th scope="row">Changed by</th>
                  <td class="wrap-anywhere">
                    <template v-if="details.statusChange.updatedBy">
                      <span>{{ details.statusChange.updatedBy.displayName }}</span>
                      <span class="mt-1 block text-sm text-slate-500">
                        {{ details.statusChange.updatedBy.email }}
                      </span>
                    </template>
                    <span v-else>Administrator information unavailable</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Reason</th>
                  <td class="whitespace-pre-wrap break-words">{{ details.statusChange.reason }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <p v-else class="mt-4 text-sm text-slate-500">No status changes recorded.</p>
      </section>
    </section>
  </AppShell>
</template>
