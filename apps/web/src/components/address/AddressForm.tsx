import type { Address } from '@/lib/api/addresses';

interface AddressFormProps {
  initial?: Address;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  loading: boolean;
}

export function AddressForm({ initial, onSubmit, onCancel, loading }: AddressFormProps) {
  return (
    <form onSubmit={onSubmit} className="border border-gray-300 dark:border-gray-600 rounded-2xl p-4 mb-4 space-y-3 bg-gray-50 dark:bg-gray-800">
      <div className="grid grid-cols-2 gap-3">
        <input name="label" defaultValue={initial?.label ?? ''} placeholder="라벨 (예: 집, 회사)" className="border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-700 dark:text-gray-100" />
        <input name="recipient_name" defaultValue={initial?.recipient_name ?? ''} placeholder="주문자 *" required className="border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-700 dark:text-gray-100" />
      </div>
      <input name="recipient_phone" defaultValue={initial?.recipient_phone ?? ''} placeholder="연락처 *" required className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-700 dark:text-gray-100" />
      <div className="grid grid-cols-3 gap-3">
        <input name="zipcode" defaultValue={initial?.zipcode ?? ''} placeholder="우편번호 *" required className="border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-700 dark:text-gray-100" />
        <input name="address1" defaultValue={initial?.address1 ?? ''} placeholder="주소 *" required className="col-span-2 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-700 dark:text-gray-100" />
      </div>
      <input name="address2" defaultValue={initial?.address2 ?? ''} placeholder="상세주소" className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-700 dark:text-gray-100" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_default" defaultChecked={initial?.is_default ?? false} />
        기본 배송지로 설정
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full text-sm disabled:opacity-50 hover:bg-gray-800 dark:hover:bg-gray-100">
          {loading ? '저장 중...' : '저장'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-full text-sm dark:text-gray-300">
          취소
        </button>
      </div>
    </form>
  );
}
