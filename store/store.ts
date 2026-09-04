import { configureStore } from "@reduxjs/toolkit";

import { dashboardApi } from "@/store/api/dashboardApi";
import dashboardUiReducer from "@/store/dashboardSlice";

export function makeStore() {
  return configureStore({
    reducer: {
      dashboardUi: dashboardUiReducer,
      [dashboardApi.reducerPath]: dashboardApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(dashboardApi.middleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
