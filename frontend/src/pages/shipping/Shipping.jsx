import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LayoutDashboard, ScanBarcode, Truck, AlertTriangle, Undo2, XCircle, FileBarChart, Package, CalendarDays, History, ChevronDown, ChevronUp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PageBanner, KpiCard, StatusBadge, Card } from "@/components/common/ui";
import ScannerPanel from "@/components/shipping/ScannerPanel";
import PackageTable from "@/components/shipping/PackageTable";
import ShippingReport from "@/components/shipping/ShippingReport";
import { api } from "@/lib/api";
import { todayWIB, wib } from "@/lib/fmt";

const TABS = {
  dashboard: { label: "Dashboard", icon: LayoutDashboard, title: "Dashboard Pengiriman", sub: "Ringkasan operasional paket" },
  process: { label: "Process Pesanan", icon: ScanBarcode, title: "Scan Process Pesanan", sub: "Order Processing & Barcode Scanner System" },
  pengiriman: { label: "Pengiriman Paket", icon: Truck, title: "Scan Pengiriman Paket", sub: "Resi wajib sudah di-scan di Process Pesanan" },
  beresiko: { label: "Beresiko Terlambat", icon: AlertTriangle, title: "Beresiko Terlambat", sub: "≥24 jam: SEGERA KIRIMKAN · ≥48 jam: BESOK BATAL" },
  rts: { label: "Returan RTS", icon: Undo2, title: "Returan Pembeli RTS", sub: "Scan paket retur / RTS masuk gudang" },
  cancel: { label: "Cancel Order", icon: XCircle, title: "Cancel Order", sub: "Pengajuan, penarikan & penerimaan pembatalan" },
  laporan: { label: "Laporan", icon: FileBarChart, title: "Laporan Pengiriman", sub: "Rekap per expedisi, marketplace & akun" },
};
const QUICK = [["Hari Ini", 0], ["7 Hari", 6], ["30 Hari", 29]];

function DateFilter({ start, end, onChange }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 text-xs font-semibold whitespace-nowrap" data-testid="date-filter-button">
          <CalendarDays className="h-4 w-4" /> Filter Tanggal
          <span className="rounded-full bg-slate-800 text-white px-2 py-0.5 text-[10px]">{start.slice(5)} → {end.slice(5)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3" data-testid="date-filter-panel">
        <div className="flex gap-2">{QUICK.map(([l, d]) => <button key={l} className="flex-1 rounded-md bg-secondary py-1.5 text-xs font-semibold hover:bg-accent" onClick={() => onChange(todayWIB(-d), todayWIB())} data-testid={`date-quick-${d}`}>{l}</button>)}</div>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={start} onChange={(e) => onChange(e.target.value, end)} className="h-9 rounded-md border bg-background px-2 text-xs" data-testid="date-start-input" />
          <input type="date" value={end} onChange={(e) => onChange(start, e.target.value)} className="h-9 rounded-md border bg-background px-2 text-xs" data-testid="date-end-input" />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function KpiRow({ kpi }) {
  const c = kpi?.current || {};
  const y = kpi?.kemarin || {};
  const cards = [
    ["diproses", "Pesanan Di Process", Package, "#7c3aed"], ["beresiko", "Beresiko Terlambat", AlertTriangle, "#f97316"],
    ["cancel", "Cancel Order", XCircle, "#ef4444"], ["terkirim", "Pesanan Terkirim", Truck, "#10b981"],
    ["perlu_dikirim", "Perlu Dikirimkan", Package, "#e11d48"],
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {cards.map(([k, l, I, col]) => <KpiCard key={k} icon={I} label={l} value={c[k]} yesterday={y[k]} color={col} testId={`kpi-${k}`} />)}
    </div>
  );
}

function RecentScans({ items }) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="border-t-4 border-t-indigo-500" data-testid="recent-scans">
      <button className="w-full flex items-center justify-between p-4" onClick={() => setOpen(!open)} data-testid="recent-scans-toggle">
        <span className="flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-300"><History className="h-4 w-4" /> Riwayat Scan Terbaru <span className="rounded bg-indigo-600 text-white text-[10px] px-1.5 py-0.5">Live Updates</span>{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
        <span className="rounded-full bg-slate-800 text-white text-[11px] px-3 py-1">{items.length} scans</span>
      </button>
      {open && items.length > 0 && (
        <div className="px-4 pb-4 flex flex-wrap gap-2">
          {items.slice(0, 8).map((r) => (
            <div key={r.id} className="scan-flash rounded-lg border px-3 py-2 text-xs" data-testid={`recent-scan-${r.no_resi}`}>
              <p className="font-mono font-bold">{r.no_resi}</p>
              <p className="text-muted-foreground">{r.expedisi} · {wib(r.created_at).waktu}</p>
              <div className="mt-1"><StatusBadge value={r.status} /></div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function Shipping() {
  const [params, setParams] = useSearchParams();
  const tab = TABS[params.get("tab")] ? params.get("tab") : "process";
  const [range, setRange] = useState({ start: todayWIB(-6), end: todayWIB() });
  const [kpi, setKpi] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [recent, setRecent] = useState([]);
  const T = TABS[tab];

  const loadKpi = useCallback(() => {
    api.get("/shipping/kpi", { params: range }).then((r) => setKpi(r.data));
  }, [range]);
  useEffect(() => {
    loadKpi();
  }, [loadKpi, refreshKey]);
  useEffect(() => {
    setRecent([]);
  }, [tab]);

  const onScanned = useCallback((rec) => {
    setRecent((r) => [rec, ...r]);
    setRefreshKey((k) => k + 1);
  }, []);
  const changed = useCallback(() => setRefreshKey((k) => k + 1), []);
  const scanTab = ["process", "pengiriman", "cancel", "rts"].includes(tab);

  return (
    <div data-testid={`shipping-page-${tab}`}>
      <PageBanner icon={T.icon} title={T.title} subtitle={T.sub} right={<span className="hidden sm:flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold"><span className="h-2 w-2 rounded-full bg-emerald-400 pulse-dot" />SCANNER READY</span>} />
      <div className="sticky top-14 z-30 bg-card border-b flex items-center gap-1 px-2 sm:px-4 overflow-x-auto no-scrollbar">
        {Object.entries(TABS).map(([k, v]) => (
          <button key={k} onClick={() => setParams({ tab: k })} data-testid={`shipping-tab-${k}`} className={`flex items-center gap-1.5 px-3 py-3 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === k ? "border-indigo-600 text-indigo-600 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-500/10" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <v.icon className="h-4 w-4" />{v.label}
          </button>
        ))}
        <div className="ml-auto pl-3"><DateFilter start={range.start} end={range.end} onChange={(start, end) => setRange({ start, end })} /></div>
      </div>
      <div className="p-3 sm:p-5 space-y-4">
        <KpiRow kpi={kpi} />
        {scanTab && <ScannerPanel submenu={tab} onScanned={onScanned} />}
        {scanTab && <RecentScans items={recent} />}
        {(scanTab || tab === "beresiko") && <PackageTable submenu={tab} title={T.title} start={range.start} end={range.end} refreshKey={refreshKey} onChanged={changed} />}
        {(tab === "dashboard" || tab === "laporan") && <ShippingReport start={range.start} end={range.end} refreshKey={refreshKey} full={tab === "laporan"} />}
      </div>
    </div>
  );
}
