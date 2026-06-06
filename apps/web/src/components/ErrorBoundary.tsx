import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
          <h1 className="text-8xl font-bold text-gray-200">500</h1>
          <p className="mt-4 text-lg text-gray-600">
            문제가 발생했습니다. 다시 시도해주세요.
          </p>
          {import.meta.env.DEV && this.state.error?.message && (
            <p className="mt-2 text-sm text-gray-400">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = '/';
            }}
            className="mt-6 rounded-full bg-gray-900 dark:bg-white px-6 py-2.5 text-sm font-medium text-white dark:text-gray-900 transition hover:bg-gray-800 dark:hover:bg-gray-100"
          >
            홈으로 돌아가기
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
