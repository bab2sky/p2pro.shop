import { useParams } from 'react-router-dom';
import { Store } from 'lucide-react';
import { SellerPublicProfile } from '@/features/seller';

export default function SellerProfilePage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="flex flex-col items-center py-16">
        <Store className="mb-3 h-14 w-14 text-gray-300 dark:text-gray-600" />
        <p className="text-[13px] font-bold text-gray-400">판매자 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <SellerPublicProfile sellerId={id} />
    </div>
  );
}
