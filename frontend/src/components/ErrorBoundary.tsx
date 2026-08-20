// frontend/src/components/ErrorBoundary.tsx
// React error boundary — catches render errors and shows a fallback UI

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("❌ React render error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "16px",
          background: "#0a0a0f",
          color: "#fff",
          padding: "24px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "48px" }}>⚠️</div>
          <h2 style={{ fontSize: "20px", fontWeight: 600 }}>Kuch galat ho gaya</h2>
          <p style={{ color: "#888", fontSize: "14px", maxWidth: "360px" }}>
            {this.state.error?.message || "Unexpected error"}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: "10px 24px",
              background: "#6c63ff",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
