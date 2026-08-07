export function formatKr(ore: number): string {
  return `${Math.round(ore / 100).toLocaleString("sv-SE")} kr`;
}
