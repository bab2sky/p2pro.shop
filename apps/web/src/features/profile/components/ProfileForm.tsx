import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Copy, Users, Phone, Lock } from 'lucide-react';
import { getProfile, updateProfile } from '@/lib/api/profile';
import { uploadImage } from '@/lib/api/reviews';
import { extractApiError } from '@/lib/api-error';
import { useAuthStore } from '@/features/auth/store';

export function ProfileForm() {
  const queryClient = useQueryClient();
  const authUser = useAuthStore((s) => s.user);
  const [nickname, setNickname] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => getProfile().then((r) => r.data),
  });

  useEffect(() => {
    if (profileData) {
      setNickname(profileData.nickname || '');
      setProfileImage(profileData.profile_image);
    }
  }, [profileData]);

  const mutation = useMutation({
    mutationFn: () =>
      updateProfile({
        nickname: nickname.trim(),
        profile_image: profileImage || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadImage(file, 'profiles');
      setProfileImage(result.data.url);
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-4" role="status" aria-label="로딩 중"><div className="h-20 rounded-xl bg-gray-100 dark:bg-gray-800" /></div>;
  }

  return (
    <div>
      <h2 className="mb-5 text-[15px] font-bold text-gray-900 dark:text-white">프로필 수정</h2>

      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            {profileImage ? (
              <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-gray-400 dark:text-gray-500">
                {nickname?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          <label className="cursor-pointer rounded-full bg-gray-100 px-4 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageUpload}
              className="hidden"
            />
            {uploading ? '업로드 중...' : '이미지 변경'}
          </label>
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">닉네임</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={30}
            className="w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">이메일</label>
          <input
            type="email"
            value={profileData?.email || ''}
            disabled
            className="w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm text-gray-400 dark:bg-gray-800 dark:text-gray-500"
          />
          <p className="mt-1.5 text-[12px] text-gray-400 dark:text-gray-500">이메일은 변경할 수 없습니다</p>
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">휴대폰 번호</label>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-100 px-4 py-2.5 dark:bg-gray-800">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Phone className="h-4 w-4" />
              <span className="font-medium">
                {authUser?.phone ? '등록된 번호 (보안상 비공개)' : '미등록'}
              </span>
              <Lock className="h-3.5 w-3.5 text-gray-400" />
            </div>
            <button
              type="button"
              onClick={() => setShowPhoneModal(true)}
              className="shrink-0 rounded-full bg-gray-900 px-3.5 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              변경 신청 안내
            </button>
          </div>
          <p className="mt-1.5 text-[12px] text-gray-400 dark:text-gray-500">
            가입 시 등록한 휴대폰 번호는 직접 변경할 수 없습니다.
          </p>
        </div>

        {mutation.isError && (
          <p className="text-[13px] text-red-500">{extractApiError(mutation.error)}</p>
        )}

        {mutation.isSuccess && (
          <p className="text-[13px] text-emerald-500">프로필이 수정되었습니다</p>
        )}

        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !nickname.trim()}
          className="rounded-full bg-gray-900 px-6 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
        >
          {mutation.isPending ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* Referral Section */}
      {profileData && (
        <div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-700">
          <h2 className="mb-5 text-[15px] font-bold text-gray-900 dark:text-white">내 추천 링크</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">추천 링크</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/register?ref=${profileData.referral_code}`}
                  className="w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm text-gray-600 outline-none dark:bg-gray-800 dark:text-gray-300"
                />
                <button
                  onClick={async () => {
                    const link = `${window.location.origin}/register?ref=${profileData.referral_code}`;
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                    toast.success('링크가 복사되었습니다!');
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all ${
                    copied
                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                      : 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100'
                  }`}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? '복사됨' : '복사'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-gray-100 px-4 py-3 dark:bg-gray-800">
              <Users className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                추천한 회원 수: <strong className="text-gray-900 dark:text-white">{profileData.referral_count}명</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 휴대폰 변경 안내 모달 */}
      {showPhoneModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => e.target === e.currentTarget && setShowPhoneModal(false)}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-gray-900" role="dialog" aria-modal="true">
            <div className="mb-4 flex items-center gap-2">
              <Lock className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <h3 className="text-[16px] font-bold text-gray-900 dark:text-white">
                휴대폰 번호 변경 안내
              </h3>
            </div>
            <div className="space-y-3 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
              <p>
                가입 시 등록한 휴대폰 번호는 본인 인증 정보에 해당하므로
                <strong className="text-gray-900 dark:text-white"> 회원이 직접 변경할 수 없습니다.</strong>
              </p>
              <p>
                휴대폰 번호 변경이 필요하신 경우, <strong className="text-gray-900 dark:text-white">관리자 / 고객센터로 문의</strong>해주시기 바랍니다.
                본인 확인 절차를 거친 후 변경 처리됩니다.
              </p>
              <div className="rounded-xl bg-gray-50 p-3 text-[12px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                · 도용·분실 등 보안 사유로 즉시 변경이 필요한 경우, 관리자에게 별도 안내드립니다.<br />
                · 관리자 변경 처리 시 SMS로 결과가 안내됩니다.
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPhoneModal(false)}
                className="rounded-full bg-gray-900 px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
