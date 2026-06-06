import type { ProductOption } from '@/lib/api/products';

interface ProductOptionSelectorProps {
  options: ProductOption[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
}

export function ProductOptionSelector({ options, selectedId, onChange }: ProductOptionSelectorProps) {
  if (options.length === 0) return null;

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-2">옵션 선택</label>
      <select
        value={selectedId || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full border rounded-lg px-3 py-2"
      >
        <option value="">선택하세요</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id} disabled={opt.stock <= 0}>
            {opt.option_name}: {opt.option_value}
            {Number(opt.additional_price) > 0 && ` (+₮${opt.additional_price})`}
            {opt.stock <= 0 && ' (품절)'}
          </option>
        ))}
      </select>
    </div>
  );
}
