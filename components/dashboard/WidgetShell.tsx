import { ReactNode } from "react";

import styles from "./WidgetShell.module.css";

interface WidgetShellProps {
  title: string;
  meta?: string;
  state: "loading" | "error" | "empty" | "success";
  errorMessage?: string;
  onRetry?: () => void;
  children?: ReactNode;
}

export default function WidgetShell({ title, meta, state, errorMessage, onRetry, children }: WidgetShellProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        {meta && <span className={styles.meta}>{meta}</span>}
      </div>
      <div className={styles.body}>
        {state === "loading" && (
          <div className={styles.skeleton} role="status" aria-label="Loading widget">
            <div className={styles.skeletonBar} />
            <div className={styles.skeletonBar} />
            <div className={styles.skeletonBar} />
          </div>
        )}

        {state === "error" && (
          <div className={styles.stateBox} role="alert">
            <span className={styles.errorIcon}>⚠️</span>
            <span>{errorMessage ?? "Something went wrong loading this widget."}</span>
            {onRetry && (
              <button type="button" className={styles.retryButton} onClick={onRetry}>
                Retry
              </button>
            )}
          </div>
        )}

        {state === "empty" && <div className={styles.stateBox}>No data available.</div>}

        {state === "success" && children}
      </div>
    </div>
  );
}
