import { ComponentType, ReactNode } from "react";

import {
  useGetCustomersQuery,
  useGetOrdersQuery,
  useGetPaymentsQuery,
  useGetRevenueQuery,
  useGetTransactionsQuery,
} from "@/store/api/dashboardApi";
import { DataSourceKey, DataSourceQueryArgs, DataSourceResult } from "@/types/dashboard";

export interface DataSourceQueryState {
  data: DataSourceResult | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  errorMessage?: string;
  refetch: () => void;
}

interface DataSourceProps {
  args: DataSourceQueryArgs;
  children: (state: DataSourceQueryState) => ReactNode;
}

function toState(result: ReturnType<typeof useGetCustomersQuery>): DataSourceQueryState {
  return {
    data: result.data,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    isError: result.isError,
    errorMessage: result.error ? String(result.error) : undefined,
    refetch: () => {
      result.refetch();
    },
  };
}

function CustomersSource({ args, children }: DataSourceProps) {
  return <>{children(toState(useGetCustomersQuery(args)))}</>;
}
function TransactionsSource({ args, children }: DataSourceProps) {
  return <>{children(toState(useGetTransactionsQuery(args)))}</>;
}
function RevenueSource({ args, children }: DataSourceProps) {
  return <>{children(toState(useGetRevenueQuery(args)))}</>;
}
function OrdersSource({ args, children }: DataSourceProps) {
  return <>{children(toState(useGetOrdersQuery(args)))}</>;
}
function PaymentsSource({ args, children }: DataSourceProps) {
  return <>{children(toState(useGetPaymentsQuery(args)))}</>;
}

/**
 * Same idea as the widget registry: each data source gets a fixed component
 * that calls exactly one RTK Query hook, so WidgetRenderer can pick "which
 * data to fetch" via a lookup instead of a conditional/switch calling hooks
 * dynamically (which would break the rules of hooks).
 */
export const dataSourceRegistry: Record<DataSourceKey, ComponentType<DataSourceProps>> = {
  customers: CustomersSource,
  transactions: TransactionsSource,
  revenue: RevenueSource,
  orders: OrdersSource,
  payments: PaymentsSource,
};
