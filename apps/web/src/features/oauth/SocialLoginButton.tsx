interface SocialLoginButtonProps {
  provider: 'google' | 'kakao';
  redirectTo?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function SocialLoginButton({ provider, redirectTo }: SocialLoginButtonProps) {
  const handleClick = () => {
    const state = generateState();
    sessionStorage.setItem('oauth_state', state);

    const params = new URLSearchParams({ state });
    if (redirectTo) params.set('redirect_to', redirectTo);
    window.location.href = `${API_BASE}/api/auth/oauth/${provider}?${params.toString()}`;
  };

  if (provider === 'google') {
    return (
      <button
        onClick={handleClick}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors text-gray-700 font-medium"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors text-gray-900"
      style={{ backgroundColor: '#FEE500' }}
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#000000" d="M12 3c-5.013 0-9.077 3.167-9.077 7.074 0 2.527 1.697 4.748 4.247 5.993l-1.08 3.951c-.095.35.302.624.607.418l4.667-3.09c.206.014.415.021.636.021 5.013 0 9.077-3.167 9.077-7.074S17.013 3 12 3z"/>
      </svg>
      카카오 로그인
    </button>
  );
}

export default SocialLoginButton;
