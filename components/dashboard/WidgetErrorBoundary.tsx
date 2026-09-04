import { Component, ReactNode } from "react";

import styles from "./WidgetShell.module.css";

interface WidgetErrorBoundaryProps {
  /** Identifies what's currently being rendered (e.g. widget id + config revision). When this changes after a crash, the boundary resets and gives the new render a fresh chance, instead of a code/data fix being masked by a permanently-tripped boundary. */
  resetKey: string;
  children: ReactNode;
}

interface WidgetErrorBoundaryState {
  error: Error | null;
}

/**
 * A widget's own render (or a chart library it calls into) throwing is a
 * single-widget failure, not a whole-dashboard one -- without this boundary,
 * React unmounts the entire tree above the nearest boundary, which today is
 * nothing narrower than the whole page. This scopes that blast radius to the
 * one widget, visually matching WidgetShell's existing error state so it
 * reads as "this widget errored," not as broken card chrome.
 */
export default class WidgetErrorBoundary extends Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
  state: WidgetErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prevProps: WidgetErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className={styles.stateBox} role="alert">
          <span className={styles.errorIcon}>⚠️</span>
          <span>This widget crashed while rendering and can&apos;t be shown.</span>
        </div>
      );
    }

    return this.props.children;
  }
}
