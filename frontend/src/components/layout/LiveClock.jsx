import { useEffect, useState } from "react";

export default function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta" }).replace(/\./g, ":");
  const date = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  return (
    <div className="hidden xl:flex items-center gap-2">
      <span className="rounded-lg bg-white/10 px-3 py-1.5 font-mono text-sm font-semibold tabular-nums" data-testid="header-clock">{time} WIB</span>
      <span className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold" data-testid="header-date">{date}</span>
    </div>
  );
}
