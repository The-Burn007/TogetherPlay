"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("TogetherPlay UI Error caught by boundary:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-player-one-ember/15 border border-player-one-ember/30 flex items-center justify-center text-player-one-ember mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-semibold text-on-surface mb-2">
            {this.props.fallbackTitle || "Shared Space Disruption"}
          </h2>
          <p className="text-sm text-on-surface-variant max-w-md mb-6 leading-relaxed">
            {this.props.fallbackMessage ||
              "A momentary sync error occurred in this view. Your session and couple state are safe."}
          </p>
          <Button variant="amber" onClick={this.handleReset}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Reconnect Space
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
