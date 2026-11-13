import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

class PortalErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state={error:null}; }
  static getDerivedStateFromError(error){ return {error}; }
  componentDidCatch(error, info){ console.error("RNSIT portal render error:", error, info); }
  render(){
    if(this.state.error) return <main className="startup-error-screen"><section className="startup-card"><div className="eyebrow">APPLICATION ERROR</div><h1>The dashboard could not render</h1><p>{this.state.error.message || String(this.state.error)}</p><p className="startup-help">Open the browser developer console for the full error details. Fix the reported dependency or component error, then reload.</p><button className="btn btn-primary" onClick={()=>location.reload()}>Reload portal</button></section></main>;
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(<PortalErrorBoundary><App /></PortalErrorBoundary>);
