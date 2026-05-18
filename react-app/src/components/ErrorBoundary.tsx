import React from "react";

interface State { error: Error | null; }

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "60vh", gap: 16, padding: 24,
        }}>
          <div style={{ fontSize: "2rem" }}>⚠️</div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>Something went wrong</div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", textAlign: "center", maxWidth: 360 }}>
            {this.state.error.message}
          </div>
          <button
            style={{
              marginTop: 8, padding: "10px 24px", borderRadius: 10,
              background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
              color: "#fff", cursor: "pointer", fontWeight: 600,
            }}
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
