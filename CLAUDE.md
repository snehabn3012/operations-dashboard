# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

@AGENTS.md

## Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
npx tsc --noEmit
```

## Tech Stack

Use the existing stack. Do not replace these technologies:

* Next.js App Router
* React
* TypeScript
* Redux Toolkit
* RTK Query
* Recharts
* CSS Modules + CSS Grid
* @dnd-kit for drag and drop
* IntersectionObserver for infinite scroll

The application uses a mock API only. There is no real backend.

---

## Project Goal

This is a **configuration-driven Operations Dashboard**.

The dashboard must be driven by configuration rather than hardcoded widgets or role-specific pages.

The configuration controls:

* Role
* Widget visibility
* Widget order
* Widget type
* Data source
* Filters
* Sorting
* Metrics
* Layout

The dashboard should not need to change when new widgets, roles, layouts, or data sources are added.

---

## Architecture

Keep these concerns separate:

```text
Configuration
     ↓
Validation
     ↓
Widget Renderer
     ↓
Widget Registry
     ↓
Data Source
     ↓
RTK Query
     ↓
Mock API
```

### `/dashboard`

Renders the saved dashboard configuration.

### `/configure`

Provides the dashboard builder:

* Select role
* Browse widget catalogue
* Drag widgets onto canvas
* Reorder widgets
* Remove widgets
* Select a widget
* Configure the selected widget
* Preview changes
* Save/reset configuration

The preview must use the **same WidgetRenderer and registries** as `/dashboard`.

Do not create a separate preview rendering system.

---

## State Management

### Redux Toolkit

Use Redux Toolkit for client/UI state:

* Selected role
* Selected widget
* Draft dashboard configuration
* Widget ordering
* Widget layout
* Unsaved changes

### RTK Query

Use RTK Query for server/data state:

* Dashboard configuration
* Customers
* Transactions
* Revenue
* Orders
* Payments
* Dashboard modules
* Loading/error states
* Caching
* Mutations
* Pagination

Do not duplicate RTK Query data into Redux without a clear reason.

---

## Widget Registry

Use a registry pattern.

Do not create large `if`/`switch` statements based on `widgetType` or `dataSource`.

Example:

```ts
const widgetRegistry = {
  kpi: KpiWidget,
  barChart: BarChartWidget,
  lineChart: LineChartWidget,
  table: TableWidget,
  list: ListWidget,
};
```

Adding a widget should normally require adding it to the appropriate registry rather than modifying the dashboard renderer.

The same data source must be usable by different widget types.

For example:

```text
transactions
   ├── KPI
   ├── Bar Chart
   ├── Line Chart
   ├── Table
   └── List
```

---

## Configuration

Treat dashboard configuration as declarative data.

Use a structure similar to:

```ts
type WidgetConfig = {
  id: string;
  type: string;
  title: string;
  dataSource: string;
  visible: boolean;
  order: number;
  layout: {
    width: number;
    height: number;
  };
  filters?: FilterConfig[];
  sorting?: SortConfig[];
};
```

Validate and normalize configuration before rendering.

Handle:

* Missing properties
* Invalid widget types
* Invalid data sources
* Invalid layouts
* Invalid filters
* Invalid ordering
* Older configuration formats

Invalid widgets should show a safe fallback rather than crash the dashboard.

---

## Widget Catalogue

The available widget catalogue should contain **preview-only cards**.

Do not put configuration controls inside catalogue cards.

Users should:

```text
Browse widget
     ↓
Drag to canvas
     ↓
Select widget
     ↓
Configure widget
```

The configuration panel should be context-aware based on the selected widget type.

---

## Widget States

Every widget must independently support:

* Loading
* Success
* Empty
* Error

One failed widget must not break the rest of the dashboard.

Errors must be visible to the user.

Do not silently display incorrect or stale data.

---

## Mock API

Keep mock server/data logic inside:

```text
data/mockApi.ts
data/mockData.ts
```

Mock API calls should:

* Be asynchronous
* Simulate network latency
* Be capable of failing
* Support dashboard configuration persistence

Do not use `localStorage` as the source of truth.

RTK Query should access the mock API through the existing API layer.

---

## Pagination / Infinite Scroll

Use `IntersectionObserver` for dashboard-level infinite scrolling.

Keep dashboard module pagination separate from Table/List widget pagination.

Requirements:

* Load modules incrementally
* Prevent duplicate requests
* Stop when there are no more modules
* Preserve previously loaded modules
* Show loading state
* Show retry on failure

Do not use scroll-position calculations.

---

## Layout

Use CSS Grid.

Keep the dashboard and configuration canvas visually consistent.

The same grid rules should be used by both `/dashboard` and `/configure`.

Do not create separate grid implementations for preview and dashboard.

---

## TypeScript

Use strict TypeScript.

Avoid `any`.

Prefer typed configuration models and discriminated unions where useful.

---

## Important Rules

### Do

* Keep the dashboard configuration-driven.
* Keep widgets independent.
* Use RTK Query for server state.
* Use Redux Toolkit for client state.
* Validate configuration.
* Isolate widget errors.
* Use the widget registry.
* Keep preview and dashboard rendering identical.
* Keep persistence behind the API layer.
* Use stable widget IDs.
* Keep the code modular.

### Do not

* Hardcode dashboards per role.
* Hardcode widgets inside `Dashboard.tsx`.
* Create a separate preview renderer.
* Use `localStorage` as primary persistence.
* Put server data into Redux unnecessarily.
* Use large `if`/`switch` statements for widget types.
* Allow one widget failure to crash the dashboard.
* Silently display invalid data.
* Add unnecessary dependencies.

---

## Before Finishing Work

Run:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Check that changes do not break:

* `/dashboard`
* `/configure`
* Widget rendering
* Drag and drop
* Configuration saving
* Role switching
* Loading/error/empty states
* Infinite scrolling
