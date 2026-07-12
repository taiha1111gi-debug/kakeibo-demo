"use client";

import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import {
  createCategory,
  createPaymentMethod,
  deleteCategory,
  deletePaymentMethod,
  fetchAllCategories,
  fetchAllPaymentMethods,
  updateCategory,
  updatePaymentMethod,
} from "@/lib/data";
import { MASTER_ITEM_COLORS } from "@/lib/types";

// カテゴリ・支払方法の管理（名称変更・色変更・並び替え・非表示化・未使用の削除）。

type EditableItem = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  // 非表示にできない項目（未分類などのシステムカテゴリ）
  locked: boolean;
};

type MasterItemPatch = { name?: string; sortOrder?: number; isActive?: boolean; color?: string };

type MasterListEditorProps = {
  title: string;
  itemLabel: string;
  load: () => Promise<EditableItem[]>;
  save: (id: string, patch: MasterItemPatch) => Promise<void>;
  create: (name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  // 保存成功後に呼ばれる（アカウント画面の件数表示などを更新するため）
  onChanged?: () => void;
};

function MasterListEditor({ title, itemLabel, load, save, create, remove, onChanged }: MasterListEditorProps) {
  const [items, setItems] = useState<EditableItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [newName, setNewName] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setItems(await load());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "読み込みに失敗しました。");
    }
  }, [load]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = useCallback(async (operation: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
      await reload();
      onChanged?.();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "更新に失敗しました。");
    } finally {
      setBusy(false);
    }
  }, [onChanged, reload]);

  const startRename = (item: EditableItem) => {
    setError(null);
    setColorPickerId(null);
    setEditingId(item.id);
    setEditingName(item.name);
  };

  const commitRename = () => {
    if (!editingId || !items) return;
    const current = items.find((item) => item.id === editingId);
    const name = editingName.trim();
    if (!current) return;
    if (!name || name === current.name) {
      setEditingId(null);
      return;
    }
    if (name.length > 40) {
      setError(`${itemLabel}名は40文字以内にしてください。`);
      return;
    }
    const id = editingId;
    setEditingId(null);
    void run(() => save(id, { name }));
  };

  const move = (index: number, direction: -1 | 1) => {
    if (!items) return;
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    // 並びを10刻みで振り直し、値が変わった行だけ保存する
    const changes = next.flatMap((item, position) => {
      const sortOrder = (position + 1) * 10;
      return item.sortOrder === sortOrder ? [] : [{ id: item.id, sortOrder }];
    });
    if (!changes.length) return;
    void run(async () => {
      await Promise.all(changes.map((change) => save(change.id, { sortOrder: change.sortOrder })));
    });
  };

  const commitCreate = () => {
    const name = newName.trim();
    if (!name) return;
    if (name.length > 40) {
      setError(`${itemLabel}名は40文字以内にしてください。`);
      return;
    }
    void run(async () => {
      await create(name);
      setNewName("");
    });
  };

  const toggleActive = (item: EditableItem) => {
    if (item.locked || !items) return;
    if (item.isActive && items.filter((entry) => entry.isActive).length <= 1) {
      setError(`最後の${itemLabel}は非表示にできません。`);
      return;
    }
    void run(() => save(item.id, { isActive: !item.isActive }));
  };

  const startDelete = (item: EditableItem) => {
    if (item.locked || !items) return;
    if (item.isActive && items.filter((entry) => entry.isActive).length <= 1) {
      setError(`最後の${itemLabel}は削除できません。`);
      return;
    }
    setError(null);
    setColorPickerId(null);
    setConfirmingDeleteId(item.id);
  };

  const commitDelete = (item: EditableItem) => {
    setConfirmingDeleteId(null);
    void run(() => remove(item.id));
  };

  return (
    <details className="group surface-card breakdown-card overflow-hidden">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3.5 font-black [&::-webkit-details-marker]:hidden">
        <span className="text-sm">{title}</span>
        <Icon name="chevron" className="h-4 w-4 text-[var(--muted)] transition-transform group-open:rotate-90" />
      </summary>
      <div className="space-y-2 border-t border-[var(--line)] p-3">
        <p className="text-[10px] leading-4 text-[var(--muted)]">
          名称の変更は過去の支出の表示にも反映されます。使い終わった項目は「非表示」、間違えて作った未使用の項目は「削除」。
          過去の支出で使用中の項目は削除できません（履歴を守るためです）。
        </p>
        {error ? <p role="alert" className="rounded-lg bg-[var(--danger-soft)] p-2 text-xs font-bold text-[var(--danger)]">{error}</p> : null}
        {!items ? (
          <p className="p-2 text-center text-xs text-[var(--muted)]">読み込んでいます…</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((item, index) => (
              <li key={item.id} className="rounded-xl border border-[var(--line)] px-2 py-1.5">
                <div className="flex min-h-8 items-center gap-1.5">
                {editingId === item.id ? (
                  <>
                    <input
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitRename();
                        }
                        if (event.key === "Escape") setEditingId(null);
                      }}
                      maxLength={40}
                      autoFocus
                      className="field min-w-0 flex-1 px-2 text-xs font-bold"
                    />
                    <button type="button" disabled={busy} onClick={commitRename} className="secondary-button shrink-0 px-2 text-[10px] disabled:opacity-60">保存</button>
                    <button type="button" disabled={busy} onClick={() => setEditingId(null)} className="secondary-button shrink-0 px-2 text-[10px] disabled:opacity-60">取消</button>
                  </>
                ) : confirmingDeleteId === item.id ? (
                  <>
                    <span className="min-w-0 flex-1 truncate text-xs font-black text-[var(--danger)]">「{item.name}」を削除しますか？</span>
                    <button type="button" disabled={busy} onClick={() => commitDelete(item)} className="secondary-button shrink-0 px-2 text-[10px] font-bold text-[var(--danger)] disabled:opacity-60">削除する</button>
                    <button type="button" disabled={busy} onClick={() => setConfirmingDeleteId(null)} className="secondary-button shrink-0 px-2 text-[10px] disabled:opacity-60">取消</button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-label={`${item.name}の色を変更`}
                      title="色を変更"
                      disabled={busy}
                      onClick={() => {
                        setError(null);
                        setColorPickerId(colorPickerId === item.id ? null : item.id);
                      }}
                      className="grid h-8 w-6 shrink-0 place-items-center disabled:opacity-25"
                    >
                      <span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: item.color }} />
                    </button>
                    <span className={`min-w-0 flex-1 truncate text-xs font-bold ${item.isActive ? "" : "text-[var(--muted)] line-through"}`}>
                      {item.name}
                      {item.locked ? <span className="ml-1 rounded bg-[var(--brand-soft)] px-1 py-0.5 text-[10px] font-black text-[var(--brand)]">固定</span> : null}
                    </span>
                    <button type="button" aria-label={`${item.name}を上へ`} disabled={busy || index === 0} onClick={() => move(index, -1)} className="icon-button grid h-8 w-8 shrink-0 place-items-center rounded-lg disabled:opacity-25">
                      <Icon name="chevron" className="h-3.5 w-3.5 -rotate-90" />
                    </button>
                    <button type="button" aria-label={`${item.name}を下へ`} disabled={busy || index === items.length - 1} onClick={() => move(index, 1)} className="icon-button grid h-8 w-8 shrink-0 place-items-center rounded-lg disabled:opacity-25">
                      <Icon name="chevron" className="h-3.5 w-3.5 rotate-90" />
                    </button>
                    <button type="button" aria-label={`${item.name}の名前を変更`} title="改名" disabled={busy} onClick={() => startRename(item)} className="icon-button grid h-8 w-8 shrink-0 place-items-center rounded-lg disabled:opacity-25">
                      <Icon name="pencil" className="h-3.5 w-3.5" />
                    </button>
                    {item.locked ? null : (
                      <>
                        <button type="button" aria-label={item.isActive ? `${item.name}を非表示にする` : `${item.name}を再表示する`} title={item.isActive ? "非表示" : "再表示"} disabled={busy} onClick={() => toggleActive(item)} className="icon-button grid h-8 w-8 shrink-0 place-items-center rounded-lg disabled:opacity-25">
                          <Icon name={item.isActive ? "eyeOff" : "eye"} className="h-4 w-4" />
                        </button>
                        <button type="button" aria-label={`${item.name}を削除`} title="削除" disabled={busy} onClick={() => startDelete(item)} className="icon-button grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--danger)] disabled:opacity-25">
                          <Icon name="trash" className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </>
                )}
                </div>
                {colorPickerId === item.id ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 border-t border-[var(--line)] pt-1.5" role="group" aria-label={`${item.name}の色を選ぶ`}>
                    {MASTER_ITEM_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`色 ${color} にする`}
                        disabled={busy}
                        onClick={() => {
                          setColorPickerId(null);
                          void run(() => save(item.id, { color }));
                        }}
                        className={`h-7 w-7 rounded-full border-2 disabled:opacity-40 ${item.color.toLowerCase() === color.toLowerCase() ? "border-[var(--foreground)]" : "border-transparent"}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-1.5 border-t border-dashed border-[var(--line)] pt-2">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitCreate();
              }
            }}
            maxLength={40}
            placeholder={`新しい${itemLabel}名`}
            className="field min-w-0 flex-1 px-2 text-xs font-bold"
          />
          <button type="button" disabled={busy || !newName.trim()} onClick={commitCreate} className="secondary-button shrink-0 px-3 text-xs disabled:opacity-60">追加</button>
        </div>
      </div>
    </details>
  );
}

export function CategoryManager({ onChanged }: { onChanged?: () => void }) {
  const load = useCallback(async () => (await fetchAllCategories()).map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    locked: category.isSystem,
  })), []);
  const save = useCallback((id: string, patch: MasterItemPatch) => updateCategory(id, patch), []);
  const create = useCallback(async (name: string) => {
    await createCategory(name);
  }, []);
  const remove = useCallback((id: string) => deleteCategory(id), []);
  return <MasterListEditor title="カテゴリの管理" itemLabel="カテゴリ" load={load} save={save} create={create} remove={remove} onChanged={onChanged} />;
}

export function PaymentMethodManager({ onChanged }: { onChanged?: () => void }) {
  const load = useCallback(async () => (await fetchAllPaymentMethods()).map((method) => ({
    id: method.id,
    name: method.name,
    color: method.color,
    sortOrder: method.sortOrder,
    isActive: method.isActive,
    locked: false,
  })), []);
  const save = useCallback((id: string, patch: MasterItemPatch) => updatePaymentMethod(id, patch), []);
  const create = useCallback(async (name: string) => {
    await createPaymentMethod(name);
  }, []);
  const remove = useCallback((id: string) => deletePaymentMethod(id), []);
  return <MasterListEditor title="支払方法の管理" itemLabel="支払方法" load={load} save={save} create={create} remove={remove} onChanged={onChanged} />;
}
