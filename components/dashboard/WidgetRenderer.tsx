import { dataSourceRegistry } from "@/components/dashboard/dataSources";
import WidgetErrorBoundary from "@/components/dashboard/WidgetErrorBoundary";
import WidgetShell from "@/components/dashboard/WidgetShell";
import UnsupportedWidget from "@/components/widgets/UnsupportedWidget";
import { widgetRegistry } from "@/config/widgetRegistry";
import { WidgetConfig } from "@/types/dashboard";

interface WidgetRendererProps {
  config: WidgetConfig;
}

/**
 * The single rendering pipeline used by both the real dashboard and the
 * configuration page's live preview:
 *   1. read widget configuration (prop)
 *   2. resolve its data source from the data source registry
 *   3. fetch/receive the data (via that data source's RTK Query hook)
 *   4. resolve its widget type from the widget registry
 *   5. render the matching widget, wrapped in shared loading/empty/error chrome
 *
 * There is no if/else or switch on widgetType or dataSource anywhere in this
 * pipeline -- both are plain object lookups, so adding a new widget type or
 * data source never requires touching this component.
 */
export default function WidgetRenderer({ config }: WidgetRendererProps) {
  const WidgetComponent = widgetRegistry[config.widgetType];
  const DataSource = dataSourceRegistry[config.dataSource];

  const meta = config.filter?.label ?? config.sort?.label;

  if (!WidgetComponent) {
    return (
      <WidgetShell title={config.title} meta={meta} state="success">
        <UnsupportedWidget config={config} />
      </WidgetShell>
    );
  }

  if (!DataSource) {
    return <WidgetShell title={config.title} state="error" errorMessage="Unknown data source." />;
  }

  return (
    <DataSource args={{ filter: config.filter, sort: config.sort, groupBy: config.groupBy }}>
      {({ data, isLoading, isFetching, isError, errorMessage, refetch }) => {
        const isEmpty = Boolean(data) && data!.rows.length === 0 && data!.series.length === 0;
        // RTK Query keeps serving the *previous* args' data (with isFetching:
        // true, isLoading: false) while a query for newly-changed args is in
        // flight, to avoid flicker on a plain revalidation. But this widget's
        // config (title/meta) has already moved on to the new args by this
        // render, so treating that stale `data` as "success" would show rows
        // that don't match the filter/sort this widget claims to be showing
        // -- exactly the "configuration it did not actually apply" case this
        // app's own design promises never to display silently. Reproduced
        // live: switching a dashboard-level filter's scope showed the old
        // filter's rows under the new filter's label for ~300-900ms with no
        // loading indicator, before this fix.
        const state = isLoading || isFetching ? "loading" : isError ? "error" : isEmpty ? "empty" : "success";

        return (
          <WidgetShell title={config.title} meta={meta} state={state} errorMessage={errorMessage} onRetry={refetch}>
            {data && (
              <WidgetErrorBoundary resetKey={`${JSON.stringify(config)}:${data.generatedAt}`}>
                <WidgetComponent config={config} data={data} />
              </WidgetErrorBoundary>
            )}
          </WidgetShell>
        );
      }}
    </DataSource>
  );
}
