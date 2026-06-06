import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  type Address,
  type AddressPayload,
} from '@/lib/api/addresses';
import { AddressForm } from '@/components/address/AddressForm';
import { confirmAction } from '@/lib/confirm';

export default function AddressListPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: addresses, isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: getAddresses,
  });

  const createMut = useMutation({
    mutationFn: createAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      setShowForm(false);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AddressPayload> }) => updateAddress(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      setEditing(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteAddress,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>, id?: string) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: AddressPayload = {
      label: (fd.get('label') as string) || undefined,
      recipient_name: fd.get('recipient_name') as string,
      recipient_phone: fd.get('recipient_phone') as string,
      zipcode: fd.get('zipcode') as string,
      address1: fd.get('address1') as string,
      address2: (fd.get('address2') as string) || undefined,
      is_default: fd.get('is_default') === 'on',
    };
    if (id) {
      updateMut.mutate({ id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  if (isLoading)
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 96 }} />
        ))}
      </div>
    );

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">배송지 관리</h1>
        {(addresses?.length ?? 0) < 5 && (
          <button
            onClick={() => { setShowForm(!showForm); setEditing(null); }}
            className="flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            <Plus className="h-4 w-4" />
            새 배송지
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <AddressForm
            onSubmit={(e) => handleSubmit(e)}
            onCancel={() => setShowForm(false)}
            loading={createMut.isPending}
          />
        </div>
      )}

      {addresses?.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-16">
          <MapPin className="mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-medium text-gray-400 dark:text-gray-500">등록된 배송지가 없습니다.</p>
        </div>
      )}

      <div className="space-y-2.5">
        {addresses?.map((addr: Address) => (
          <div
            key={addr.id}
            className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
          >
            {editing === addr.id ? (
              <AddressForm
                initial={addr}
                onSubmit={(e) => handleSubmit(e, addr.id)}
                onCancel={() => setEditing(null)}
                loading={updateMut.isPending}
              />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  {addr.label && (
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{addr.label}</span>
                  )}
                  {addr.is_default && (
                    <span className="rounded-full bg-pink-50 px-2.5 py-0.5 text-[11px] font-bold text-pink-500 dark:bg-pink-500/10">
                      기본
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-gray-700 dark:text-gray-300">
                  {addr.recipient_name} · {addr.recipient_phone}
                </p>
                <p className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">
                  [{addr.zipcode}] {addr.address1} {addr.address2}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => { setEditing(addr.id); setShowForm(false); }}
                    className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                  >
                    <Pencil className="h-3 w-3" />
                    수정
                  </button>
                  <button
                    onClick={async () => { if (await confirmAction('삭제하시겠습니까?')) deleteMut.mutate(addr.id); }}
                    className="flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-500 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20"
                  >
                    <Trash2 className="h-3 w-3" />
                    삭제
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
