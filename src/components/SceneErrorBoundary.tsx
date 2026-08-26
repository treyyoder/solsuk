import { Component, type ReactNode } from 'react'

interface Props {
  fallback: (error: string) => ReactNode
  children: ReactNode
}

/** Catches renderer/scene crashes (context creation failure, shader compile
 * errors under hardened browsers) so the viewport shows a diagnostic instead
 * of a silent black pane. */
export class SceneErrorBoundary extends Component<Props, { error: string | null }> {
  state = { error: null as string | null }

  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }

  render() {
    if (this.state.error !== null) return this.props.fallback(this.state.error)
    return this.props.children
  }
}
