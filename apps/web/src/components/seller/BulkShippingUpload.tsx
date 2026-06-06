import { useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  Download,
  Truck,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { bulkRegisterShipping, type BulkShippingItem, type BulkShippingResult } from '@/lib/api/orders';

const CARRIER_MAP: Record<string, string> = {
  cj: 'CJ대한통운',
  hanjin: '한진택배',
  lotte: '롯데택배',
  logen: '로젠택배',
  post: '우체국택배',
  epost: 'EMS',
  kdexp: '경동택배',
};

function parseCsv(text: string): BulkShippingItem[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim());
    const carrierCode = cols[1] || '';
    return {
      order_id: cols[0] || '',
      carrier_code: carrierCode,
      carrier_name: CARRIER_MAP[carrierCode] || carrierCode,
      tracking_number: cols[2] || '',
    };
  }).filter((item) => item.order_id && item.tracking_number);
}

function downloadCsvTemplate() {
  const header = 'order_id,carrier,tracking_number';
  const example = '550e8400-e29b-41d4-a716-446655440000,CJ대한통운,1234567890';
  const content = `${header}\n${example}\n`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bulk_shipping_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function BulkShippingUpload() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<BulkShippingItem[]>([]);
  const [result, setResult] = useState<BulkShippingResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const mutation = useMutation({
    mutationFn: () => bulkRegisterShipping(items),
    onSuccess: (data) => {
      setResult(data);
      setItems([]);
      queryClient.invalidateQueries({ queryKey: ['sellerOrders'] });
    },
  });

  const processFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(reader.result as string);
      setItems(parsed);
      setResult(null);
    };
    reader.readAsText(file);
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) processFile(file);
  }, [processFile]);

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        className={`flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-6 py-8 transition-colors ${
          isDragOver
            ? 'border-gray-900 bg-gray-50 dark:border-white dark:bg-gray-800'
            : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'
        }`}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
        <Upload className="mb-2 h-8 w-8 text-gray-400" />
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          CSV 파일을 여기에 드래그하거나 클릭하여 선택
        </p>
        <p className="mt-1 text-[11px] text-gray-400">
          형식: order_id, carrier_code, tracking_number (첫 줄 헤더)
        </p>
        <p className="text-[11px] text-gray-400">
          택배사 코드: cj, hanjin, lotte, logen, post, epost, kdexp
        </p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={downloadCsvTemplate}
          className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <Download className="h-3 w-3" />
          CSV 템플릿 다운로드
        </button>
      </div>

      {items.length > 0 && (
        <>
          <div className="overflow-hidden rounded-2xl border border-gray-300 dark:border-gray-600">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                  <th className="px-4 py-3 text-left text-[12px] font-bold text-gray-500">주문번호</th>
                  <th className="px-4 py-3 text-left text-[12px] font-bold text-gray-500">택배사</th>
                  <th className="px-4 py-3 text-left text-[12px] font-bold text-gray-500">운송장번호</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((item, i) => (
                  <tr key={i} className="bg-white dark:bg-gray-900">
                    <td className="px-4 py-2.5 font-mono text-[12px] text-gray-500">{item.order_id}</td>
                    <td className="px-4 py-2.5 text-gray-900 dark:text-white">{item.carrier_name}</td>
                    <td className="px-4 py-2.5 text-gray-900 dark:text-white">{item.tracking_number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-gray-500">{items.length}건</span>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex items-center gap-1.5 rounded-full bg-gray-900 px-6 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              <Truck className="h-3.5 w-3.5" />
              {mutation.isPending ? '처리 중...' : '일괄 발송처리'}
            </button>
          </div>
        </>
      )}

      {result && (
        <div className="overflow-hidden rounded-2xl border border-gray-300 p-5 dark:border-gray-600">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 font-bold text-emerald-500">
              <CheckCircle className="h-4 w-4" />
              성공: {result.success}
            </span>
            <span className="flex items-center gap-1 font-bold text-red-500">
              <AlertCircle className="h-4 w-4" />
              실패: {result.failed}
            </span>
            <span className="text-gray-400">총: {result.total}</span>
          </div>
          {result.failed > 0 && (
            <div className="mt-3 space-y-1">
              {result.errors.map((err) => (
                <p key={err.order_id} className="text-[12px] text-red-500">
                  Row {err.row} ({err.order_id}): {err.reason}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
