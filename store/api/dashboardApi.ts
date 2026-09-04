import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";

import * as mockApi from "@/data/mockApi";
import {
  DashboardConfig,
  DataSourceQueryArgs,
  DataSourceResult,
  ModulesPage,
  ModulesPageArgs,
  Role,
} from "@/types/dashboard";

/**
 * There is no real HTTP backend in this prototype: every endpoint below
 * delegates to a mock API function (data/mockApi.ts) that simulates network
 * latency and can fail. RTK Query still owns caching, loading/error state,
 * refetching, and mutation invalidation exactly as it would against a real
 * server, so swapping fakeBaseQuery + queryFn for fetchBaseQuery later is a
 * localized change.
 */
export const dashboardApi = createApi({
  reducerPath: "dashboardApi",
  baseQuery: fakeBaseQuery<string>(),
  tagTypes: ["Config", "Modules"],
  endpoints: (builder) => ({
    getCustomers: builder.query<DataSourceResult, DataSourceQueryArgs>({
      queryFn: async (args) => {
        try {
          return { data: await mockApi.getCustomers(args) };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to load customers" };
        }
      },
    }),
    getTransactions: builder.query<DataSourceResult, DataSourceQueryArgs>({
      queryFn: async (args) => {
        try {
          return { data: await mockApi.getTransactions(args) };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to load transactions" };
        }
      },
    }),
    getRevenue: builder.query<DataSourceResult, DataSourceQueryArgs>({
      queryFn: async (args) => {
        try {
          return { data: await mockApi.getRevenue(args) };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to load revenue" };
        }
      },
    }),
    getOrders: builder.query<DataSourceResult, DataSourceQueryArgs>({
      queryFn: async (args) => {
        try {
          return { data: await mockApi.getOrders(args) };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to load orders" };
        }
      },
    }),
    getPayments: builder.query<DataSourceResult, DataSourceQueryArgs>({
      queryFn: async (args) => {
        try {
          return { data: await mockApi.getPayments(args) };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to load payments" };
        }
      },
    }),

    getDashboardConfig: builder.query<DashboardConfig, Role>({
      queryFn: async (role) => {
        try {
          return { data: await mockApi.getDashboardConfig(role) };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to load configuration" };
        }
      },
      providesTags: (_result, _error, role) => [{ type: "Config", id: role }],
    }),
    updateDashboardConfig: builder.mutation<DashboardConfig, { role: Role; config: DashboardConfig }>({
      queryFn: async ({ role, config }) => {
        try {
          return { data: await mockApi.updateDashboardConfig(role, config) };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to save configuration" };
        }
      },
      invalidatesTags: (_result, _error, { role }) => [
        { type: "Config", id: role },
        { type: "Modules", id: role },
      ],
    }),

    getDashboardModules: builder.query<ModulesPage, ModulesPageArgs>({
      queryFn: async ({ role, page, limit }) => {
        try {
          return { data: await mockApi.getDashboardModules(role, page, limit) };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to load modules" };
        }
      },
      // Collapse every page request for a role into a single cache entry so
      // pages accumulate instead of overwriting each other.
      serializeQueryArgs: ({ queryArgs }) => queryArgs.role,
      merge: (currentCache, newPage) => {
        if (newPage.page === 1) {
          currentCache.modules = newPage.modules;
        } else {
          const seen = new Set(currentCache.modules.map((m) => m.id));
          for (const widgetModule of newPage.modules) {
            if (!seen.has(widgetModule.id)) currentCache.modules.push(widgetModule);
          }
        }
        currentCache.page = newPage.page;
        currentCache.pageSize = newPage.pageSize;
        currentCache.total = newPage.total;
        currentCache.hasMore = newPage.hasMore;
      },
      forceRefetch: ({ currentArg, previousArg }) =>
        currentArg?.page !== previousArg?.page || currentArg?.role !== previousArg?.role,
      providesTags: (_result, _error, arg) => [{ type: "Modules", id: arg.role }],
    }),
  }),
});

export const {
  useGetCustomersQuery,
  useGetTransactionsQuery,
  useGetRevenueQuery,
  useGetOrdersQuery,
  useGetPaymentsQuery,
  useGetDashboardConfigQuery,
  useUpdateDashboardConfigMutation,
  useGetDashboardModulesQuery,
} = dashboardApi;
