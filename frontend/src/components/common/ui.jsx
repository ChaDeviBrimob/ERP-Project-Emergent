import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, errMsg } from "@/lib/api";
import { tone } from "@/lib/fmt";

export function StatusBadge({ value, testId }) {
  if (!value) return <span className="text-muted-foreground">-</span>;
  return <span className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-bold ${tone(value)}`} data-testid={testId}>{value}</span>;
}

export function PageBanner({ icon: Icon, title, subtitle, right }) {
  return (
    <div className="banner-gradient text-white px-4 sm:px-6 py-5 flex items-center gap-4 relative overflow-hidden" data-testid="page-banner">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
      {Icon && <div className="h-11 w-11 rounded-xl bg-white/15 grid place-items-center shrink-0"><Icon className="h-5 w-5" /></div>}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate" data-testid="page-title">{title}</h1>
        {subtitle && <p className="text-sm text-white/80 truncate">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function KpiCard({ icon: Icon, label, value, yesterday, color, testId }) {
  const diff = yesterday ? (((value - yesterday) / yesterday) * 100).toFixed(1) : "0.0";
  return (
    <div className="rounded-xl bg-card border shadow-sm p-4 border-t-4 fade-up" style={{ borderTopColor: color }} data-testid={testId}>
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-full grid place-items-center text-white shrink-0" style={{ background: color }}><Icon className="h-5 w-5" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-2xl font-extrabold tabular-nums" data-testid={`${testId}-value`}>{value ?? 0}</p>
            <p className="text-xs font-bold text-right" style={{ color }}>{label}</p>
          </div>
          {yesterday !== undefined && (
            <div className="flex items-center justify-between mt-1 text-[11px] text-muted-foreground">
              <span>Kemarin: {yesterday}</span>
              <span className="rounded bg-muted px-1.5 py-0.5">→ {diff}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ImportButton({ endpoint, onDone, testId, label = "Import CSV/Excel" }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const upload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", f);
    try {
      const { data } = await api.post(endpoint, fd);
      toast.success(`Import selesai: ${JSON.stringify(data).slice(0, 120)}`);
      onDone?.();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };
  return (
    <>
      <input ref={ref} type="file" accept=".csv,.xlsx" hidden onChange={upload} data-testid={`${testId}-file`} />
      <Button variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={busy} data-testid={testId}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />} {label}
      </Button>
    </>
  );
}

export function Card({ children, className = "", ...p }) {
  return <div className={`rounded-xl bg-card border shadow-sm ${className}`} {...p}>{children}</div>;
}

export function Empty({ text = "Belum ada data" }) {
  return <p className="text-center text-sm text-muted-foreground py-10">{text}</p>;
}
