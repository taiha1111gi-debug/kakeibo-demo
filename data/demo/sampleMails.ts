// 公開デモ用のサンプルカード利用通知。
// 実在の取引ではなく、三井住友カードの通知メールと同じ文面形式で作成した架空データ。
// パーサーテストと取込画面の両方がこのデータを参照する（フェーズ2で内容を追加）。
export type SampleMail = {
  id: string;
  bodyText: string;
};

export const SAMPLE_MAILS: SampleMail[] = [];
