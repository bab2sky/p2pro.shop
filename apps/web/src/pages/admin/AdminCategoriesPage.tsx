import { useState, useMemo, useCallback, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { confirmAction } from '@/lib/confirm';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { adminApi } from '@/lib/api/admin';
import { GripVertical, ChevronDown, ChevronRight, Plus, Pencil, Trash2, ArrowUp, ArrowUpToLine, Eye, EyeOff, FolderTree } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  name_en: string | null;
  parent_id: string | null;
  sort_order: number;
  slug: string;
  icon: string | null;
  is_active: boolean;
  is_digital: boolean;
  commission_rate: number;
}

interface TreeNode extends Category {
  children: TreeNode[];
  depth: number;
}

function buildTree(categories: Category[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [], depth: 0 });
  }

  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      const parent = map.get(node.parent_id)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  const walk = (list: TreeNode[]) => {
    for (const node of list) {
      result.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return result;
}

// --- Edit Modal ---
interface EditModalProps {
  category: Category;
  allCategories: Category[];
  onClose: () => void;
  onSave: (id: string, data: { name: string; name_en: string; slug: string; icon?: string; parent_id?: string | null; commission_rate?: number; is_digital?: boolean }) => void;
  isSaving: boolean;
}

function EditModal({ category, allCategories, onClose, onSave, isSaving }: EditModalProps) {
  const [name, setName] = useState(category.name);
  const [nameEn, setNameEn] = useState(category.name_en || '');
  const [slug, setSlug] = useState(category.slug);
  const [icon, setIcon] = useState(category.icon || '');
  const [parentId, setParentId] = useState<string>(category.parent_id || '');
  const [commissionRate, setCommissionRate] = useState<string>(String(category.commission_rate ?? 5));
  const [isDigital, setIsDigital] = useState(category.is_digital);

  // Exclude self and descendants from parent options
  const getDescendantIds = useCallback((id: string): Set<string> => {
    const ids = new Set<string>();
    const collect = (parentId: string) => {
      for (const c of allCategories) {
        if (c.parent_id === parentId) {
          ids.add(c.id);
          collect(c.id);
        }
      }
    };
    collect(id);
    return ids;
  }, [allCategories]);

  const descendantIds = useMemo(() => getDescendantIds(category.id), [category.id, getDescendantIds]);
  const parentOptions = allCategories.filter(
    (c) => c.id !== category.id && !descendantIds.has(c.id)
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!nameEn.trim()) {
      toast.error('영어 이름 (English name) 은 필수입니다 — 글로벌 진출 정책');
      return;
    }
    onSave(category.id, {
      name: name.trim(),
      name_en: nameEn.trim(),
      slug: slug.trim(),
      icon: icon.trim() || undefined,
      parent_id: parentId || null,
      commission_rate: parseFloat(commissionRate) || 5,
      is_digital: isDigital,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-5 text-lg font-bold text-gray-900 dark:text-white">카테고리 수정</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">이름 (한국어) *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">English name * (글로벌 진출 필수)</label>
            <input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              required
              placeholder="e.g., Electronics, Beauty, Health"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
            <p className="mt-1 text-[11px] text-gray-400">영어 사용자에게 표시될 카테고리 이름</p>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">Slug *</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">아이콘 (이모지)</label>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="예: 📱, 👕, 🏠"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">거래 수수료 (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
            <p className="mt-1 text-[11px] text-gray-400">상품 원가 기준으로 수수료가 계산됩니다</p>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">디지털 상품 카테고리</p>
              <p className="text-[11px] text-gray-400">실물 배송 없음 — 주문서에 주소 입력 생략</p>
            </div>
            <button
              type="button"
              onClick={() => setIsDigital((v) => !v)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${isDigital ? 'bg-violet-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              role="switch"
              aria-checked={isDigital}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isDigital ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">상위 카테고리</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="">최상위 (없음)</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {'—'.repeat(buildDepth(c.id, allCategories))} {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !slug.trim() || isSaving}
              className="rounded-full bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Add Subcategory Modal ---
interface AddSubModalProps {
  parent: Category;
  onClose: () => void;
  onSave: (data: { name: string; parent_id: string; icon?: string }) => void;
  isSaving: boolean;
}

function AddSubModal({ parent, onClose, onSave, isSaving }: AddSubModalProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave({
      name: name.trim(),
      parent_id: parent.id,
      icon: icon.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-5 text-lg font-bold text-gray-900 dark:text-white">
          <span className="text-gray-400">{parent.icon || ''} {parent.name}</span>
          <span className="text-gray-400"> → </span>
          하위 카테고리 추가
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">이름 *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">아이콘 (이모지)</label>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="예: 📱, 👕"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-full bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">취소</button>
            <button type="submit" disabled={!name.trim() || isSaving} className="rounded-full bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">
              {isSaving ? '추가 중...' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function buildDepth(id: string, categories: Category[]): number {
  let depth = 0;
  let current = categories.find((c) => c.id === id);
  while (current?.parent_id) {
    depth++;
    current = categories.find((c) => c.id === current!.parent_id);
  }
  return depth;
}

// --- Sortable Row ---
function SortableRow({
  node,
  collapsed,
  onToggle,
  onEdit,
  onAddSub,
  onDelete,
  onMove,
  onMoveOrder,
  onToggleActive,
  isDeleting,
  isFirst,
  isLast,
}: {
  node: TreeNode;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (node: TreeNode) => void;
  onAddSub: (node: TreeNode) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, parentId: string | null) => void;
  onMoveOrder: (id: string, direction: 'up' | 'down') => void;
  onToggleActive: (id: string) => void;
  isDeleting: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isExpanded = !collapsed.has(node.id);
  const hasChildren = node.children.length > 0;

  return (
    <tr ref={setNodeRef} style={style} className={`border-b border-gray-50 hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50 ${!node.is_active ? 'opacity-50' : ''}`}>
      {/* Drag handle */}
      <td className="px-3 py-3 w-8">
        <button {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600 p-1">
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      {/* Icon */}
      <td className="px-3 py-3 w-8 text-center text-lg">{node.icon || ''}</td>
      {/* Name */}
      <td className="px-5 py-3">
        <div className="flex items-center" style={{ paddingLeft: `${node.depth * 20}px` }}>
          {hasChildren ? (
            <button
              onClick={() => onToggle(node.id)}
              className="mr-1 text-gray-400 hover:text-gray-600 w-5 text-center"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="mr-1 w-5 text-center text-gray-300">·</span>
          )}
          <span className="font-bold text-gray-900 dark:text-white">{node.name}</span>
          {node.is_digital && (
            <span className="ml-2 rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-bold text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
              디지털
            </span>
          )}
          {!node.is_active && (
            <span className="ml-2 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-600">
              숨김
            </span>
          )}
          {hasChildren && (
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500 dark:bg-gray-800">
              {node.children.length}
            </span>
          )}
        </div>
      </td>
      {/* Slug */}
      <td className="px-5 py-3 text-gray-500 text-xs font-mono">{node.slug}</td>
      {/* Commission Rate */}
      <td className="px-5 py-3 text-center">
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          {node.commission_rate}%
        </span>
      </td>
      {/* Order */}
      <td className="px-5 py-3 text-center text-xs text-gray-400">{node.sort_order}</td>
      {/* Actions */}
      <td className="px-5 py-3">
        <div className="flex gap-1 justify-end flex-wrap items-center">
          {/* Sort order buttons */}
          <div className="flex flex-col mr-1">
            <button
              onClick={() => onMoveOrder(node.id, 'up')}
              disabled={isFirst}
              className="text-gray-400 hover:text-gray-700 disabled:opacity-20 dark:hover:text-gray-200 leading-none p-0.5"
              title="위로 이동"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onMoveOrder(node.id, 'down')}
              disabled={isLast}
              className="text-gray-400 hover:text-gray-700 disabled:opacity-20 dark:hover:text-gray-200 leading-none p-0.5 rotate-180"
              title="아래로 이동"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={() => onToggleActive(node.id)}
            className="rounded-full bg-gray-100 p-1.5 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
            title={node.is_active ? '숨기기' : '표시하기'}
          >
            {node.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => onEdit(node)}
            className="rounded-full bg-gray-100 p-1.5 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
            title="수정"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onAddSub(node)}
            className="rounded-full bg-gray-100 p-1.5 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-white"
            title="하위 카테고리 추가"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          {node.parent_id && (
            <button
              onClick={() => onMove(node.id, null)}
              className="rounded-full bg-gray-100 p-1.5 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
              title="최상위로 이동"
            >
              <ArrowUpToLine className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={async () => {
              const msg = hasChildren
                ? `"${node.name}" 카테고리를 삭제하면 하위 ${node.children.length}개 카테고리도 함께 삭제됩니다. 계속하시겠습니까?`
                : `"${node.name}" 카테고리를 삭제하시겠습니까?`;
              if (!(await confirmAction(msg))) return;
              onDelete(node.id);
            }}
            disabled={isDeleting}
            className="rounded-full bg-gray-100 p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:bg-gray-800 dark:hover:bg-red-900/30"
            title="삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// --- Main Page ---
export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [newParentId, setNewParentId] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [addSubTarget, setAddSubTarget] = useState<Category | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => adminApi.getCategories().then((r) => r.data.data as Category[]),
  });

  const tree = useMemo(() => (data ? buildTree(data) : []), [data]);
  const visibleList = useMemo(() => {
    const visible: TreeNode[] = [];
    const walk = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        visible.push(node);
        if (!collapsed.has(node.id)) {
          walk(node.children);
        }
      }
    };
    walk(tree);
    return visible;
  }, [tree, collapsed]);
  const flatList = useMemo(() => (data ? flattenTree(buildTree(data)) : []), [data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
    queryClient.removeQueries({ queryKey: ['categories'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; name_en?: string; parent_id?: string; icon?: string }) =>
      adminApi.createCategory(payload),
    onSuccess: () => { setNewName(''); setNewNameEn(''); setNewIcon(''); setNewParentId(''); setAddSubTarget(null); invalidate(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name: string; name_en: string; slug: string; icon?: string; parent_id?: string | null; commission_rate?: number; is_digital?: boolean }) =>
      adminApi.updateCategory(id, payload),
    onSuccess: () => { setEditTarget(null); invalidate(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteCategory(id),
    onSuccess: () => {
      toast.success('카테고리가 삭제되었습니다.');
      invalidate();
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      const message = error?.response?.data?.error?.message || '카테고리 삭제에 실패했습니다.';
      toast.error(message);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { id: string; sort_order: number; parent_id: string | null }[]) =>
      adminApi.reorderCategories(items),
    onSuccess: invalidate,
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string | null }) =>
      adminApi.moveCategory(id, { parent_id: parentId }),
    onSuccess: invalidate,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (id: string) => adminApi.toggleCategoryActive(id),
    onSuccess: invalidate,
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !data) return;

    const oldIndex = flatList.findIndex((n) => n.id === active.id);
    const newIndex = flatList.findIndex((n) => n.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(flatList, oldIndex, newIndex);
    const items = reordered.map((node, i) => ({
      id: node.id,
      sort_order: i,
      parent_id: node.parent_id,
    }));

    queryClient.setQueryData(['admin', 'categories'], () =>
      items.map((item) => {
        const orig = data.find((c) => c.id === item.id)!;
        return { ...orig, sort_order: item.sort_order };
      }),
    );

    reorderMutation.mutate(items);
  };

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    if (!newNameEn.trim()) {
      toast.error('영어 이름 (English name) 은 필수입니다 — 글로벌 진출 정책');
      return;
    }
    createMutation.mutate({
      name: newName.trim(),
      name_en: newNameEn.trim(),
      parent_id: newParentId || undefined,
      icon: newIcon.trim() || undefined,
    });
  };

  // Get siblings (same parent_id) for a given node
  const getSiblings = useCallback((node: TreeNode): TreeNode[] => {
    if (!node.parent_id) return tree;
    const parent = flatList.find((n) => n.id === node.parent_id);
    return parent ? parent.children : [];
  }, [tree, flatList]);

  const handleMoveOrder = useCallback((id: string, direction: 'up' | 'down') => {
    const node = flatList.find((n) => n.id === id);
    if (!node) return;
    const siblings = getSiblings(node);
    const idx = siblings.findIndex((s) => s.id === id);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === siblings.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const reordered = [...siblings];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

    const items = reordered.map((s, i) => ({
      id: s.id,
      sort_order: i,
      parent_id: s.parent_id,
    }));
    reorderMutation.mutate(items);
  }, [flatList, getSiblings, reorderMutation]);

  // Count stats
  const rootCount = tree.length;
  const totalCount = data?.length || 0;

  if (isLoading) return (
    <div className="space-y-4 p-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">카테고리 관리</h1>
        <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">
          총 {totalCount}개 (최상위 {rootCount}개)
        </span>
      </div>

      {/* Create form */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">카테고리 추가</h3>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-bold text-gray-500 dark:text-gray-400">상위 카테고리</label>
              <select
                value={newParentId}
                onChange={(e) => setNewParentId(e.target.value)}
                className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="">없음 (최상위로 생성)</option>
                {(data || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {'—'.repeat(buildDepth(c.id, data || []))} {c.icon || ''} {c.name}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              placeholder="아이콘"
              className="w-16 rounded-xl border border-gray-200 bg-gray-50 px-2 py-2.5 text-sm text-center outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="카테고리 이름 (한국어)"
              className="flex-1 min-w-[200px] rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            />
            <input
              value={newNameEn}
              onChange={(e) => setNewNameEn(e.target.value)}
              placeholder="English name *"
              className="flex-1 min-w-[180px] rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || !newNameEn.trim() || createMutation.isPending}
              className="rounded-full bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              {createMutation.isPending ? '추가 중...' : '추가'}
            </button>
          </div>
          {newParentId && (
            <p className="mt-2 text-xs text-gray-900 dark:text-white">
              → <strong>{(data || []).find((c) => c.id === newParentId)?.name}</strong>의 하위 카테고리로 생성됩니다
            </p>
          )}
        </div>
      </div>

      {/* Category table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-3 py-3 w-8"></th>
                <th className="px-3 py-3 w-8 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">아이콘</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">이름</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">Slug</th>
                <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400 w-20">수수료</th>
                <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400 w-16">순서</th>
                <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400 w-56">작업</th>
              </tr>
            </thead>
            <SortableContext items={visibleList.map((n) => n.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {visibleList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <FolderTree className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
                      <p className="mt-3 font-bold text-gray-400">카테고리가 없습니다. 위에서 새 카테고리를 추가하세요.</p>
                    </td>
                  </tr>
                ) : (
                  visibleList.map((node) => {
                    const siblings = getSiblings(node);
                    const sibIdx = siblings.findIndex((s) => s.id === node.id);
                    return (
                      <SortableRow
                        key={node.id}
                        node={node}
                        collapsed={collapsed}
                        onToggle={toggleCollapse}
                        onEdit={(n) => setEditTarget(n)}
                        onAddSub={(n) => setAddSubTarget(n)}
                        onDelete={(id) => deleteMutation.mutate(id)}
                        onMove={(id, parentId) => moveMutation.mutate({ id, parentId })}
                        onMoveOrder={handleMoveOrder}
                        onToggleActive={(id) => toggleActiveMutation.mutate(id)}
                        isDeleting={deleteMutation.isPending}
                        isFirst={sibIdx === 0}
                        isLast={sibIdx === siblings.length - 1}
                      />
                    );
                  })
                )}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
      </div>

      {/* Edit Modal */}
      {editTarget && (
        <EditModal
          category={editTarget}
          allCategories={data || []}
          onClose={() => setEditTarget(null)}
          onSave={(id, payload) => updateMutation.mutate({ id, ...payload })}
          isSaving={updateMutation.isPending}
        />
      )}

      {/* Add Sub Modal */}
      {addSubTarget && (
        <AddSubModal
          parent={addSubTarget}
          onClose={() => setAddSubTarget(null)}
          onSave={(payload) => createMutation.mutate(payload)}
          isSaving={createMutation.isPending}
        />
      )}
    </div>
  );
}
