import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "@/lib/types";

// モジュールレベルの状態（メモリキャッシュ・hydratedフラグ）をテストごとに
// リセットするため、vi.resetModules + 動的importでモジュールを読み直す。

const createStorageStub = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    _dump: () => store,
  };
};

type StorageStub = ReturnType<typeof createStorageStub>;

let storage: StorageStub;

const loadCache = async () => (await import("@/lib/kakeiboCache")).kakeiboCache;

const transaction = (id: string, monthDay = "07-02") => ({
  id,
  occurredAt: `2026-${monthDay}T09:40:00+00:00`,
  amount: 620,
} as unknown as Transaction);

const master = {
  categories: [{ id: "c-1", name: "未分類", color: "#e2a52e", sortOrder: 120, isActive: true, code: "unclassified", isSystem: true }],
  paymentMethods: [{ id: "p-1", code: "cash", name: "現金", color: "#d39a4a", sortOrder: 10, isActive: true }],
};

beforeEach(() => {
  vi.resetModules();
  storage = createStorageStub();
  vi.stubGlobal("window", { localStorage: storage });
});

describe("永続化と復元（stale-while-revalidate）", () => {
  it("setしたデータが別セッションでstaleとして復元される", async () => {
    const cache1 = await loadCache();
    cache1.setOwner("user-1");
    cache1.setMonth("2026-07", [transaction("t-1")]);
    cache1.setMaster(master);
    cache1.setMonthRange({ earliestMonth: "2026-06", latestMonth: "2026-07" });

    // 新しいセッション（モジュール読み直し＝メモリ空）
    vi.resetModules();
    const cache2 = await loadCache();
    expect(cache2.peekMonth("2026-07")).toBeUndefined(); // hydrate前は何もない
    cache2.hydrate();

    const entry = cache2.peekMonth("2026-07");
    expect(entry?.transactions.map((item) => item.id)).toEqual(["t-1"]);
    expect(entry?.isFresh).toBe(false); // 復元分はstale
    expect(cache2.getMonth("2026-07")).toBeUndefined(); // freshではないので取得短絡には使えない
    expect(cache2.peekMaster()?.categories[0].id).toBe("c-1");
    expect(cache2.getMaster()).toBeNull();
    expect(cache2.peekMonthRange()).toEqual({ earliestMonth: "2026-06", latestMonth: "2026-07" });
    expect(cache2.getMonthRange()).toBeNull();
  });

  it("hydrateは冪等で、fresh化した後のsetで再びfreshになる", async () => {
    const cache1 = await loadCache();
    cache1.setOwner("user-1");
    cache1.setMonth("2026-07", [transaction("t-1")]);

    vi.resetModules();
    const cache2 = await loadCache();
    cache2.hydrate();
    cache2.hydrate();
    cache2.setMonth("2026-07", [transaction("t-2")]);
    expect(cache2.getMonth("2026-07")?.[0].id).toBe("t-2");
  });
});

describe("破棄条件", () => {
  it("バージョンが違うキャッシュは復元せず削除する", async () => {
    storage.setItem("kakeibo-cache", JSON.stringify({ version: 99, userId: "user-1", savedAt: Date.now(), master: null, monthRange: null, months: { "2026-07": [transaction("t-1")] } }));
    const cache = await loadCache();
    cache.hydrate();
    expect(cache.peekMonth("2026-07")).toBeUndefined();
    expect(storage.getItem("kakeibo-cache")).toBeNull();
  });

  it("14日より古いキャッシュは復元せず削除する", async () => {
    storage.setItem("kakeibo-cache", JSON.stringify({ version: 1, userId: "user-1", savedAt: Date.now() - 15 * 24 * 60 * 60 * 1000, master: null, monthRange: null, months: { "2026-07": [transaction("t-1")] } }));
    const cache = await loadCache();
    cache.hydrate();
    expect(cache.peekMonth("2026-07")).toBeUndefined();
    expect(storage.getItem("kakeibo-cache")).toBeNull();
  });

  it("壊れたJSONは握りつぶして削除する", async () => {
    storage.setItem("kakeibo-cache", "{not json");
    const cache = await loadCache();
    expect(() => cache.hydrate()).not.toThrow();
    expect(storage.getItem("kakeibo-cache")).toBeNull();
  });
});

