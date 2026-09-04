import { dataSourceRegistry } from "@/components/dashboard/dataSources";
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
    <DataSource args={{ filter: config.filter, sort: config.sort }}>
      {({ data, isLoading, isError, errorMessage, refetch }) => {
        const isEmpty = Boolean(data) && data!.rows.length === 0 && data!.series.length === 0;
        const state = isLoading ? "loading" : isError ? "error" : isEmpty ? "empty" : "success";

        return (
          <WidgetShell title={config.title} meta={meta} state={state} errorMessage={errorMessage} onRetry={refetch}>
            {data && <WidgetComponent config={config} data={data} />}
          </WidgetShell>
        );
      }}
    </DataSource>
  );
}
