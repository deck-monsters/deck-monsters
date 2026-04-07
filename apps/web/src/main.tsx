import { StrictMode, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

import { trpc, createTRPCClient } from './lib/trpc.js';
import { AuthProvider } from './lib/auth-context.js';
import { CommandInsertProvider } from './lib/command-insert-context.js';
import App from './App.js';

import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/press-start-2p/400.css';
import './styles/theme-phosphor.css';
import './styles/theme-amber.css';
import './styles/theme-street-fighter.css';
import './styles/base.css';
import './styles/terminal.css';
import './styles/effects.css';

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            background: 'var(--color-bg, #0d1117)',
            color: 'var(--color-fg, #c9d1d9)',
            fontFamily: 'var(--font-family, monospace)',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '1.1rem' }}>Something went wrong.</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-fg-dim, #6e7681)' }}>
            {this.state.error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.4rem 1rem',
              background: 'transparent',
              border: '1px solid var(--color-accent, #58a6ff)',
              color: 'var(--color-accent, #58a6ff)',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1 },
  },
});
const trpcClient = createTRPCClient();

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <CommandInsertProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </CommandInsertProvider>
          </AuthProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  </StrictMode>
);
