"use client";

import {
  DATA_SOURCE_OPTIONS,
  FIELD_OPTIONS_BY_SOURCE,
  FILTER_OPTIONS_BY_SOURCE,
  GROUP_BY_OPTIONS_BY_SOURCE,
  METRIC_OPTIONS,
  SORT_OPTIONS_BY_SOURCE,
  WIDGET_TYPE_OPTIONS,
} from "@/config/dashboardConfig";
import { HEIGHT_OPTIONS, WIDTH_OPTIONS } from "@/config/layoutOptions";
import {
  removeWidget,
  updateWidgetDataSource,
  updateWidgetFields,
  updateWidgetFilter,
  updateWidgetGroupBy,
  updateWidgetLayout,
  updateWidgetMetric,
  updateWidgetSort,
  updateWidgetTitle,
  updateWidgetType,
  updateWidgetVisibility,
} from "@/store/dashboardSlice";
import { useAppDispatch } from "@/store/hooks";
import { DataSourceKey, WidgetConfig, WidgetType } from "@/types/dashboard";

import styles from "./ConfigDrawer.module.css";

/**
 * Which extra fields are meaningful for each presentation, given what our
 * data layer actually supports: charts render a fixed monthly series (no
 * aggregation choice, and `sort` has no effect on series data), so those
 * controls are hidden rather than shown as dead/no-op inputs.
 */
const SHOWS_AGGREGATION: Record<WidgetType, boolean> = {
  kpi: true,
  barChart: false,
  lineChart: false,
  table: false,
  list: false,
};

const SHOWS_SORT: Record<WidgetType, boolean> = {
  kpi: false,
  barChart: false,
  lineChart: false,
  table: true,
  list: true,
};

/** Table/List: which columns to show and in what order. */
const SHOWS_FIELDS: Record<WidgetType, boolean> = {
  kpi: false,
  barChart: false,
  lineChart: false,
  table: true,
  list: true,
};

/** Bar/Line charts: bucket by a field instead of by calendar month. */
const SHOWS_GROUP_BY: Record<WidgetType, boolean> = {
  kpi: false,
  barChart: true,
  lineChart: true,
  table: false,
  list: false,
};

interface ConfigDrawerProps {
  widget: WidgetConfig;
  onClose: () => void;
}

