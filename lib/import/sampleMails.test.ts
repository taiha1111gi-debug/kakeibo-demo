import { describe, expect, it } from "vitest";
import { SAMPLE_MAILS } from "@/data/demo/sampleMails";
import { parseEmail } from "@/lib/import/parseEmail";

// デモ取込画面が読むサンプルメールが、本番と同じパーサーで
// 意図どおり解析できることを固定する（サンプルとパーサーの乖離防止）。
describe("デモ用サンプルメール", () => {
  it("6通あり、メールIDが一意", () => {
    expect(SAMPLE_MAILS).toHaveLength(6);
    expect(new Set(SAMPLE_MAILS.map((mail) => mail.id)).size).toBe(SAMPLE_MAILS.length);
  });

  it("お知らせメール1通を除いてすべて解析でき、計6件の候補になる", async () => {
    const results = await Promise.all(SAMPLE_MAILS.map((mail) =>
      parseEmail(mail.bodyText, { sourceType: "gmail_api", externalMessageId: mail.id }),
    ));
    const unparsed = results.filter((result) => result.candidates.length === 0);
    expect(unparsed).toHaveLength(1);
    const candidates = results.flatMap((result) => result.candidates);
    expect(candidates).toHaveLength(6);
    for (const candidate of candidates) {
      expect(candidate.provider).toBe("smbc");
      expect(candidate.amount).toBeGreaterThan(0);
      expect(candidate.occurredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(candidate.merchantName).not.toBe("");
      expect(candidate.sourceHash).toMatch(/^[0-9a-f]{64}$/);
    }
    // 1メール複数利用分も含めて、externalMessageIdが衝突しない
    const messageIds = candidates.map((candidate) => candidate.externalMessageId);
    expect(new Set(messageIds).size).toBe(messageIds.length);
  });
});
