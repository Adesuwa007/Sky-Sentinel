'use client';
import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode; fallback?: ReactNode };

export class ModelErrorBoundary extends Component<Props, { err: boolean }> {
  constructor(props: Props) {
    super(props);
    this.state = { err: false };
  }

  static getDerivedStateFromError() {
    return { err: true };
  }

  componentDidCatch(_e: Error, _i: ErrorInfo) {
    // Optional: log in dev only
  }

  render() {
    if (this.state.err) return this.props.fallback ?? null;
    return this.props.children;
  }
}
