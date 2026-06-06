import { Link, Navigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import { getMySellerProfile } from '@/lib/api/seller';

export function SellerGuard() {
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sellerProfile'],
    queryFn: getMySellerProfile,
    enabled: !!accessToken,
    retry: false,
  });

  if (!accessToken) return <Navigate to="/login" replace />;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-sm">판매자 정보 확인 중...</div>
        </div>
      </div>
    );
  }

  // No seller profile at all - redirect to apply page
  if (isError || !data?.data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">판매자 전용 페이지</h2>
          <p className="text-gray-500 mb-6">
            판매자 센터는 판매자 등록이 완료된 회원만 이용할 수 있습니다.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              to="/seller/apply"
              className="px-6 py-2.5 bg-gray-900 text-[13px] font-bold text-white rounded-full hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              판매자 신청하기
            </Link>
            <Link
              to="/"
              className="px-6 py-2.5 border border-gray-300 rounded-full text-[13px] font-bold hover:bg-gray-50 dark:border-gray-600"
            >
              홈으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Seller profile exists but not yet approved
  const sellerStatus = data.data.status;
  if (sellerStatus !== 'approved') {
    const statusMessages: Record<string, { title: string; desc: string }> = {
      pending: {
        title: '판매자 승인 대기 중',
        desc: '관리자 승인 후 판매자 센터를 이용하실 수 있습니다. 승인까지 1~2 영업일이 소요될 수 있습니다.',
      },
      rejected: {
        title: '판매자 신청이 거부되었습니다',
        desc: '신청이 반려되었습니다. 사유를 확인하시고 다시 신청해 주세요.',
      },
      suspended: {
        title: '판매자 활동이 정지되었습니다',
        desc: '판매자 활동이 정지되어 판매자 센터를 이용할 수 없습니다.',
      },
    };
    const msg = (sellerStatus ? statusMessages[sellerStatus] : undefined) || {
      title: '판매자 센터 이용 불가',
      desc: `현재 상태(${sellerStatus})에서는 판매자 센터를 이용할 수 없습니다.`,
    };

    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">{msg.title}</h2>
          <p className="text-gray-500 mb-6">{msg.desc}</p>
          <Link
            to="/"
            className="px-6 py-2.5 border border-gray-300 rounded-full text-[13px] font-bold hover:bg-gray-50 dark:border-gray-600"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
