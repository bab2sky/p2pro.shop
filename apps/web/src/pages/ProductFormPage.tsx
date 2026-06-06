import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Package,
  ArrowLeft,
  Upload,
  Plus,
  X,
  ImagePlus,
  AlertCircle,
} from 'lucide-react';
import {
  getProduct,
  createProduct,
  updateProduct,
  uploadProductImages,
  type CreateProductPayload,
} from '@/lib/api/products';
import { uploadImage } from '@/lib/api/reviews';
import { extractApiError } from '@/lib/api-error';
import { getCategories, type CategoryTree } from '@/lib/api/categories';

const RichTextEditor = lazy(() => import('@/components/common/RichTextEditor'));

const inputClass = 'w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100';

// 옵션 입력 전용: 부모 flex 너비를 따르도록 w-full 제거
const optionInputClass = 'min-w-0 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-gray-900/10 dark:bg-gray-800 dark:text-gray-100';

export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const { data: product } = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(id!),
    enabled: isEdit,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const [files, setFiles] = useState<File[]>([]);
  const [description, setDescription] = useState('');
  const [returnPolicy, setReturnPolicy] = useState('');

  // 옵션을 일반 쇼핑몰 패턴으로 그룹화 (예: 색상 → [빨강, 파랑])
  type OptionValue = { value: string; additional_price: string; stock: number };
  type OptionGroup = { name: string; values: OptionValue[] };
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(product?.category?.id ?? '');
  const [basePrice, setBasePrice] = useState<string>(product?.base_price ?? '');
  const [marginRate, setMarginRate] = useState<string>(product?.margin_rate ?? '10');
  const [title, setTitle] = useState<string>('');
  const [shippingFee, setShippingFee] = useState<string>('0');
  const [stock, setStock] = useState<number>(100);

  useEffect(() => {
    if (product) {
      setDescription(product.description ?? '');
      setReturnPolicy(product.return_policy ?? '');
      setSelectedCategoryId(product.category?.id ?? '');
      setBasePrice(product.base_price ?? '');
      setMarginRate(product.margin_rate ?? '10');
      setTitle(product.title ?? '');
      setShippingFee(product.shipping_fee ?? '0');
      setStock(product.stock ?? 100);
      if (product.options && product.options.length > 0) {
        // 백엔드 flat 구조 → 그룹 구조로 변환 (option_name 기준 묶음)
        const grouped: Record<string, OptionGroup> = {};
        product.options.forEach((o) => {
          if (!grouped[o.option_name]) grouped[o.option_name] = { name: o.option_name, values: [] };
          grouped[o.option_name].values.push({
            value: o.option_value,
            additional_price: o.additional_price,
            stock: o.stock,
          });
        });
        setOptionGroups(Object.values(grouped));
      }
    }
  }, [product]);

  // Find commission rate for selected category.
  // Round 8b: backend BigDecimal serializes as string → parseFloat() at the boundary.
  const findCommissionRate = (cats: CategoryTree[], id: string): number | null => {
    for (const c of cats) {
      if (c.id === id) return parseFloat(c.commission_rate);
      const found = findCommissionRate(c.children, id);
      if (found !== null) return found;
    }
    return null;
  };

  const commissionRate = selectedCategoryId && categories
    ? findCommissionRate(categories, selectedCategoryId) ?? 5
    : null;

  // v1.2.0: 판매가는 base × (1 + margin/100). 거래수수료는 가격에 얹지 않고 정산 시 차감.
  const calculatedFinalPrice = (() => {
    const bp = parseFloat(basePrice);
    const mr = parseFloat(marginRate);
    if (!bp || isNaN(bp) || isNaN(mr)) return null;
    return bp * (1 + mr / 100);
  })();
  // 셀러가 실제로 받게 될 금액 = 판매가 - 판매가 × 수수료율
  const sellerPayoutPreview = (() => {
    if (calculatedFinalPrice === null || commissionRate === null) return null;
    return calculatedFinalPrice * (1 - commissionRate / 100);
  })();
  const commissionPreview = (() => {
    if (calculatedFinalPrice === null || commissionRate === null) return null;
    return calculatedFinalPrice * (commissionRate / 100);
  })();

  const handleEditorImageUpload = async (file: File): Promise<string> => {
    try {
      const result = await uploadImage(file, 'products');
      return result.data.url;
    } catch (err) {
      toast.error(extractApiError(err));
      throw err;
    }
  };

  const createMut = useMutation({
    mutationFn: async (payload: CreateProductPayload) => {
      const result = await createProduct(payload);
      if (files.length > 0) {
        await uploadProductImages(result.id, files);
      }
      return result;
    },
    onSuccess: () => {
      // 새 상품이 셀러 목록에 즉시 반영되도록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['sellerProducts'] });
      navigate('/seller/products');
    },
  });

  const updateMut = useMutation({
    mutationFn: async (payload: Partial<CreateProductPayload>) => {
      await updateProduct(id!, payload);
      if (files.length > 0) {
        await uploadProductImages(id!, files);
      }
    },
    onSuccess: () => {
      // 수정 후 (a) 셀러 목록의 가격/재고 즉시 갱신, (b) 다시 수정 페이지에 들어왔을 때
      // 이전 캐시된 product 가 노출되지 않도록 양쪽 모두 무효화.
      queryClient.invalidateQueries({ queryKey: ['sellerProducts'] });
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      navigate('/seller/products');
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    // 그룹 → flat 옵션으로 변환
    const flatOptions: { option_name: string; option_value: string; additional_price: string; stock: number }[] = [];
    for (let gi = 0; gi < optionGroups.length; gi++) {
      const g = optionGroups[gi];
      const name = g.name.trim();
      const meaningfulValues = g.values.filter((v) => v.value.trim() !== '');
      // 그룹명이 비어있는데 값이 있으면 에러
      if (!name && meaningfulValues.length > 0) {
        toast.error(`${gi + 1}번째 옵션 그룹명을 입력해주세요.`);
        return;
      }
      // 그룹명만 있고 값이 없으면 자동 무시
      if (!name) continue;
      if (meaningfulValues.length === 0) {
        toast.error(`옵션 그룹 "${name}"에 값을 1개 이상 추가해주세요.`);
        return;
      }
      for (let vi = 0; vi < meaningfulValues.length; vi++) {
        const v = meaningfulValues[vi];
        const price = v.additional_price.trim() === '' ? '0' : v.additional_price.trim();
        if (isNaN(Number(price))) {
          toast.error(`옵션 "${name} - ${v.value}"의 추가 가격이 숫자가 아닙니다.`);
          return;
        }
        flatOptions.push({
          option_name: name,
          option_value: v.value.trim(),
          additional_price: price,
          stock: Number.isFinite(v.stock) && v.stock >= 0 ? v.stock : 0,
        });
      }
    }

    // (option_name, option_value) 중복 검출
    const seen = new Set<string>();
    for (const o of flatOptions) {
      const k = `${o.option_name}|${o.option_value}`;
      if (seen.has(k)) {
        toast.error(`옵션이 중복됩니다 (${o.option_name}: ${o.option_value}).`);
        return;
      }
      seen.add(k);
    }

    const payload: CreateProductPayload = {
      category_id: fd.get('category_id') as string,
      title: fd.get('title') as string,
      description: description.trim() || undefined,
      base_price: fd.get('base_price') as string,
      margin_rate: fd.get('margin_rate') as string,
      shipping_fee: (fd.get('shipping_fee') as string) || undefined,
      stock: Number(fd.get('stock')) || 0,
      return_policy: returnPolicy.trim() || undefined,
      options: flatOptions.length > 0 ? flatOptions : undefined,
    };

    if (isEdit) {
      updateMut.mutate(payload);
    } else {
      createMut.mutate(payload);
    }
  };

  const flatCategories = flattenCategories(categories ?? []);
  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{isEdit ? '상품 수정' : '상품 등록'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Category & Title */}
        <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
              <Package className="h-4 w-4" />
              기본 정보
            </h2>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">카테고리 *</label>
              <select
                name="category_id"
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                required
                className={inputClass}
              >
                <option value="">선택하세요</option>
                {flatCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {'  '.repeat(c.depth)}{c.name} ({c.commission_rate}%)
                  </option>
                ))}
              </select>
              {commissionRate !== null && (
                <p className="mt-1 text-[11px] text-amber-600 font-medium">
                  이 카테고리의 거래 수수료: {commissionRate}% — 구매확정 시 판매가에서 차감되어 회사 수익이 됩니다.
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">상품명 *</label>
              <input
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="상품명을 입력하세요"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">상품 설명</label>
              <Suspense
                fallback={
                  <div className="flex h-[220px] items-center justify-center rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
                  </div>
                }
              >
                <RichTextEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="상품에 대한 상세 설명을 입력하세요. 이미지도 삽입할 수 있습니다."
                  onImageUpload={handleEditorImageUpload}
                />
              </Suspense>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">가격 및 재고</h2>
          </div>
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">기본가 (USDT) *</label>
                <input
                  name="base_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  required
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">마진율 (%) *</label>
                <input
                  name="margin_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={marginRate}
                  onChange={(e) => setMarginRate(e.target.value)}
                  required
                  placeholder="0~100"
                  className={inputClass}
                />
                <p className="mt-1 text-[11px] text-gray-400">0~100% 사이로 설정 (0% 가능, 무마진 상품 허용)</p>
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">배송비 (USDT)</label>
                <input
                  name="shipping_fee"
                  type="text"
                  value={shippingFee}
                  onChange={(e) => setShippingFee(e.target.value)}
                  placeholder="0"
                  className={inputClass}
                />
              </div>
            </div>
            {/* v1.2.0 가격 미리보기: 판매가, 거래수수료, 셀러 입금 예상액을 분리 표시 */}
            {calculatedFinalPrice !== null && (
              <div className="space-y-2 rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">예상 판매가 (구매자 결제)</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {calculatedFinalPrice.toFixed(2)} USDT
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">
                  = 원가({basePrice || 0}) × (1 + 마진 {marginRate || 0}%)
                </p>
                {commissionRate !== null && commissionPreview !== null && sellerPayoutPreview !== null && (
                  <div className="mt-2 space-y-1 border-t border-gray-200 pt-2 dark:border-gray-700">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-gray-500 dark:text-gray-400">- 거래수수료 ({commissionRate}%)</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        - {commissionPreview.toFixed(2)} USDT
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">셀러 입금 예상액</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {sellerPayoutPreview.toFixed(2)} USDT
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-gray-500 dark:text-gray-400">재고 *</label>
              <input
                name="stock"
                type="number"
                value={stock}
                onChange={(e) => setStock(Math.max(0, Number(e.target.value) || 0))}
                required
                min={0}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Return Policy */}
        <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">반품 정책</h2>
          </div>
          <div className="p-5">
            <Suspense
              fallback={
                <div className="flex h-[180px] items-center justify-center rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
                </div>
              }
            >
              <RichTextEditor
                value={returnPolicy}
                onChange={setReturnPolicy}
                placeholder="반품/교환 정책을 입력하세요"
              />
            </Suspense>
          </div>
        </div>

        {/* Images */}
        <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
              <ImagePlus className="h-4 w-4" />
              상품 이미지
            </h2>
          </div>
          <div className="p-5">
            {isEdit && product?.images && product.images.length > 0 && (
              <div className="mb-4 flex gap-2">
                {product.images.map((img) => (
                  <img key={img.id} src={img.image_url} alt="" className="h-16 w-16 rounded-xl border border-gray-200 object-cover dark:border-gray-700" />
                ))}
              </div>
            )}
            <label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-8 transition-colors hover:border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 dark:hover:bg-gray-700">
              <Upload className="mb-2 h-8 w-8 text-gray-400" />
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">클릭하여 이미지 선택</span>
              <span className="mt-1 text-[11px] text-gray-400">최대 10개, 각 10MB 이하 (JPG, PNG, WebP)</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                className="hidden"
              />
            </label>
            {files.length > 0 && (
              <p className="mt-2 text-[12px] font-bold text-emerald-500">{files.length}개 파일 선택됨</p>
            )}
          </div>
        </div>

        {/* Options */}
        <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">옵션</h2>
            <button
              type="button"
              onClick={() =>
                setOptionGroups([
                  ...optionGroups,
                  { name: '', values: [{ value: '', additional_price: '0', stock: 0 }] },
                ])
              }
              className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <Plus className="h-3 w-3" />
              옵션 그룹 추가
            </button>
          </div>
          <div className="p-5">
            {optionGroups.length === 0 ? (
              <p className="text-center text-[13px] text-gray-400">
                등록된 옵션이 없습니다. 색상·사이즈 같은 선택지가 있으면 옵션 그룹을 추가해주세요.
              </p>
            ) : (
              <div className="space-y-5">
                {optionGroups.map((group, gi) => (
                  <div key={gi} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                    {/* 그룹명 + 그룹 삭제 */}
                    <div className="mb-3 flex items-center gap-2">
                      <label className="shrink-0 text-[12px] font-bold text-gray-500 dark:text-gray-400">옵션명</label>
                      <input
                        placeholder="예: 색상, 사이즈"
                        maxLength={50}
                        value={group.name}
                        onChange={(e) => {
                          const n = [...optionGroups];
                          n[gi] = { ...n[gi], name: e.target.value };
                          setOptionGroups(n);
                        }}
                        className={`flex-1 ${optionInputClass}`}
                      />
                      <button
                        type="button"
                        onClick={() => setOptionGroups(optionGroups.filter((_, j) => j !== gi))}
                        aria-label="옵션 그룹 삭제"
                        title="옵션 그룹 삭제"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* 값 목록 */}
                    <div className="space-y-2">
                      <div className="hidden gap-2 px-1 text-[11px] font-bold text-gray-400 sm:flex">
                        <span className="flex-1">옵션값 (예: 빨강)</span>
                        <span className="w-28 text-right">추가 가격</span>
                        <span className="w-20 text-right">재고</span>
                        <span className="w-8" />
                      </div>
                      {group.values.map((v, vi) => (
                        <div key={vi} className="flex items-center gap-2">
                          <input
                            placeholder="옵션값 (예: 빨강)"
                            maxLength={100}
                            value={v.value}
                            onChange={(e) => {
                              const n = optionGroups.map((g, j) =>
                                j === gi
                                  ? { ...g, values: g.values.map((x, k) => (k === vi ? { ...x, value: e.target.value } : x)) }
                                  : g,
                              );
                              setOptionGroups(n);
                            }}
                            className={`flex-1 ${optionInputClass}`}
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="추가 가격"
                            value={v.additional_price}
                            onChange={(e) => {
                              const n = optionGroups.map((g, j) =>
                                j === gi
                                  ? { ...g, values: g.values.map((x, k) => (k === vi ? { ...x, additional_price: e.target.value } : x)) }
                                  : g,
                              );
                              setOptionGroups(n);
                            }}
                            className={`w-28 ${optionInputClass}`}
                          />
                          <input
                            type="number"
                            min="0"
                            placeholder="재고"
                            value={Number.isFinite(v.stock) ? v.stock : 0}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const newStock = raw === '' ? 0 : Math.max(0, Number(raw) || 0);
                              const n = optionGroups.map((g, j) =>
                                j === gi
                                  ? { ...g, values: g.values.map((x, k) => (k === vi ? { ...x, stock: newStock } : x)) }
                                  : g,
                              );
                              setOptionGroups(n);
                            }}
                            className={`w-20 ${optionInputClass}`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const n = optionGroups.map((g, j) =>
                                j === gi ? { ...g, values: g.values.filter((_, k) => k !== vi) } : g,
                              );
                              setOptionGroups(n);
                            }}
                            aria-label="옵션값 삭제"
                            title="옵션값 삭제"
                            disabled={group.values.length === 1}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 transition-colors hover:bg-red-100 disabled:opacity-30 dark:bg-red-500/10 dark:hover:bg-red-500/20"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const n = optionGroups.map((g, j) =>
                            j === gi
                              ? { ...g, values: [...g.values, { value: '', additional_price: '0', stock: 0 }] }
                              : g,
                          );
                          setOptionGroups(n);
                        }}
                        className="mt-1 flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                      >
                        <Plus className="h-3 w-3" />
                        옵션값 추가
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-gray-900 py-3 text-[14px] font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            <Package className="h-4 w-4" />
            {isPending ? '저장 중...' : isEdit ? '수정하기' : '등록하기'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-full bg-gray-100 px-8 py-3 text-[14px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            취소
          </button>
        </div>

        {(createMut.error || updateMut.error) && (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-medium text-red-500 dark:bg-red-500/10">
            <AlertCircle className="h-4 w-4" />
            오류가 발생했습니다. 입력을 확인해주세요.
          </div>
        )}
      </form>
    </div>
  );
}

function flattenCategories(cats: CategoryTree[], depth = 0): (CategoryTree & { depth: number })[] {
  return cats.flatMap((c) => [
    { ...c, depth },
    ...flattenCategories(c.children, depth + 1),
  ]);
}
