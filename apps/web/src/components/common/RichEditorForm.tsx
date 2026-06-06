import { lazy, Suspense } from 'react';

const RichTextEditor = lazy(() => import('@/components/common/RichTextEditor'));

export interface RichEditorField {
  /** Field key */
  name: string;
  /** Display label */
  label: string;
  /** 'text' input, 'editor' rich text, 'checkbox', 'select' */
  type: 'text' | 'editor' | 'checkbox' | 'select';
  /** Placeholder text (text/editor only) */
  placeholder?: string;
  /** Required field marker */
  required?: boolean;
  /** Options for select type */
  options?: { value: string; label: string }[];
}

interface RichEditorFormProps {
  /** Card header title */
  title: string;
  /** Field definitions */
  fields: RichEditorField[];
  /** Current form values (keyed by field name) */
  values: Record<string, string | boolean>;
  /** Called when any field value changes */
  onChange: (name: string, value: string | boolean) => void;
  /** Submit handler */
  onSubmit: () => void;
  /** Cancel handler */
  onCancel: () => void;
  /** Submit button label */
  submitLabel?: string;
  /** Whether the form is currently submitting */
  submitting?: boolean;
  /** Disable submit (in addition to built-in required check) */
  submitDisabled?: boolean;
}

export default function RichEditorForm({
  title,
  fields,
  values,
  onChange,
  onSubmit,
  onCancel,
  submitLabel = '등록',
  submitting = false,
  submitDisabled = false,
}: RichEditorFormProps) {
  const inputClass =
    'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200';

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
      </div>
      <div className="space-y-4 p-5">
        {fields.map((field) => {
          if (field.type === 'checkbox') {
            return (
              <label key={field.name} className="flex items-center gap-2 text-sm dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={!!values[field.name]}
                  onChange={(e) => onChange(field.name, e.target.checked)}
                  className="rounded"
                />
                {field.label}
              </label>
            );
          }

          return (
            <div key={field.name}>
              <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                {field.label}{field.required ? ' *' : ''}
              </label>
              {field.type === 'text' && (
                <input
                  type="text"
                  value={(values[field.name] ?? '') as string}
                  onChange={(e) => onChange(field.name, e.target.value)}
                  className={inputClass}
                  placeholder={field.placeholder}
                />
              )}
              {field.type === 'select' && (
                <select
                  value={(values[field.name] ?? '') as string}
                  onChange={(e) => onChange(field.name, e.target.value)}
                  className={inputClass}
                >
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
              {field.type === 'editor' && (
                <Suspense fallback={<div className="h-[260px] animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />}>
                  <RichTextEditor
                    value={(values[field.name] ?? '') as string}
                    onChange={(html) => onChange(field.name, html)}
                    placeholder={field.placeholder}
                  />
                </Suspense>
              )}
            </div>
          );
        })}

        {/* Inline checkboxes rendered above, group remaining actions */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || submitDisabled}
            className="rounded-full bg-gray-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            {submitting ? '저장 중...' : submitLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-gray-100 px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