/** The single place widget configuration is edited, opened once a canvas widget is selected. Which fields appear depends on the widget's presentation type. */
export default function ConfigDrawer({ widget, onClose }: ConfigDrawerProps) {
  const dispatch = useAppDispatch();
  const filterOptions = FILTER_OPTIONS_BY_SOURCE[widget.dataSource] ?? [];
  const sortOptions = SORT_OPTIONS_BY_SOURCE[widget.dataSource] ?? [];
  const fieldOptions = FIELD_OPTIONS_BY_SOURCE[widget.dataSource] ?? [];
  const groupByOptions = GROUP_BY_OPTIONS_BY_SOURCE[widget.dataSource] ?? [];
  // Unset (or empty) `fields` means "all columns" -- treat every option as checked in that case.
  const selectedFields = widget.fields && widget.fields.length > 0 ? widget.fields : fieldOptions.map((f) => f.key);

  const toggleField = (key: string, checked: boolean) => {
    const next = checked ? [...selectedFields, key] : selectedFields.filter((f) => f !== key);
    // Selecting every option is equivalent to "unset" (all columns); store it
    // that way so removing a column later still has a full list to work from.
    dispatch(updateWidgetFields({ id: widget.id, fields: next.length === fieldOptions.length ? [] : next }));
  };

  const handleRemove = () => {
    dispatch(removeWidget({ id: widget.id }));
    onClose();
  };

  return (
    <div className={styles.drawer} role="dialog" aria-label={`Configure ${widget.title}`}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Configure {widget.title}</span>
        <button type="button" className={styles.closeButton} aria-label="Close configuration panel" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="cfg-title">
            Widget Title
          </label>
          <input
            id="cfg-title"
            className={styles.input}
            value={widget.title}
            onChange={(e) => dispatch(updateWidgetTitle({ id: widget.id, title: e.target.value }))}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="cfg-source">
            Data Source
          </label>
          <select
            id="cfg-source"
            className={styles.select}
            value={widget.dataSource}
            onChange={(e) =>
              dispatch(updateWidgetDataSource({ id: widget.id, dataSource: e.target.value as DataSourceKey }))
            }
          >
            {DATA_SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="cfg-presentation">
            Presentation
          </label>
          <select
            id="cfg-presentation"
            className={styles.select}
            value={widget.widgetType}
            onChange={(e) => dispatch(updateWidgetType({ id: widget.id, widgetType: e.target.value as WidgetType }))}
          >
            {WIDGET_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {SHOWS_AGGREGATION[widget.widgetType] && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cfg-metric">
              Aggregation
            </label>
            <select
              id="cfg-metric"
              className={styles.select}
              value={widget.metric ?? "count"}
              onChange={(e) =>
                dispatch(updateWidgetMetric({ id: widget.id, metric: e.target.value as WidgetConfig["metric"] }))
              }
            >
              {METRIC_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="cfg-filter">
            Filter
          </label>
          <select
            id="cfg-filter"
            className={styles.select}
            value={widget.filter?.value ?? ""}
            onChange={(e) => {
              const opt = filterOptions.find((f) => f.value === e.target.value);
              dispatch(
                updateWidgetFilter({ id: widget.id, filter: opt ? { value: opt.value, label: opt.label } : undefined }),
              );
            }}
          >
            <option value="">None</option>
            {filterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {SHOWS_SORT[widget.widgetType] && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cfg-sort">
              Sorting
            </label>
            <select
              id="cfg-sort"
              className={styles.select}
              value={widget.sort?.value ?? ""}
              onChange={(e) => {
                const opt = sortOptions.find((s) => s.value === e.target.value);
                dispatch(updateWidgetSort({ id: widget.id, sort: opt }));
              }}
            >
              <option value="">None</option>
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {SHOWS_GROUP_BY[widget.widgetType] && groupByOptions.length > 0 && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cfg-groupby">
              Group By
            </label>
            <select
              id="cfg-groupby"
              className={styles.select}
              value={widget.groupBy ?? ""}
              onChange={(e) =>
                dispatch(updateWidgetGroupBy({ id: widget.id, groupBy: e.target.value || undefined }))
              }
            >
              <option value="">Month (default)</option>
              {groupByOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {SHOWS_FIELDS[widget.widgetType] && fieldOptions.length > 0 && (
          <div className={styles.field}>
            <span className={styles.label}>Fields</span>
            <div className={styles.fieldsList}>
              {fieldOptions.map((opt) => (
                <label key={opt.key} className={styles.fieldCheckboxRow}>
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(opt.key)}
                    onChange={(e) => toggleField(opt.key, e.target.checked)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className={styles.sectionDivider} />

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cfg-width">
              Width
            </label>
            <select
              id="cfg-width"
              className={styles.select}
              value={widget.layout.width}
              onChange={(e) =>
                dispatch(
                  updateWidgetLayout({ id: widget.id, layout: { ...widget.layout, width: Number(e.target.value) } }),
                )
              }
            >
              {WIDTH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cfg-height">
              Height
            </label>
            <select
              id="cfg-height"
              className={styles.select}
              value={widget.layout.height}
              onChange={(e) =>
                dispatch(
                  updateWidgetLayout({ id: widget.id, layout: { ...widget.layout, height: Number(e.target.value) } }),
                )
              }
            >
              {HEIGHT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className={styles.visibleRow}>
          <input
            type="checkbox"
            checked={widget.visible}
            onChange={(e) => dispatch(updateWidgetVisibility({ id: widget.id, visible: e.target.checked }))}
          />
          Visible on dashboard
        </label>

        <div className={styles.sectionDivider} />

        <button type="button" className={styles.removeButton} onClick={handleRemove}>
          Remove Widget
        </button>
      </div>
    </div>
  );
}