describe("ユーザー切替の防御", () => {
  it("同じ所有者でsetOwnerしても復元済みキャッシュは維持される", async () => {
    const cache1 = await loadCache();
    cache1.setOwner("demo-user");
    cache1.setMonth("2026-07", [transaction("t-1")]);

    vi.resetModules();
    const cache2 = await loadCache();
    cache2.hydrate();
    cache2.setOwner("demo-user");
    expect(cache2.peekMonth("2026-07")?.transactions).toHaveLength(1);
  });

  it("setOwnerで別ユーザーになったらメモリとストレージを全消しする", async () => {
    const cache = await loadCache();
    cache.setOwner("user-1");
    cache.setMonth("2026-07", [transaction("t-1")]);
    cache.setMaster(master);

    cache.setOwner("user-2");
    expect(cache.peekMonth("2026-07")).toBeUndefined();
    expect(cache.peekMaster()).toBeNull();
    const persisted = JSON.parse(storage.getItem("kakeibo-cache")!);
    expect(persisted.userId).toBe("user-2");
    expect(persisted.months).toEqual({});
  });

  it("同じユーザーのsetOwnerではキャッシュを保持する", async () => {
    const cache = await loadCache();
    cache.setOwner("user-1");
    cache.setMonth("2026-07", [transaction("t-1")]);
    cache.setOwner("user-1");
    expect(cache.getMonth("2026-07")?.[0].id).toBe("t-1");
  });
});

describe("世代ガード（通信の追い越し対策）", () => {
  it("取得開始後に無効化が起きていたら、古いデータの書き込みを捨てる", async () => {
    const cache = await loadCache();
    cache.setOwner("user-1");
    const generationAtFetchStart = cache.getGeneration();
    // 取得中に削除や設定変更が起きた想定
    cache.invalidateTransactions();
    cache.setMonth("2026-07", [transaction("stale")], generationAtFetchStart);
    expect(cache.peekMonth("2026-07")).toBeUndefined();
  });

  it("無効化がなければ書き込まれる（世代付き）", async () => {
    const cache = await loadCache();
    cache.setOwner("user-1");
    const generationAtFetchStart = cache.getGeneration();
    cache.setMonth("2026-07", [transaction("ok")], generationAtFetchStart);
    expect(cache.getMonth("2026-07")?.[0].id).toBe("ok");
  });

  it("世代を渡さない従来のsetMonthは常に書き込む", async () => {
    const cache = await loadCache();
    cache.setOwner("user-1");
    cache.invalidateTransactions();
    cache.setMonth("2026-07", [transaction("plain")]);
    expect(cache.getMonth("2026-07")?.[0].id).toBe("plain");
  });

  it("マスタデータも取得中の無効化で古い書き込みを捨てる", async () => {
    const cache = await loadCache();
    cache.setOwner("user-1");
    const generationAtFetchStart = cache.getGeneration();
    cache.invalidateMaster(); // 取得中にカテゴリ改名などが起きた想定
    cache.setMaster(master, generationAtFetchStart);
    expect(cache.peekMaster()).toBeNull();
    // 無効化がなければ書き込まれる
    const freshGeneration = cache.getGeneration();
    cache.setMaster(master, freshGeneration);
    expect(cache.getMaster()).not.toBeNull();
  });

  it("月範囲も取得中の無効化で古い書き込みを捨てる", async () => {
    const cache = await loadCache();
    cache.setOwner("user-1");
    const generationAtFetchStart = cache.getGeneration();
    cache.invalidateTransactions(); // 取得中に支出の登録・削除が起きた想定
    cache.setMonthRange({ earliestMonth: "2026-06", latestMonth: "2026-07" }, generationAtFetchStart);
    expect(cache.peekMonthRange()).toBeNull();
    const freshGeneration = cache.getGeneration();
    cache.setMonthRange({ earliestMonth: "2026-06", latestMonth: "2026-07" }, freshGeneration);
    expect(cache.getMonthRange()).not.toBeNull();
  });
});

