// 読み込み中にレイアウトの骨組みを見せるためのプリミティブ。
// 実データの高さに近い形を出すことで、表示時のガタつき（レイアウトシフト）も抑える。
export default function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}
