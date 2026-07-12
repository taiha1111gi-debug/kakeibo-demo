import { afterEach, describe, expect, it } from "vitest";
import {
  daysInMonth,
  fromDateTimeLocalValue,
  getDayBoundaryHour,
  jstDateKeyOf,
  jstMonthKeyOf,
  monthKeyToJstRange,
  monthKeysBetween,
  setDayBoundaryHour,
  shiftMonthKey,
  subscribeDayBoundaryHour,
} from "@/lib/format";

describe("jstMonthKeyOf / jstDateKeyOf", () => {
  it("UTC表記でもJSTの月に割り当てる（月境界の0時〜9時）", () => {
    // 7/31 22:00 UTC = 8/1 07:00 JST
    expect(jstMonthKeyOf("2026-07-31T22:00:00+00:00")).toBe("2026-08");
    expect(jstDateKeyOf("2026-07-31T22:00:00+00:00")).toBe("2026-08-01");
  });

  it("JSTの月末23:59は当月のまま", () => {
    // 7/31 14:59 UTC = 7/31 23:59 JST
    expect(jstMonthKeyOf("2026-07-31T14:59:59+00:00")).toBe("2026-07");
  });

  it("オフセット付きISOも正しく変換する", () => {
    expect(jstDateKeyOf("2026-07-02T18:40:00+09:00")).toBe("2026-07-02");
  });
});

describe("shiftMonthKey", () => {
  it("年をまたいで前後できる", () => {
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
    expect(shiftMonthKey("2026-07", -7)).toBe("2025-12");
    expect(shiftMonthKey("2026-07", 0)).toBe("2026-07");
    expect(shiftMonthKey("2026-07", 18)).toBe("2028-01");
  });
});

describe("daysInMonth", () => {
  it("閏年を含む月日数を返す", () => {
    expect(daysInMonth("2024-02")).toBe(29);
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2026-07")).toBe(31);
    expect(daysInMonth("2026-04")).toBe(30);
  });
});

describe("monthKeyToJstRange", () => {
  it("JSTの月初から翌月初の半開区間を返す", () => {
    expect(monthKeyToJstRange("2026-07")).toEqual({
      startIso: "2026-07-01T00:00:00+09:00",
      endIso: "2026-08-01T00:00:00+09:00",
    });
  });

  it("年末は翌年1月が終端になる", () => {
    expect(monthKeyToJstRange("2026-12").endIso).toBe("2027-01-01T00:00:00+09:00");
  });
});

describe("monthKeysBetween", () => {
  it("両端を含む昇順の月キーを返す", () => {
    expect(monthKeysBetween("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthKeysBetween("2026-07", "2026-07")).toEqual(["2026-07"]);
  });

  it("逆転していれば空を返す", () => {
    expect(monthKeysBetween("2026-08", "2026-07")).toEqual([]);
  });
});

describe("fromDateTimeLocalValue", () => {
  it("datetime-local値をJST固定のtimestamptz文字列にする", () => {
    expect(fromDateTimeLocalValue("2026-07-02T18:40")).toBe("2026-07-02T18:40:00+09:00");
    expect(fromDateTimeLocalValue("2026-07-02T18:40:15")).toBe("2026-07-02T18:40:15+09:00");
  });
});

describe("締め時刻（dayBoundaryHour）", () => {
  afterEach(() => setDayBoundaryHour(0));

  it("朝6時締めでは5:59までを前日として扱う", () => {
    setDayBoundaryHour(6);
    // 7/2 20:59 UTC = 7/3 05:59 JST → 前日の7/2
    expect(jstDateKeyOf("2026-07-02T20:59:59+00:00")).toBe("2026-07-02");
    // 7/2 21:00 UTC = 7/3 06:00 JST → 当日の7/3
    expect(jstDateKeyOf("2026-07-02T21:00:00+00:00")).toBe("2026-07-03");
  });

  it("月の解釈も締め時刻に連動する（月初の深夜は前月扱い）", () => {
    setDayBoundaryHour(6);
    // 7/31 18:00 UTC = 8/1 03:00 JST → 7/31扱い → 7月
    expect(jstMonthKeyOf("2026-07-31T18:00:00+00:00")).toBe("2026-07");
    // 7/31 21:00 UTC = 8/1 06:00 JST → 8/1扱い → 8月
    expect(jstMonthKeyOf("2026-07-31T21:00:00+00:00")).toBe("2026-08");
  });

  it("月の取得範囲が締め時刻起点になる", () => {
    setDayBoundaryHour(6);
    expect(monthKeyToJstRange("2026-07")).toEqual({
      startIso: "2026-07-01T06:00:00+09:00",
      endIso: "2026-08-01T06:00:00+09:00",
    });
  });

  it("0時（標準）では従来どおり", () => {
    setDayBoundaryHour(0);
    expect(jstDateKeyOf("2026-07-02T20:59:59+00:00")).toBe("2026-07-03");
    expect(monthKeyToJstRange("2026-07").startIso).toBe("2026-07-01T00:00:00+09:00");
  });

  it("範囲外・不正な値は0時に丸める", () => {
    setDayBoundaryHour(99);
    expect(getDayBoundaryHour()).toBe(0);
    setDayBoundaryHour(-1);
    expect(getDayBoundaryHour()).toBe(0);
    setDayBoundaryHour(2.5);
    expect(getDayBoundaryHour()).toBe(0);
  });

  it("引数で締め時刻を明示すればグローバル設定に依存しない", () => {
    setDayBoundaryHour(0);
    expect(jstDateKeyOf("2026-07-02T20:59:59+00:00", 6)).toBe("2026-07-02");
    expect(jstMonthKeyOf("2026-07-31T18:00:00+00:00", 6)).toBe("2026-07");
    expect(monthKeyToJstRange("2026-07", 6).startIso).toBe("2026-07-01T06:00:00+09:00");
    // グローバル側は0時のまま影響を受けない
    expect(jstDateKeyOf("2026-07-02T20:59:59+00:00")).toBe("2026-07-03");
  });

  it("値の変更を購読者へ通知する（同値では通知しない）", () => {
    let calls = 0;
    const unsubscribe = subscribeDayBoundaryHour(() => {
      calls += 1;
    });
    setDayBoundaryHour(6);
    expect(calls).toBe(1);
    setDayBoundaryHour(6);
    expect(calls).toBe(1);
    setDayBoundaryHour(0);
    expect(calls).toBe(2);
    unsubscribe();
    setDayBoundaryHour(3);
    expect(calls).toBe(2);
    setDayBoundaryHour(0);
  });
});
