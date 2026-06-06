import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

export function DesktopOnlyGuard({ children }: Props) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const check = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setIsMobile(window.innerWidth < 768), 150);
    };
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('resize', check);
      clearTimeout(timerRef.current);
    };
  }, []);

  if (!isMobile) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl dark:bg-gray-900">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
          <Monitor className="h-8 w-8 text-gray-500 dark:text-gray-400" />
        </div>
        <h2 className="text-[18px] font-extrabold text-gray-900 dark:text-white">
          PC 전용 페이지
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-gray-500 dark:text-gray-400">
          이 페이지는 PC(데스크탑)에서만<br />접근할 수 있습니다.
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 w-full rounded-2xl bg-gray-900 py-3 text-[15px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
        >
          돌아가기
        </button>
      </div>
    </div>
  );
}
