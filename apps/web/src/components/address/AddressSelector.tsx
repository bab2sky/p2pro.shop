import type { Address } from '@/lib/api/addresses';

interface AddressSelectorProps {
  addresses: Address[];
  selectedId: string | null;
  onSelect: (address: Address) => void;
}

export function AddressSelector({ addresses, selectedId, onSelect }: AddressSelectorProps) {
  if (addresses.length === 0) return null;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium mb-1">배송지 선택</label>
      {addresses.map((addr) => (
        <button
          key={addr.id}
          type="button"
          onClick={() => onSelect(addr)}
          className={`w-full text-left border rounded-2xl p-3 text-sm transition ${
            selectedId === addr.id ? 'border-gray-900 dark:border-white bg-gray-50 dark:bg-gray-800' : 'border-gray-200 hover:border-gray-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">{addr.label || '배송지'}</span>
            {addr.is_default && (
              <span className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 px-1.5 py-0.5 rounded-full">기본</span>
            )}
          </div>
          <p className="text-gray-600 mt-1">{addr.recipient_name} / {addr.recipient_phone}</p>
          <p className="text-gray-500">[{addr.zipcode}] {addr.address1} {addr.address2}</p>
        </button>
      ))}
    </div>
  );
}
