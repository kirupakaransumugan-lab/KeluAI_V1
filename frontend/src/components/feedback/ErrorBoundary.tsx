import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  /** Shown instead of the crashed subtree. */
  fallback: (reload: () => void) => ReactNode;
  children: ReactNode;
}

/** Without this, one render error unmounts the whole app and leaves a blank page. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("KELU page crashed:", error, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback(() => window.location.reload()) : this.props.children;
  }
}
