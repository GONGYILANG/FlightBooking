<script setup lang="ts">
import {
  ElAlert,
  ElButton,
  ElDescriptions,
  ElDescriptionsItem,
  ElSkeleton,
  ElTag,
} from 'element-plus'
import { ArrowLeft, History, Tickets } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import { ApiError, getAdminUser } from '../api'
import type { AdminUserDetails } from '../types'

const route = useRoute()
const details = ref<AdminUserDetails | null>(null)
const loading = ref(true)
const error = ref('')
const notFound = ref(false)
const reload = ref(0)

watch(
  [() => route.params.userId, reload],
  async (_value, _old, cleanup) => {
    const controller = new AbortController()
    cleanup(() => controller.abort())
    loading.value = true
    error.value = ''
    notFound.value = false
    details.value = null
    try {
      const result = await getAdminUser(String(route.params.userId), controller.signal)
      if (!controller.signal.aborted) details.value = result
    } catch (reason) {
      if (controller.signal.aborted) return
      notFound.value = reason instanceof ApiError && reason.code === 'USER_NOT_FOUND'
      error.value = notFound.value
        ? 'User not found. This account may no longer exist.'
        : (reason as Error).message
    } finally {
      if (!controller.signal.aborted) loading.value = false
    }
  },
  { immediate: true },
)

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('en-US') : '—'
}
</script>

<template>
  <AppShell>
    <RouterLink
      :to="{ path: '/admin/users', query: route.query }"
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
        {{ notFound ? 'User not found' : 'Unable to load user' }}
      </h1>
      <ElAlert :title="error" type="error" :closable="false" role="alert" />
      <ElButton v-if="!notFound" class="justify-self-start" @click="reload++">Try again</ElButton>
    </div>
    <section v-else-if="details" class="space-y-6" aria-labelledby="user-heading">
      <div>
        <p class="mb-2 text-xs font-semibold tracking-widest text-blue-700 uppercase">
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
        class="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm shadow-slate-900/5 sm:p-6"
        aria-labelledby="account-heading"
      >
        <h2 id="account-heading" class="mb-5 text-lg font-semibold">Personal information</h2>
        <ElDescriptions :column="1" border label-width="140">
          <ElDescriptionsItem label="User ID">
            <span class="break-all">{{ details.user.id }}</span>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="Display name">
            <span class="break-all">{{ details.user.displayName }}</span>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="Email">
            <span class="break-all">{{ details.user.email }}</span>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="Role">
            {{ details.user.role === 'ADMIN' ? 'Admin' : 'User' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="Account status">
            {{ details.user.status === 'ACTIVE' ? 'Active'
              : details.user.status === 'LOCKED' ? 'Locked' : 'Disabled' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="Joined">{{ formatDate(details.user.createdAt) }}</ElDescriptionsItem>
          <ElDescriptionsItem label="Last updated">
            {{ formatDate(details.user.updatedAt) }}
          </ElDescriptionsItem>
        </ElDescriptions>
      </section>

      <section aria-labelledby="bookings-heading">
        <h2 id="bookings-heading" class="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Tickets :size="20" aria-hidden="true" />Booking summary
        </h2>
        <dl class="grid gap-4 sm:grid-cols-3">
          <div class="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm shadow-slate-900/5">
            <dt class="text-sm text-slate-500">Total bookings</dt>
            <dd class="mt-3 text-3xl font-semibold text-slate-900">
              {{ details.bookingSummary.total }}
            </dd>
          </div>
          <div class="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm shadow-slate-900/5">
            <dt class="text-sm text-slate-500">Confirmed</dt>
            <dd class="mt-3 text-3xl font-semibold text-blue-700">
              {{ details.bookingSummary.confirmed }}
            </dd>
          </div>
          <div class="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm shadow-slate-900/5">
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
        class="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm shadow-slate-900/5 sm:p-6"
        aria-labelledby="status-heading"
      >
        <h2 id="status-heading" class="mb-2 flex items-center gap-2 text-lg font-semibold">
          <History :size="20" aria-hidden="true" />Status change record
        </h2>
        <template v-if="details.statusChange">
          <p class="mb-5 text-sm text-slate-500">Most recent account status change</p>
          <ElDescriptions :column="1" border label-width="140">
            <ElDescriptionsItem label="Changed at">
              {{ formatDate(details.statusChange.updatedAt) }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="Changed by">
              <template v-if="details.statusChange.updatedBy">
                <span class="break-all">{{ details.statusChange.updatedBy.displayName }}</span>
                <span class="mt-1 block break-all text-sm text-slate-500">
                  {{ details.statusChange.updatedBy.email }}
                </span>
              </template>
              <span v-else>Administrator information unavailable</span>
            </ElDescriptionsItem>
            <ElDescriptionsItem label="Reason">
              <span class="whitespace-pre-wrap break-words">
                {{ details.statusChange.reason || 'No reason recorded' }}
              </span>
            </ElDescriptionsItem>
          </ElDescriptions>
        </template>
        <p v-else class="mt-4 text-sm text-slate-500">No status changes recorded.</p>
      </section>
    </section>
  </AppShell>
</template>
