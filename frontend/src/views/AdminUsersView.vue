<script setup>
import {
  ElAlert,
  ElButton,
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElPagination,
  ElSelect,
  ElSkeleton,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus'
import { ChevronLeft, ChevronRight, Search } from 'lucide-vue-next'
import { onBeforeUnmount, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import { listAdminUsers } from '../adminApi.js'

const route = useRoute()
const router = useRouter()
const data = ref(null)
const search = reactive({ q: '', status: '', role: '' })
const loading = ref(true)
const error = ref('')
let controller

async function loadUsers() {
  controller?.abort()
  const request = new AbortController()
  controller = request
  loading.value = true
  error.value = ''
  try {
    const result = await listAdminUsers(route.query, request.signal)
    if (!request.signal.aborted) data.value = result
  } catch (reason) {
    if (!request.signal.aborted) error.value = reason.message
  } finally {
    if (!request.signal.aborted) loading.value = false
  }
}

watch(
  () => route.query,
  () => {
    search.q = route.query.q || ''
    search.status = route.query.status || ''
    search.role = route.query.role || ''
    loadUsers()
  },
  { immediate: true },
)
onBeforeUnmount(() => controller?.abort())

function submitSearch() {
  router.push({
    query: {
      q: search.q || undefined,
      status: search.status || undefined,
      role: search.role || undefined,
    },
  })
}

function resetSearch() {
  Object.assign(search, { q: '', status: '', role: '' })
  router.push({ path: '/admin/users' })
}

function openUser(user) {
  router.push(`/admin/users/${encodeURIComponent(user.id)}`)
}

function go(page) {
  router.push({ query: { ...route.query, page } })
}
</script>

<template>
  <AppShell>
    <section aria-labelledby="users-heading">
      <p class="mb-2 text-sm font-semibold tracking-widest text-blue-700 uppercase">
        Administration
      </p>
      <h1 id="users-heading" class="text-2xl font-semibold tracking-tight">Users</h1>
      <p class="mt-2 text-sm text-slate-500">
        Browse accounts and view user details and booking activity.
      </p>

      <ElForm
        class="mt-6 grid gap-x-4 rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm
         shadow-slate-900/5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_160px_auto]"
        label-position="top"
        aria-label="Search and filter users"
        @submit.prevent="submitSearch"
      >
        <ElFormItem label="Search users" class="min-w-0 sm:col-span-2 lg:col-span-1">
          <ElInput
            v-model="search.q"
            placeholder="Name or email"
            aria-label="Search users by name or email"
            :prefix-icon="Search"
            :maxlength="100"
            clearable
            @clear="submitSearch"
          />
        </ElFormItem>
        <ElFormItem label="Status" class="min-w-0">
          <ElSelect
            v-model="search.status"
            :empty-values="[null, undefined]"
            aria-label="Filter by status"
            class="w-full"
            @change="submitSearch"
          >
            <ElOption label="All statuses" value="" />
            <ElOption label="Active" value="ACTIVE" />
            <ElOption label="Locked" value="LOCKED" />
            <ElOption label="Disabled" value="DISABLED" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="Role" class="min-w-0">
          <ElSelect
            v-model="search.role"
            :empty-values="[null, undefined]"
            aria-label="Filter by role"
            class="w-full"
            @change="submitSearch"
          >
            <ElOption label="All roles" value="" />
            <ElOption label="User" value="USER" />
            <ElOption label="Admin" value="ADMIN" />
          </ElSelect>
        </ElFormItem>
        <div class="mb-[18px] flex items-end gap-2 sm:col-span-2 lg:col-span-1">
          <ElButton type="primary" native-type="submit" :icon="Search">Search</ElButton>
          <ElButton @click="resetSearch">Reset</ElButton>
        </div>
      </ElForm>

      <div
        class="my-6 flex flex-wrap justify-between gap-2 text-sm text-slate-500"
        aria-live="polite"
      >
        <span>Newest first</span>
        <span v-if="data && !loading && !error">
          {{ data.pagination.totalItems }} user{{ data.pagination.totalItems === 1 ? '' : 's' }}
        </span>
      </div>
      <div v-if="loading" class="py-8" role="status">
        <p class="mb-4 text-slate-500">Loading users…</p>
        <ElSkeleton :rows="5" animated />
      </div>
      <div v-else-if="error" class="grid gap-4">
        <ElAlert :title="error" type="error" :closable="false" role="alert" />
        <ElButton class="justify-self-start" @click="loadUsers">Try again</ElButton>
      </div>
      <template v-else-if="data">
        <ElTable
          :data="data.users"
          row-key="id"
          size="default"
          scrollbar-always-on
          class="w-full animate-fade-in overflow-hidden rounded-2xl border border-slate-200 shadow-sm
           shadow-slate-900/5 [&_th]:bg-slate-50! [&_th]:py-3! [&_th]:font-medium!
           [&_th]:text-slate-500! [&_td]:py-4! [&_.el-table__row]:cursor-pointer"
          aria-label="Users"
          @row-click="openUser"
        >
          <ElTableColumn label="User" min-width="280">
            <template #default="{ row }">
              <RouterLink
                :to="`/admin/users/${encodeURIComponent(row.id)}`"
                class="font-semibold text-slate-900 hover:text-blue-700 hover:underline"
                @click.stop
              >
                {{ row.displayName }}
              </RouterLink>
              <p class="mt-1 break-all text-sm text-slate-500">{{ row.email }}</p>
            </template>
          </ElTableColumn>
          <ElTableColumn label="Role" width="130">
            <template #default="{ row }">
              <ElTag size="small" :type="row.role === 'ADMIN' ? 'primary' : 'info'" effect="plain">
                {{ row.role === 'ADMIN' ? 'Admin' : 'User' }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="Status" width="140">
            <template #default="{ row }">
              <ElTag
                size="small"
                :type="
                  row.status === 'ACTIVE'
                    ? 'success'
                    : row.status === 'LOCKED'
                      ? 'warning'
                      : 'danger'
                "
              >
                {{ row.status === 'ACTIVE' ? 'Active' : row.status === 'LOCKED' ? 'Locked' : 'Disabled' }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="Joined" min-width="170">
            <template #default="{ row }">
              {{ row.createdAt
                ? new Date(row.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : '—' }}
            </template>
          </ElTableColumn>
          <ElTableColumn label="Action" width="145">
            <template #default="{ row }">
              <RouterLink
                :to="`/admin/users/${encodeURIComponent(row.id)}`"
                :aria-label="`View details for ${row.displayName}`"
                class="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
                @click.stop
              >
                View details<ChevronRight :size="16" aria-hidden="true" />
              </RouterLink>
            </template>
          </ElTableColumn>
          <template #empty>
            <div class="grid justify-items-center gap-3 px-4 py-12">
              <p class="font-medium text-slate-700">
                No users found
              </p>
              <p class="text-sm text-slate-500">
                Try a different search or clear the filters.
              </p>
              <ElButton @click="resetSearch">Clear filters</ElButton>
            </div>
          </template>
        </ElTable>
        <ElPagination
          v-if="data.pagination.totalPages > 1"
          class="mt-6 justify-center"
          background
          layout="prev, pager, next"
          :pager-count="5"
          :prev-icon="ChevronLeft"
          :next-icon="ChevronRight"
          :page-size="data.pagination.limit"
          :total="data.pagination.totalItems"
          :current-page="data.pagination.page"
          aria-label="User pages"
          @update:current-page="go"
        />
      </template>
    </section>
  </AppShell>
</template>
