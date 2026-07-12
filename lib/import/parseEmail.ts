import { excerpt, extractAmount, extractDate, extractMerchant, normalizeEmailForHash, normalizeEmailText } from "@/lib/import/parsers/shared";
import { smbcCardParser } from "@/lib/import/parsers/smbcCard";
import type { EmailParser, ImportProvider, ImportSourceType, ParseEmailResult, ParsedEmailItem } from "@/lib/import/types";

const parsers: EmailParser[] = [smbcCardParser];
const cancellationPattern = /利用取消|取消|キャンセル|返金|返品/;

const createHash = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const genericParse = (text: string): ParsedEmailItem[] => {
  const amount = extractAmount(text);
  const occurredOn = extractDate(text);
  if (!amount || !occurredOn) return [];
  return [{
    occurredOn,
    occurredTime: "12:00",
    amount,
    merchantName: extractMerchant(text),
    serviceName: "カード利用通知",
    memo: excerpt(text),
    sourceText: text,
  }];
};

export async function parseEmail(
  rawEmailText: string,
  options: { providerHint?: ImportProvider; sourceType?: ImportSourceType; externalMessageId?: string } = {},
): Promise<ParseEmailResult> {
  const text = normalizeEmailText(rawEmailText);
  const hashSource = normalizeEmailForHash(rawEmailText);
  if (!text) return { candidates: [], warnings: ["メール本文を入力してください。"], provider: "unknown" };
  if (cancellationPattern.test(text)) {
    return {
      candidates: [],
      warnings: ["返金・取消の可能性がある通知です。自動登録せず、必要な場合は手入力してください。"],
      provider: options.providerHint ?? "unknown",
    };
  }

  const hinted = options.providerHint && options.providerHint !== "unknown"
    ? parsers.find((parser) => parser.provider === options.providerHint)
    : undefined;
  const parser = hinted ?? parsers.find((candidate) => candidate.matches(text));
  const provider: ImportProvider = parser?.provider ?? "unknown";
  const items = parser?.parse(text) ?? genericParse(text);
  const sourceType = options.sourceType ?? "email_paste";
  // 1メールから複数候補が出た場合も、2件目以降が external_message_id の一意制約に
  // 衝突しないよう、ブロック番号つきの安定したidを割り当てる。
  const blockMessageId = (index: number) => options.externalMessageId
    ? (index === 0 ? options.externalMessageId : `${options.externalMessageId}#${index}`)
    : undefined;
  const candidates = await Promise.all(items.map(async (item, index) => ({
    ...item,
    id: crypto.randomUUID(),
    provider,
    sourceType,
    externalMessageId: blockMessageId(index),
    sourceHash: await createHash(normalizeEmailForHash(item.sourceText || hashSource)),
  })));

  return {
    candidates,
    provider,
    warnings: candidates.length ? [] : ["利用日または金額を読み取れませんでした。本文を確認してください。"],
  };
}
