import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { checkSurcharge } from '@/lib/api/analytics';

interface RegionalSurchargeInfoProps {
  onSurchargeChange?: (surcharge: number) => void;
}

export default function RegionalSurchargeInfo({ onSurchargeChange }: RegionalSurchargeInfoProps) {
  const [zipcode, setZipcode] = useState('');

  const mutation = useMutation({
    mutationFn: (zip: string) => checkSurcharge(zip),
    onSuccess: (res) => {
      onSurchargeChange?.(res.data.surcharge);
    },
  });

  const result = mutation.data?.data;

  return (
    <div className="text-sm space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="우편번호 입력"
          value={zipcode}
          onChange={(e) => setZipcode(e.target.value.replace(/\D/g, '').slice(0, 5))}
          className="border rounded px-2 py-1 w-28 text-sm"
          maxLength={5}
        />
        <button
          onClick={() => zipcode.length >= 3 && mutation.mutate(zipcode)}
          disabled={zipcode.length < 3 || mutation.isPending}
          className="px-3 py-1 text-sm bg-gray-100 border rounded hover:bg-gray-200 disabled:opacity-50"
        >
          확인
        </button>
      </div>

      {result && (
        <div className={`p-2 rounded text-sm ${result.has_surcharge ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}`}>
          {result.has_surcharge ? (
            <>
              <span className="font-medium">{result.region}</span> 지역 추가 배송비:{' '}
              <span className="font-bold">+{Number(result.surcharge).toLocaleString()}원</span>
            </>
          ) : (
            '추가 배송비 없음'
          )}
        </div>
      )}
    </div>
  );
}
