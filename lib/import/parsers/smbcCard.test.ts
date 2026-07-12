import { describe, expect, it } from "vitest";
import { smbcCardParser } from "@/lib/import/parsers/smbcCard";

const singleUsageEmail = `
ワタナベ タロウ 様

いつも三井住友カードのご利用ありがとうございます。
お客さまのカードご利用内容をお知らせします。

ご利用日時：2026/07/08 12:34
セブン-イレブン 618円

ご利用内容の詳細はVpassにてご確認ください。
`;

const multiUsageEmail = `
いつも三井住友カードのご利用ありがとうございます。

ご利用日時：2026/07/08 12:34
セブン-イレブン 618円

ご利用日時：2026/07/09 09:15
スターバックス 1,550円

本メールは送信専用です。
`;

describe("smbcCardParser", () => {
  it("三井住友カードの通知にマッチする", () => {
    expect(smbcCardParser.matches(singleUsageEmail)).toBe(true);
    expect(smbcCardParser.matches("Amazonの発送通知です。")).toBe(false);
  });

  it("通常の利用通知1件を解析する", () => {
    const items = smbcCardParser.parse(singleUsageEmail);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      occurredOn: "2026-07-08",
      occurredTime: "12:34",
      amount: 618,
      merchantName: "セブン-イレブン",
      serviceName: "三井住友カード",
    });
  });

  it("複数の利用通知をすべて解析する", () => {
    const items = smbcCardParser.parse(multiUsageEmail);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      occurredOn: "2026-07-08",
      occurredTime: "12:34",
      amount: 618,
      merchantName: "セブン-イレブン",
    });
    expect(items[1]).toMatchObject({
      occurredOn: "2026-07-09",
      occurredTime: "09:15",
      amount: 1550,
      merchantName: "スターバックス",
    });
  });

  it("店名末尾の（買物）を除去する", () => {
    const items = smbcCardParser.parse(`
三井住友カードのご利用通知

ご利用日時：2026/07/08 12:34
ローソン（買物） 1,200円
`);
    expect(items).toHaveLength(1);
    expect(items[0].merchantName).toBe("ローソン");
    expect(items[0].amount).toBe(1200);
  });

  it("全角英数字を半角に正規化して解析する", () => {
    const items = smbcCardParser.parse(`
三井住友カードのご利用通知

ご利用日時：２０２６/０７/０８ １８:０５
ＡＭＡＺＯＮ ＣＯ ＪＰ　１２３４円
`);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      occurredOn: "2026-07-08",
      occurredTime: "18:05",
      amount: 1234,
      merchantName: "AMAZON CO JP",
    });
  });

  it.each(["カード利用", "ご利用", "決済", "ショッピング"])(
    "汎用語「%s」を店名として採用しない",
    (generic) => {
      const items = smbcCardParser.parse(`
三井住友カードのご利用通知

ご利用日時：2026/07/08 12:34
${generic} 1,000円
`);
      expect(items).toHaveLength(1);
      expect(items[0].amount).toBe(1000);
      expect(items[0].merchantName).toBe("");
    },
  );
});

const labelFormatEmail = `
ヤマダ ハナコ　様

いつも三井住友カードをご利用頂きありがとうございます。
お客様のカードご利用内容をお知らせいたします。

ご利用カード：Ｏｌｉｖｅ／クレジット

◇利用日：2026/07/09 10:30
◇利用先：ローソン
◇利用取引：買物
◇利用金額：441円

本メールはカードご利用の承認照会に基づく通知であり、カードのご利用及びご請求を確定するものではございません。
`;

describe("smbcCardParser（Gmailラベル形式）", () => {
  it("◇利用日・◇利用先・◇利用金額の通知1件を解析する", () => {
    const items = smbcCardParser.parse(labelFormatEmail);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      occurredOn: "2026-07-09",
      occurredTime: "10:30",
      amount: 441,
      merchantName: "ローソン",
      serviceName: "三井住友カード",
    });
    expect(items[0].memo).toContain("利用取引：買物");
    expect(items[0].sourceText).toContain("◇利用金額：441円");
  });

  it("◇なしのラベルでも解析できる", () => {
    const items = smbcCardParser.parse(`
三井住友カードからのお知らせ

利用日：2026/07/09 10:30
利用先：ローソン
利用金額：441円
`);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      occurredOn: "2026-07-09",
      occurredTime: "10:30",
      amount: 441,
      merchantName: "ローソン",
    });
  });

  it("半角コロンでも解析できる", () => {
    const items = smbcCardParser.parse(`
三井住友カードからのお知らせ

◇利用日:2026/07/09 10:30
◇利用先:ローソン
◇利用金額:441円
`);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      occurredOn: "2026-07-09",
      occurredTime: "10:30",
      amount: 441,
      merchantName: "ローソン",
    });
  });

  it.each([
    ["441円", 441],
    ["8,140円", 8140],
    ["￥441", 441],
    ["¥441", 441],
    ["４４１円", 441],
    ["８，１４０円", 8140],
  ])("金額表記「%s」を%d円として解析する", (raw, expected) => {
    const items = smbcCardParser.parse(`
三井住友カードからのお知らせ

◇利用日：2026/07/09 10:30
◇利用先：ローソン
◇利用金額：${raw}
`);
    expect(items).toHaveLength(1);
    expect(items[0].amount).toBe(expected);
  });

  it("利用先の（買物）を除去する", () => {
    const items = smbcCardParser.parse(`
三井住友カードからのお知らせ

◇利用日：2026/07/09 10:30
◇利用先：ローソン（買物）
◇利用金額：441円
`);
    expect(items).toHaveLength(1);
    expect(items[0].merchantName).toBe("ローソン");
  });

  it("ラベル形式の複数通知から複数候補を作る", () => {
    const items = smbcCardParser.parse(`
いつも三井住友カードをご利用頂きありがとうございます。

◇利用日：2026/07/09 10:30
◇利用先：ローソン
◇利用取引：買物
◇利用金額：441円

◇利用日：2026/07/09 12:15
◇利用先：セブン－イレブン
◇利用取引：買物
◇利用金額：620円

本メールはカードご利用の承認照会に基づく通知です。
`);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      occurredOn: "2026-07-09",
      occurredTime: "10:30",
      amount: 441,
      merchantName: "ローソン",
    });
    expect(items[1]).toMatchObject({
      occurredOn: "2026-07-09",
      occurredTime: "12:15",
      amount: 620,
      merchantName: "セブン－イレブン",
    });
  });
});
