import { describe, expect, it } from "vitest";
import { parseEmail } from "@/lib/import/parseEmail";

const usageBlock = `ご利用日時：2026/07/08 12:34
セブン-イレブン 618円`;

const smbcEmail = `
いつも三井住友カードのご利用ありがとうございます。

${usageBlock}

本メールは送信専用です。
`;

describe("parseEmail", () => {
  it("三井住友カードの通知を解析して候補を返す", async () => {
    const result = await parseEmail(smbcEmail);
    expect(result.provider).toBe("smbc");
    expect(result.warnings).toEqual([]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      occurredOn: "2026-07-08",
      occurredTime: "12:34",
      amount: 618,
      merchantName: "セブン-イレブン",
      serviceName: "三井住友カード",
      provider: "smbc",
      sourceType: "email_paste",
    });
  });

  it("空の本文は警告を返す", async () => {
    const result = await parseEmail("   \n  ");
    expect(result.candidates).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });

  it.each(["返金", "利用取消", "返品", "キャンセル"])(
    "「%s」を含む通知は自動登録せず警告を返す",
    async (keyword) => {
      const result = await parseEmail(`
三井住友カードのご利用通知

${usageBlock}
上記のご利用について${keyword}の処理が行われました。
`);
      expect(result.candidates).toEqual([]);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("返金・取消");
    },
  );

  it("同じ通知ブロックならsourceHashが安定する", async () => {
    const emailWithFooter = `
いつも三井住友カードのご利用ありがとうございます。

${usageBlock}

本メールは送信専用です。
`;
    const emailWithoutFooter = `
三井住友カードのお知らせ
${usageBlock}
`;

    const first = await parseEmail(emailWithFooter);
    const second = await parseEmail(emailWithFooter);
    const differentSurroundings = await parseEmail(emailWithoutFooter);

    const hash = first.candidates[0].sourceHash;
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(second.candidates[0].sourceHash).toBe(hash);
    expect(differentSurroundings.candidates[0].sourceHash).toBe(hash);
    expect(second.candidates[0].id).not.toBe(first.candidates[0].id);
  });

  it("金額が異なればsourceHashも変わる", async () => {
    const base = await parseEmail(smbcEmail);
    const changed = await parseEmail(smbcEmail.replace("618円", "619円"));
    expect(changed.candidates[0].sourceHash).not.toBe(base.candidates[0].sourceHash);
  });

  it("Gmailラベル形式（◇利用日など）の通知を解析する", async () => {
    const result = await parseEmail(`
ぶる　様

いつも三井住友カードをご利用頂きありがとうございます。
お客様のカードご利用内容をお知らせいたします。

ご利用カード：Ｏｌｉｖｅ／クレジット

◇利用日：2026/07/09 10:30
◇利用先：ローソン
◇利用取引：買物
◇利用金額：441円

本メールはカードご利用の承認照会に基づく通知であり、カードのご利用及びご請求を確定するものではございません。
`, { sourceType: "gmail_api", externalMessageId: "19f44805a13d5db2" });
    expect(result.provider).toBe("smbc");
    expect(result.warnings).toEqual([]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      occurredOn: "2026-07-09",
      occurredTime: "10:30",
      amount: 441,
      merchantName: "ローソン",
      serviceName: "三井住友カード",
      provider: "smbc",
      sourceType: "gmail_api",
      externalMessageId: "19f44805a13d5db2",
    });
  });

  it("externalMessageIdを候補に引き継ぐ", async () => {
    const result = await parseEmail(smbcEmail, { sourceType: "gmail_api", externalMessageId: "gmail-msg-1" });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].sourceType).toBe("gmail_api");
    expect(result.candidates[0].externalMessageId).toBe("gmail-msg-1");
  });

  it("複数候補では2件目以降のexternalMessageIdにブロック番号を付ける", async () => {
    const result = await parseEmail(`
三井住友カードのご利用通知

ご利用日時：2026/07/08 12:34
セブン-イレブン 618円

ご利用日時：2026/07/09 09:15
スターバックス 1,550円
`, { sourceType: "gmail_api", externalMessageId: "gmail-msg-2" });
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0].externalMessageId).toBe("gmail-msg-2");
    expect(result.candidates[1].externalMessageId).toBe("gmail-msg-2#1");
  });

  it("externalMessageIdを渡さなければ候補に付かない", async () => {
    const result = await parseEmail(smbcEmail);
    expect(result.candidates[0].externalMessageId).toBeUndefined();
  });

  it("汎用メールでは利用先ラベルの汎用語を店名にしない", async () => {
    const result = await parseEmail(`
クレジットカードのお知らせ
利用日：2026/07/08
ご利用先：カード利用
金額：2,000円
`);
    expect(result.provider).toBe("unknown");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].amount).toBe(2000);
    expect(result.candidates[0].merchantName).toBe("");
  });
});
