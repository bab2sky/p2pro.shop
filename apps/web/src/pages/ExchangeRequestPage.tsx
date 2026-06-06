import ExchangeRequestForm from '@/components/order/ExchangeRequestForm';
import { useParams, useSearchParams } from 'react-router-dom';

export default function ExchangeRequestPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const orderItemId = searchParams.get('item_id') ?? '';
  if (!id) return null;
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <ExchangeRequestForm orderId={id} orderItemId={orderItemId} />
    </div>
  );
}
