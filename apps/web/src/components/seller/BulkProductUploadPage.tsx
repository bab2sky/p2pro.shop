import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  Clock,
  XCircle,
} from 'lucide-react';
import { bulkUpload, getBulkUploadLogs, downloadTemplate } from '@/lib/api/bulk';

const UPLOAD_TYPES = [
  { value: 'price', label: '가격 일괄 변경' },
  { value: 'status', label: '상태 일괄 변경' },
  { value: 'create', label: '상품 대량 등록' },
  { value: 'update', label: '상품 대량 수정' },
];

export default function BulkProductUploadPage() {
  const [uploadType, setUploadType] = useState('price');
  const [file, setFile] = useState<File | null>(null);

  const { data: logsData, refetch } = useQuery({
    queryKey: ['bulk-logs'],
    queryFn: () => getBulkUploadLogs(),
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('No file selected');
      return bulkUpload(file, uploadType);
    },
    onSuccess: () => {
      setFile(null);
      refetch();
    },
  });

  const handleDownloadTemplate = async () => {
    const blob = await downloadTemplate(uploadType);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${uploadType}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const result = uploadMutation.data?.data;
  const logs = logsData?.data ?? [];

  return (
    <div className="max-w-6xl space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">대량 상품 관리</h1>

      {/* Upload section */}
      <div className="rounded-2xl border border-gray-300 bg-white p-6 dark:border-gray-600 dark:bg-gray-900">
        <div className="mb-5 flex items-center gap-2">
          <Upload className="h-4 w-4 text-gray-400" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">파일 업로드</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value)}
            className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100"
          >
            {UPLOAD_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 rounded-full bg-gray-100 px-4 py-2.5 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <Download className="h-3.5 w-3.5" />
            템플릿 다운로드
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-gray-50 px-4 py-3 text-sm transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700">
            <FileSpreadsheet className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-300">
              {file ? file.name : 'Excel 파일 선택 (.xlsx, .xls)'}
            </span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>
          <button
            onClick={() => uploadMutation.mutate()}
            disabled={!file || uploadMutation.isPending}
            className="rounded-full bg-gray-900 px-6 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            {uploadMutation.isPending ? '처리 중...' : '업로드'}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className={`mt-4 flex items-start gap-3 rounded-2xl p-4 ${result.error_count > 0 ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-emerald-50 dark:bg-emerald-500/10'}`}>
            {result.error_count > 0 ? (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            ) : (
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            )}
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                처리 완료: <span className="text-emerald-500">성공 {result.success_count}건</span> / <span className="text-red-500">실패 {result.error_count}건</span> (총 {result.total_rows}건)
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-2 space-y-1 text-[12px] text-red-500">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <li key={i}>행 {err.row}: [{err.field}] {err.message}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {uploadMutation.isError && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-red-50 p-4 dark:bg-red-500/10">
            <XCircle className="h-4 w-4 text-red-500" />
            <p className="text-sm text-red-500">{(uploadMutation.error as Error).message}</p>
          </div>
        )}
      </div>

      {/* Upload history */}
      <div className="overflow-hidden rounded-2xl border border-gray-300 dark:border-gray-600">
        <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-5 py-3.5 dark:border-gray-700 dark:bg-gray-800/50">
          <Clock className="h-4 w-4 text-gray-400" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">업로드 이력</h2>
        </div>
        {logs.length === 0 ? (
          <div className="flex flex-col items-center py-12">
            <FileSpreadsheet className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-400 dark:text-gray-500">업로드 이력이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-5 py-2.5 text-left text-[13px] font-medium text-gray-500 dark:text-gray-400">유형</th>
                  <th className="px-5 py-2.5 text-left text-[13px] font-medium text-gray-500 dark:text-gray-400">파일명</th>
                  <th className="px-5 py-2.5 text-right text-[13px] font-medium text-gray-500 dark:text-gray-400">총 행</th>
                  <th className="px-5 py-2.5 text-right text-[13px] font-medium text-gray-500 dark:text-gray-400">성공</th>
                  <th className="px-5 py-2.5 text-right text-[13px] font-medium text-gray-500 dark:text-gray-400">실패</th>
                  <th className="px-5 py-2.5 text-center text-[13px] font-medium text-gray-500 dark:text-gray-400">상태</th>
                  <th className="px-5 py-2.5 text-left text-[13px] font-medium text-gray-500 dark:text-gray-400">일시</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {logs.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 text-sm font-medium text-gray-900 dark:text-white">{log.upload_type}</td>
                    <td className="max-w-[200px] truncate px-5 py-3 text-sm text-gray-600 dark:text-gray-400">{log.file_name}</td>
                    <td className="px-5 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">{log.total_rows}</td>
                    <td className="px-5 py-3 text-right text-sm font-bold text-emerald-500">{log.success_count}</td>
                    <td className="px-5 py-3 text-right text-sm font-bold text-red-500">{log.error_count}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        log.status === 'completed' ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' :
                        log.status === 'failed' ? 'bg-red-50 text-red-500 dark:bg-red-500/10' :
                        'bg-amber-50 text-amber-500 dark:bg-amber-500/10'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[12px] text-gray-400">{new Date(log.created_at).toLocaleDateString('ko-KR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
