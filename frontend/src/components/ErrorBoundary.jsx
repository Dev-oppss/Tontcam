import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("Erreur capturée :", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, fontFamily: "DM Sans, system-ui, sans-serif" }}>
          <h2 style={{ color: "#dc2626" }}>Une erreur est survenue</h2>
          <pre style={{ background: "#fef2f2", padding: 16, borderRadius: 8, fontSize: 13, overflowX: "auto" }}>
            {this.state.error?.message}
            {"\n"}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
