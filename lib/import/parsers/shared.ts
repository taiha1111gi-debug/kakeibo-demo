const toHalfWidth = (value: string) => value.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (character) =>
  String.fromCharCode(character.charCodeAt(0) - 0xfee0),
);

export const normalizeEmailText = (text: string) => toHalfWidth(text)
  .replace(/\r\n?/g, "\n")
  .replace(/[\u00a0\u3000]/g, " ")
  .replace(/[ \t]+/g, " ")
  .replace(/ *\n */g, "\n")
  .trim();

export const normalizeEmailForHash = (text: string) => normalizeEmailText(text)
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .join("\n");

export const extractAmount = (text: string) => {
  const labeled = text.match(/(?:ご利用金額|利用金額|ご利用額|利用額|金額)\s*[：:]?\s*[￥¥]?\s*([0-9][0-9,，]*)\s*円?/i);
  const yen = text.match(/[￥¥]\s*([0-9][0-9,，]*)|([0-9][0-9,，]*)\s*円/);
  const value = labeled?.[1] ?? yen?.[1] ?? yen?.[2];
  return value ? Number(value.replace(/[,，]/g, "")) : 0;
};

export const extractDate = (text: string) => {
  const labeled = text.match(/(?:ご利用日(?:時)?|利用日(?:時)?)\s*[：:]?\s*(20\d{2})[\/.\-年]\s*(\d{1,2})[\/.\-月]\s*(\d{1,2})日?/i);
  const fallback = text.match(/(20\d{2})[\/.\-年]\s*(\d{1,2})[\/.\-月]\s*(\d{1,2})日?/);
  const match = labeled ?? fallback;
  if (!match) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
};

export const extractMerchant = (text: string) => {
  const match = text.match(/(?:ご利用先|利用先|ご利用店名|利用店名|加盟店名|ご利用店舗|店舗名)\s*[：:]?\s*([^\n]+)/i);
  const merchant = match?.[1]?.trim().replace(/\s{2,}.*/, "") ?? "";
  return cleanMerchant(merchant);
};

const isGenericMerchant = (value: string) => {
  const normalized = value.trim().replace(/[\s　・:：／/()（）\[\]「」『』]+/g, "");
  return /^(?:カード利用|ご利用|利用通知|ショッピング|お買物|決済)$/.test(normalized);
};

export const cleanMerchant = (value: string) => {
  const cleaned = normalizeEmailText(value)
    .replace(/\s*[（(](?:買物|ショッピング)[）)]\s*$/i, "")
    .trim();
  return isGenericMerchant(cleaned) ? "" : cleaned;
};

export const excerpt = (text: string) => normalizeEmailText(text).slice(0, 240);
