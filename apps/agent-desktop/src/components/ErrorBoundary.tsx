import React, { Component, type ReactNode } from 'react';

interface ErrorBoundaryState {
  error: string | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen bg-black items-center justify-center p-8">
          <div className="max-w-md text-center">
            <h2 className="text-red-400 text-lg font-mono mb-2">渲染错误</h2>
            <pre className="text-gray-500 text-xs text-left overflow-auto max-h-40 mb-4 bg-[#2a2a2a] p-3 rounded-lg border border-[#383838]">{this.state.error}</pre>
            <button onClick={() => this.setState({ error: null })} className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-500">重试</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
