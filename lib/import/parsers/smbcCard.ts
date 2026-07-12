import type { EmailParser, ParsedEmailItem } from "@/lib/import/types";
import { cleanMerchant, excerpt, extractAmount, extractMerchant, normalizeEmailText } from "@/lib/import/parsers/shared";

// 対応形式1（貼り付けで多い形式）: 「ご利用日時：2026/07/03 20:03」＋次行「店名（買物） 620円」
// 対応形式2（Gmail APIで多いラベル形式）: 「◇利用日：2026/07/09 10:30」＋「◇利用先：」「◇利用金額：」の行
const dateTimePattern = /(?:◇\s*)?(?:ご)?利用日(?:時)?\s*[:：]?\s*(20\d{2})[\/.\-年]\s*(\d{1,2})[\/.\-月]\s*(\d{1,2})日?(?:\s+(\d{1,2}):(\d{2}))?/i;
const amountAtEndPattern = /^(.*?)\s+(?:[￥¥]\s*([0-9][0-9,，]*)|([0-9][0-9,，]*)\s*円)\s*$/;
const labeledAmountLinePattern = /^[◇\s]*(?:ご)?(?:利用金額|利用額|金額)\s*[:：]?/i;
const labeledFieldLinePattern = /^[◇\s]*(?:ご)?利用(?:先|取引|店名|店舗|者|カード)\s*[:：]/i;

const parseBlock = (lines: string[], startIndex: number, endIndex: number): ParsedEmailItem | null => {
  const dateTime = lines[startIndex].match(dateTimePattern);
  if (!dateTime) return null;

  const blockLines = lines.slice(startIndex, endIndex).filter(Boolean);
  const rawBlockText = blockLines.join("\n");
  const purchaseLineIndex = blockLines.findIndex((line, index) => index > 0 &&
    amountAtEndPattern.test(line) && !labeledAmountLinePattern.test(line) && !labeledFieldLinePattern.test(line),
  );
  const purchaseLine = purchaseLineIndex >= 0 ? blockLines[purchaseLineIndex] : undefined;
  const purchase = purchaseLine?.match(amountAtEndPattern);
  const purchaseAmount = purchase ? Number((purchase[2] ?? purchase[3]).replace(/[,，]/g, "")) : 0;
  const amount = purchaseAmount || extractAmount(rawBlockText);
  if (!amount) return null;
  const labeledAmountIndex = blockLines.findIndex((line) => labeledAmountLinePattern.test(line));
  const relevantEndIndex = Math.max(purchaseLineIndex, labeledAmountIndex, 1);
  const sourceText = blockLines.slice(0, relevantEndIndex + 1).join("\n");

  return {
    occurredOn: `${dateTime[1]}-${dateTime[2].padStart(2, "0")}-${dateTime[3].padStart(2, "0")}`,
    occurredTime: dateTime[4] ? `${dateTime[4].padStart(2, "0")}:${dateTime[5]}` : "12:00",
    amount,
    merchantName: purchase ? cleanMerchant(purchase[1]) : extractMerchant(rawBlockText),
    serviceName: "三井住友カード",
    memo: excerpt(sourceText),
    sourceText,
  };
};

export const smbcCardParser: EmailParser = {
  provider: "smbc",
  matches: (text) => /三井住友|Vpass|Olive/i.test(text),
  parse: (rawText) => {
    const text = normalizeEmailText(rawText);
    const lines = text.split("\n").map((line) => line.trim());
    const dateIndexes = lines.flatMap((line, index) => dateTimePattern.test(line) ? [index] : []);

    return dateIndexes.flatMap((startIndex, index) => {
      const endIndex = dateIndexes[index + 1] ?? lines.length;
      const parsed = parseBlock(lines, startIndex, endIndex);
      return parsed ? [parsed] : [];
    });
  },
};
