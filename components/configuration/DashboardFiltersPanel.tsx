"use client";

import { useState } from "react";

import { DATA_SOURCE_OPTIONS, FILTER_OPTIONS_BY_SOURCE } from "@/config/dashboardConfig";
import { addDashboardFilter, removeDashboardFilter, toggleDashboardFilterWidget } from "@/store/dashboardSlice";
import { useAppDispatch } from "@/store/hooks";
import { DashboardFilterConfig, DataSourceKey, WidgetConfig } from "@/types/dashboard";

import styles from "./DashboardFiltersPanel.module.css";

interface DashboardFiltersPanelProps {
  dashboardFilters: DashboardFilterConfig[];
  widgets: WidgetConfig[];
}

/**
 * Filters that apply across multiple widgets at once. Scope is explicit, not
 * implicit "every widget on this data source": each filter lists the
 * currently-placed widgets that share its data source, with a checkbox for
 * whether it's in scope, so a widget can be added to the canvas later
 * without silently inheriting a filter nobody opted it into.
 */
export default function DashboardFiltersPanel({ dashboardFilters, widgets }: DashboardFiltersPanelProps) {
  const dispatch = useAppDispatch();
  const [newDataSource, setNewDataSource] = useState<DataSourceKey>(DATA_SOURCE_OPTIONS[0].value);
  const [newFilterValue, setNewFilterValue] = useState("");

  const filterOptionsForNew = FILTER_OPTIONS_BY_SOURCE[newDataSource] ?? [];

  const handleAdd = () => {
    const opt = filterOptionsForNew.find((f) => f.value === newFilterValue);
    if (!opt) return;
    dispatch(
      addDashboardFilter({
        filter: {
          id: crypto.randomUUID(),
          dataSource: newDataSource,
          filter: { value: opt.value, label: opt.label },
          appliesToWidgetIds: [],
        },
      }),
    );
    setNewFilterValue("");
  };

  return (
    <div className={styles.panel}>
      <div className={styles.headerRow}>
        <span className={styles.sectionTitle}>Dashboard Filters</span>
        <span className={styles.hint}>Applies to specific widgets across the dashboard, overriding their own filter.</span>
      </div>

      {dashboardFilters.length > 0 && (
        <div className={styles.filterList}>
          {dashboardFilters.map((df) => {
            const candidates = widgets.filter((w) => w.dataSource === df.dataSource);
            return (
              <div key={df.id} className={styles.filterCard}>
                <div className={styles.filterHeader}>
                  <span className={styles.filterLabel}>
                    {DATA_SOURCE_OPTIONS.find((o) => o.value === df.dataSource)?.label ?? df.dataSource}: {df.filter.label}
                  </span>
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => dispatch(removeDashboardFilter({ id: df.id }))}
                    aria-label={`Remove ${df.filter.label} dashboard filter`}
                  >
                    ✕
                  </button>
                </div>
                {candidates.length === 0 ? (
                  <span className={styles.emptyScope}>No {df.dataSource} widgets on the canvas yet.</span>
                ) : (
                  <div className={styles.scopeList}>
                    {candidates.map((w) => (
                      <label key={w.id} className={styles.scopeRow}>
                        <input
                          type="checkbox"
                          checked={df.appliesToWidgetIds.includes(w.id)}
                          onChange={() => dispatch(toggleDashboardFilterWidget({ filterId: df.id, widgetId: w.id }))}
                        />
                        {w.title}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.addRow}>
        <select
          className={styles.select}
          aria-label="Dashboard filter data source"
          value={newDataSource}
          onChange={(e) => {
            setNewDataSource(e.target.value as DataSourceKey);
            setNewFilterValue("");
          }}
        >
          {DATA_SOURCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          aria-label="Dashboard filter value"
          value={newFilterValue}
          onChange={(e) => setNewFilterValue(e.target.value)}
        >
          <option value="">Select a filter...</option>
          {filterOptionsForNew.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button type="button" className={styles.addButton} onClick={handleAdd} disabled={!newFilterValue}>
          Add Filter
        </button>
      </div>
    </div>
  );
}