describe("ログアウト時の全消去", () => {
  it("clearAllでメモリとlocalStorageの両方から消える", async () => {
    const cache = await loadCache();
    cache.setOwner("user-1");
    cache.setMonth("2026-07", [transaction("t-1")]);
    cache.setMaster(master);
    expect(storage.getItem("kakeibo-cache")).not.toBeNull();

    cache.clearAll();
    expect(cache.peekMonth("2026-07")).toBeUndefined();
    expect(cache.peekMaster()).toBeNull();
    expect(cache.peekMonthRange()).toBeNull();
    expect(storage.getItem("kakeibo-cache")).toBeNull();
  });
});

describe("無効化と容量上限", () => {
  it("invalidateTransactionsは月データと月範囲を消し、永続化にも反映する", async () => {
    const cache = await loadCache();
    cache.setOwner("user-1");
    cache.setMonth("2026-07", [transaction("t-1")]);
    cache.setMonthRange({ earliestMonth: "2026-06", latestMonth: "2026-07" });
    cache.setMaster(master);

    cache.invalidateTransactions();
    expect(cache.peekMonth("2026-07")).toBeUndefined();
    expect(cache.peekMonthRange()).toBeNull();
    expect(cache.peekMaster()).not.toBeNull(); // マスタは残る
    const persisted = JSON.parse(storage.getItem("kakeibo-cache")!);
    expect(persisted.months).toEqual({});
    expect(persisted.monthRange).toBeNull();
  });

  it("永続化する月は直近13か月分に制限される", async () => {
    const cache = await loadCache();
    cache.setOwner("user-1");
    for (let index = 0; index < 16; index += 1) {
      const month = String(index + 1).padStart(2, "0");
      const year = index < 12 ? 2025 : 2026;
      const key = `${year}-${index < 12 ? month : String(index - 11).padStart(2, "0")}`;
      cache.setMonth(key, [transaction(`t-${index}`)]);
    }
    const persisted = JSON.parse(storage.getItem("kakeibo-cache")!);
    const keys = Object.keys(persisted.months).sort();
    expect(keys).toHaveLength(13);
    expect(keys[0]).toBe("2025-04"); // 古い月から落ちる
    expect(keys[keys.length - 1]).toBe("2026-04");
  });
});

describe("締め時刻の永続化", () => {
  it("保存時の締め時刻がhydrateで復元される", async () => {
    const cache1 = await loadCache();
    const format1 = await import("@/lib/format");
    format1.setDayBoundaryHour(6);
    cache1.setOwner("user-1");
    cache1.setMonth("2026-07", [transaction("t-1")]);
    format1.setDayBoundaryHour(0);

    vi.resetModules();
    const cache2 = await loadCache();
    const format2 = await import("@/lib/format");
    expect(format2.getDayBoundaryHour()).toBe(0); // hydrate前はデフォルト
    cache2.hydrate();
    expect(format2.getDayBoundaryHour()).toBe(6); // 保存時の値が復元される
  });
});

describe("ストレージが使えない環境", () => {
  it("windowが無くても例外なく動く（SSR安全）", async () => {
    vi.unstubAllGlobals();
    const cache = await loadCache();
    expect(() => {
      cache.hydrate();
      cache.setOwner("user-1");
      cache.setMonth("2026-07", [transaction("t-1")]);
    }).not.toThrow();
    expect(cache.getMonth("2026-07")?.[0].id).toBe("t-1"); // メモリのみで動作
  });
});
