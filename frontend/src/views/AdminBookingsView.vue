<script setup>
import {
  ElAlert,
  ElButton,
  ElDatePicker,
  ElForm,
  ElFormItem,
  ElOption,
  ElPagination,
  ElSelect,
  ElSkeleton,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus'
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Search } from 'lucide-vue-next'
import { onBeforeUnmount, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import { listAdminBookings } from '../adminApi.js'
import { formatFlightDate, formatMoney, formatTime } from '../lib'

const route = useRoute()
const router = useRouter()
const data = ref(null)
const search = reactive({ status: '', source: '', createdFrom: '', createdTo: '' })
const loading = ref(true)
const error = ref('')
let controller

async function loadBookings() {
  controller?.abort()
  const request = new AbortController()
  controller = request
  loading.value = true
  error.value = ''
  try {
    const result = await listAdminBookings(route.query, request.signal)
    if (!request.signal.aborted) data.value = result
  } catch (reason) {
    if (!request.signal.aborted) {
      error.value = reason.fields.map(field => field.message).join(' ') || reason.message
    }
  } finally {
    if (!request.signal.aborted) loading.value = false
  }
}

watch(
  () => route.query,
  () => {
    search.status = route.query.status || ''
    search.source = route.query.source || ''
    search.createdFrom = route.query.createdFrom || ''
    search.createdTo = route.query.createdTo || ''
    loadBookings()
  },
  { immediate: true },
)
onBeforeUnmount(() => controller?.abort())

function submitSearch() {
  router.push({
    query: {
      ...route.query,
      status: search.status || undefined,
      source: search.source || undefined,
      createdFrom: search.createdFrom || undefined,
      createdTo: search.createdTo || undefined,
      page: undefined,
    },
  })
}

function resetSearch() {
  router.push({ query: { userId: route.query.userId } })
}

function go(page) {
  router.push({ query: { ...route.query, page } })
}
</script>

<template>
  <AppShell wide>
    <section aria-labelledby="bookings-heading">
      <p class="mb-2 text-sm font-semibold tracking-widest text-blue-700 uppercase">
        Administration
      </p>
      <h1 id="bookings-heading" class="text-2xl font-semibold tracking-tight">Bookings</h1>
      <p class="mt-2 text-sm text-slate-500">Review bookings by status, source and creation time.</p>

      <div
        v-if="route.query.userId"
        class="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-blue-700/10 p-4"
      >
        <RouterLink
          class="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-blue-700"
          :to="`/admin/users/${encodeURIComponent(route.query.userId)}`"
        >
          <ArrowLeft class="shrink-0" :size="16" aria-hidden="true" />
          <span class="wrap-anywhere">User details · {{ route.query.userId }}</span>
        </RouterLink>
        <RouterLink class="text-sm font-medium text-blue-700 hover:underline" to="/admin/bookings">
          View all bookings
        </RouterLink>
      </div>

      <ElForm
        class="mt-6 grid gap-x-4 rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm
         shadow-slate-900/5 sm:grid-cols-2 xl:grid-cols-[150px_150px_minmax(0,1fr)_minmax(0,1fr)_auto]"
        label-position="top"
        aria-label="Filter bookings"
        @submit.prevent="submitSearch"
      >
        <ElFormItem label="Status" class="min-w-0">
          <ElSelect
            class="w-full"
            v-model="search.status"
            :empty-values="[null, undefined]"
            aria-label="Filter by status"
          >
            <ElOption label="All statuses" value="" />
            <ElOption label="Confirmed" value="CONFIRMED" />
            <ElOption label="Cancelled" value="CANCELLED" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="Source" class="min-w-0">
          <ElSelect
            class="w-full"
            v-model="search.source"
            :empty-values="[null, undefined]"
            aria-label="Filter by source"
          >
            <ElOption label="All sources" value="" />
            <ElOption label="Web" value="UI" />
            <ElOption label="AI" value="AI" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="Created from" class="min-w-0">
          <ElDatePicker
            class="w-full!"
            v-model="search.createdFrom"
            type="datetime"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DDTHH:mm:ssZ"
            placeholder="From date & time"
            aria-label="Created from"
          />
        </ElFormItem>
        <ElFormItem label="Created to" class="min-w-0">
          <ElDatePicker
            class="w-full!"
            v-model="search.createdTo"
            type="datetime"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DDTHH:mm:ssZ"
            placeholder="To date & time"
            aria-label="Created to"
          />
        </ElFormItem>
        <div class="mb-[18px] flex items-end gap-2 sm:col-span-2 xl:col-span-1">
          <ElButton type="primary" native-type="submit" :icon="Search">Search</ElButton>
          <ElButton @click="resetSearch">Reset</ElButton>
        </div>
        <p class="text-xs text-slate-500 sm:col-span-2 xl:col-span-5">
          Dates use your local time. Both the start and end time are included.
        </p>
      </ElForm>

      <div class="my-6 flex justify-between gap-3 text-sm text-slate-500" aria-live="polite">
        <span>Newest first</span>
        <span v-if="data && !loading && !error">
          {{ data.pagination.totalItems }} booking{{ data.pagination.totalItems === 1 ? '' : 's' }}
        </span>
      </div>
      <div v-if="loading" class="py-8" role="status">
        <p class="mb-4 text-slate-500">Loading bookings…</p>
        <ElSkeleton :rows="5" animated />
      </div>
      <div v-else-if="error" class="grid gap-4">
        <ElAlert :title="error" type="error" :closable="false" role="alert" />
        <ElButton class="justify-self-start" @click="loadBookings">Try again</ElButton>
      </div>
      <template v-else-if="data">
        <ElTable
          :data="data.bookings"
          row-key="id"
          size="default"
          scrollbar-always-on
          class="w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm
           shadow-slate-900/5 [&_th]:bg-slate-50! [&_th]:py-3! [&_th]:font-medium!
           [&_th]:text-slate-500! [&_td]:py-3!"
          aria-label="Administrator bookings"
        >
          <ElTableColumn prop="bookingReference" label="Booking" min-width="200">
            <template #default="{ row }">
              <strong>{{ row.bookingReference }}</strong>
              <p class="mt-1 text-xs text-slate-500">
                Created {{ new Date(row.createdAt).toLocaleString('en-US') }}
              </p>
            </template>
          </ElTableColumn>
          <ElTableColumn label="User" min-width="220">
            <template #default="{ row }">
              <RouterLink
                class="font-medium text-blue-700 hover:underline"
                :to="`/admin/users/${encodeURIComponent(row.user.id)}`"
              >
                {{ row.user.displayName }}
              </RouterLink>
              <p class="mt-1 wrap-anywhere text-xs text-slate-500">
                {{ row.user.email }}
              </p>
            </template>
          </ElTableColumn>
          <ElTableColumn label="Flight & route" min-width="280">
            <template #default="{ row }">
              <div class="space-y-2 py-1">
                <strong>{{ row.flight.flightNumber }}</strong>
                <p class="text-sm">
                  {{ formatFlightDate(row.flight.departureAt, row.flight.originAirport.timezone) }}
                </p>
                <p class="flex items-center gap-1 text-xs text-slate-500">
                  {{ formatTime(row.flight.departureAt, row.flight.originAirport.timezone) }}
                  {{ row.flight.originAirport.iataCode }}
                  <ArrowRight :size="14" aria-hidden="true" />
                  {{ formatTime(row.flight.arrivalAt, row.flight.destinationAirport.timezone) }}
                  {{ row.flight.destinationAirport.iataCode }}
                </p>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn prop="seatCount" label="Travelers" width="100" />
          <ElTableColumn label="Total" min-width="140">
            <template #default="{ row }">
              {{ formatMoney(row.pricing.totalAmount, row.pricing.currency) }}
            </template>
          </ElTableColumn>
          <ElTableColumn label="Source" min-width="110">
            <template #default="{ row }">{{ row.source === 'AI' ? 'AI' : 'Web' }}</template>
          </ElTableColumn>
          <ElTableColumn label="Status" min-width="130">
            <template #default="{ row }">
              <ElTag size="small" :type="row.status === 'CONFIRMED' ? 'success' : 'danger'">
                {{ row.status === 'CONFIRMED' ? 'Confirmed' : 'Cancelled' }}
              </ElTag>
            </template>
          </ElTableColumn>
          <template #empty>
            <div class="grid justify-items-center gap-3 py-10">
              <p class="font-medium text-slate-700">No bookings found</p>
              <p class="text-sm text-slate-500">Try different filters or clear them.</p>
            </div>
          </template>
        </ElTable>
        <ElPagination
          v-if="data.pagination.totalPages"
          class="mt-6 justify-center"
          background
          layout="prev, pager, next"
          :prev-icon="ChevronLeft"
          :next-icon="ChevronRight"
          :page-size="data.pagination.limit"
          :total="data.pagination.totalItems"
          :current-page="data.pagination.page"
          aria-label="Booking pages"
          @update:current-page="go"
        />
      </template>
    </section>
  </AppShell>
</template>
