import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import axios from 'axios';

const ALLOWED_REDIRECT_PATHS = [
  '/', '/my', '/cart', '/wishlist', '/products', '/checkout', '/notices', '/faq',
];

function isSafeRedirect(path: string): boolean {
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//')) return false;
  return ALLOWED_REDIRECT_PATHS.some(
    (allowed) => path === allowed || path.startsWith(allowed + '/'),
  );
}

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');
    const rawRedirect = searchParams.get('redirect_to') || '/';
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(searchParams.get('message') || 'OAuth authentication failed');
      return;
    }

    // CSRF state 검증
    const storedState = sessionStorage.getItem('oauth_state');
    sessionStorage.removeItem('oauth_state');
    if (!stateParam || stateParam !== storedState) {
      setError('보안 검증에 실패했습니다. 다시 로그인해 주세요.');
      return;
    }

    if (!code) {
      setError('No authorization code received');
      return;
    }

    // redirect_to 허용 경로 검증 (open redirect 방지)
    const redirectTo = isSafeRedirect(rawRedirect) ? rawRedirect : '/';

    axios
      .post('/api/auth/oauth/exchange', { code })
      .then(({ data }) => {
        const tokens = data.data;
        setAuth(tokens.access_token, tokens.refresh_token, tokens.user);
        navigate(redirectTo, { replace: true });
      })
      .catch(() => {
        setError('Failed to exchange authorization code. Please try again.');
      });
  }, [navigate, setAuth, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-6xl">!</div>
          <h1 className="text-xl font-bold text-red-600">로그인 실패</h1>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            로그인 페이지로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div role="status" aria-label="로딩 중">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto" />
        </div>
        <p className="text-gray-600">로그인 처리 중...</p>
      </div>
    </div>
  );
}

export default OAuthCallbackPage;
