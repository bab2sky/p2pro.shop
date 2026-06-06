import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initSentry } from '@/features/monitoring/sentry';
import './index.css';
import './i18n';
import App from './App';

initSentry();

// Stale-tab 자동 회복: 배포 후 새 청크 hash 로 바뀌면 옛 index 가 import 하던
// 청크가 404 (또는 nginx 재기동 중 일시적 HTML 응답) 가 되어 ChunkLoadError /
// "Failed to fetch dynamically imported module" 가 발생한다. 업계 표준 패턴은
// 이때 한 번 hard reload 해서 새 index.html 을 받아오는 것.
//
// Vite 5+ 의 vite:preloadError 이벤트는 modulepreload 실패 시 발생.
// 그 외 lazy import 경로의 일반 에러는 window 'error' 로 잡고
// "dynamically imported module" 메시지로 식별.
//
// 무한 루프 방지: sessionStorage 마커로 한 세션당 한 번만 reload 시도.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.addEventListener('vite:preloadError', (e: any) => {
  if (sessionStorage.getItem('chunk-reload-attempted') === '1') {
    return; // 이미 한 번 시도. 더 reload 하지 않고 ErrorBoundary 가 보이게 둠.
  }
  sessionStorage.setItem('chunk-reload-attempted', '1');
  if (e?.preventDefault) e.preventDefault();
  window.location.reload();
});

window.addEventListener('error', (e) => {
  const msg = e?.message ?? '';
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed')
  ) {
    if (sessionStorage.getItem('chunk-reload-attempted') === '1') return;
    sessionStorage.setItem('chunk-reload-attempted', '1');
    window.location.reload();
  }
});

// 페이지가 안정적으로 로드 완료되면 마커 해제 (다음 배포 시 또 한 번 reload 가능).
window.addEventListener('load', () => {
  // 약간의 지연: 초기 lazy import 들이 끝난 뒤 해제.
  setTimeout(() => {
    sessionStorage.removeItem('chunk-reload-attempted');
  }, 5000);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
