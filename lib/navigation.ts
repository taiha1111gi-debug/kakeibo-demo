const allowedReturnPaths = new Set([
  "/",
  "/reports",
  "/transactions",
  "/transactions/unclassified",
]);

export function getSafeReturnTo(value: string | null, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  const pathname = value.split(/[?#]/, 1)[0];
  return allowedReturnPaths.has(pathname) ? value : fallback;
}
