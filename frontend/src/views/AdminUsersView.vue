<script setup lang="ts">
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
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import { listAdminUsers } from '../api'
import { boundedInteger } from '../lib'
import type { AdminUser, AdminUserListParams, Pagination, User, UserStatus } from '../types'

const route = useRoute()
const router = useRouter()
const users = ref<AdminUser[]>([])
const pagination = ref<Pagination>({ page: 1, limit: 20, totalItems: 0, totalPages: 0 })
const query = ref('')
const status = ref<UserStatus | ''>('')
const role = ref<User['role'] | ''>('')
const loading = ref(true)
const error = ref('')
const reload = ref(0)
const statuses: UserStatus[] = ['ACTIVE', 'LOCKED', 'DISABLED']
const roles: User['role'][] = ['USER', 'ADMIN']

const filters = computed<AdminUserListParams>(() => ({
  q: typeof route.query.q === 'string' ? route.query.q.trim().slice(0, 100) : '',
  status: statuses.find((value) => value === route.query.status),
  role: roles.find((value) => value === route.query.role),
  page: boundedInteger(route.query.page, 1, 10000),
  limit: 20,
}))
const hasFilters = computed(() =>
  Boolean(filters.value.q || filters.value.status || filters.value.role),
)

watch(
  [filters, reload],
  async (_value, _old, cleanup) => {
    const controller = new AbortController()
    cleanup(() => controller.abort())
    query.value = filters.value.q ?? ''
    status.value = filters.value.status ?? ''
    role.value = filters.value.role ?? ''
    loading.value = true
    error.value = ''
    users.value = []
    try {
      const result = await listAdminUsers(filters.value, controller.signal)
      if (controller.signal.aborted) return
      users.value = result.users
      pagination.value = result.pagination
    } catch (reason) {
      if (!controller.signal.aborted) error.value = (reason as Error).message
    } finally {
      if (!controller.signal.aborted) loading.value = false
    }
  },
  { immediate: true },
)

function applyFilters() {
  const nextQuery = {
    ...(query.value.trim() ? { q: query.value.trim() } : {}),
    ...(status.value ? { status: status.value } : {}),
    ...(role.value ? { role: role.value } : {}),
  }
  void router.push({ path: '/admin/users', query: nextQuery })
}

function resetFilters() {
  query.value = ''
  status.value = ''
  role.value = ''
  void router.push({ path: '/admin/users' })
}

function openUser(user: AdminUser) {
  void router.push({ path: `/admin/users/${encodeURIComponent(user.id)}`, query: route.query })
}

function go(page: number) {
  void router.push({ query: { ...route.query, page } })
}
</script>

<template>
  <AppShell>
    <section aria-labelledby="users-heading">
      <p class="mb-2 text-xs font-semibold tracking-widest text-blue-700 uppercase">
        Administration
      </p>
      <h1 id="users-heading" class="text-2xl font-semibold tracking-tight">Users</h1>
      <p class="mt-2 text-sm text-slate-500">
        Browse accounts and view user details and booking activity.
      </p>

      <ElForm
        class="mt-6 grid gap-x-4 rounded-xl border border-slate-200 bg-surface p-5 shadow-sm
         shadow-slate-900/5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_160px_auto]"
        label-position="top"
        aria-label="Search and filter users"
        @submit.prevent="applyFilters"
      >
        <ElFormItem label="Search users" class="min-w-0 sm:col-span-2 lg:col-span-1">
          <ElInput
            v-model="query"
            placeholder="Name or email"
            aria-label="Search users by name or email"
            :prefix-icon="Search"
            :maxlength="100"
            clearable
            @clear="applyFilters"
          />
        </ElFormItem>
        <ElFormItem label="Status" class="min-w-0">
          <ElSelect
            v-model="status"
            :empty-values="[null, undefined]"
            aria-label="Filter by status"
            class="w-full"
            @change="applyFilters"
          >
            <ElOption label="All statuses" value="" />
            <ElOption label="Active" value="ACTIVE" />
            <ElOption label="Locked" value="LOCKED" />
            <ElOption label="Disabled" value="DISABLED" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="Role" class="min-w-0">
          <ElSelect
            v-model="role"
            :empty-values="[null, undefined]"
            aria-label="Filter by role"
            class="w-full"
            @change="applyFilters"
          >
            <ElOption label="All roles" value="" />
            <ElOption label="User" value="USER" />
            <ElOption label="Admin" value="ADMIN" />
          </ElSelect>
        </ElFormItem>
        <div class="mb-[18px] flex items-end gap-2 sm:col-span-2 lg:col-span-1">
          <ElButton type="primary" native-type="submit" :icon="Search">Search</ElButton>
          <ElButton @click="resetFilters">Reset</ElButton>
        </div>
      </ElForm>

      <div
        class="my-6 flex flex-wrap justify-between gap-2 text-sm text-slate-500"
        aria-live="polite"
      >
        <span>{{ hasFilters ? 'Filtered users' : 'All users' }} · Newest first</span>
        <span v-if="!loading && !error">
          {{ pagination.totalItems }} user{{ pagination.totalItems === 1 ? '' : 's' }}
        </span>
      </div>
      <div v-if="loading" class="py-8" role="status">
        <p class="mb-4 text-slate-500">Loading users…</p>
        <ElSkeleton :rows="5" animated />
      </div>
      <div v-else-if="error" class="grid gap-4">
        <ElAlert :title="error" type="error" :closable="false" role="alert" />
        <ElButton class="justify-self-start" @click="reload++">Try again</ElButton>
      </div>
      <template v-else>
        <ElTable
          :data="users"
          row-key="id"
          size="default"
          scrollbar-always-on
          class="w-full overflow-hidden rounded-xl border border-slate-200 shadow-sm
           shadow-slate-900/5 [&_th]:bg-slate-50! [&_th]:py-3! [&_th]:font-medium!
           [&_th]:text-slate-500! [&_td]:py-4! [&_.el-table__row]:cursor-pointer"
          aria-label="Users"
          @row-click="openUser"
        >
          <ElTableColumn label="User" min-width="280">
            <template #default="{ row }">
              <RouterLink
                :to="{ path: `/admin/users/${encodeURIComponent(row.id)}`, query: route.query }"
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
                :to="{ path: `/admin/users/${encodeURIComponent(row.id)}`, query: route.query }"
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
                {{ hasFilters ? 'No users match your search' : 'No users yet' }}
              </p>
              <p class="text-sm text-slate-500">
                {{ hasFilters
                  ? 'Try a different name, email, status or role.'
                  : 'Registered users will appear here.' }}
              </p>
              <ElButton v-if="hasFilters" @click="resetFilters">Clear filters</ElButton>
            </div>
          </template>
        </ElTable>
        <ElPagination
          v-if="pagination.totalPages > 1"
          class="mt-6 justify-center"
          background
          layout="prev, pager, next"
          :pager-count="5"
          :prev-icon="ChevronLeft"
          :next-icon="ChevronRight"
          :page-size="pagination.limit"
          :total="pagination.totalItems"
          :current-page="pagination.page"
          aria-label="User pages"
          @update:current-page="go"
        />
      </template>
    </section>
  </AppShell>
</template>
