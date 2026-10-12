import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, X, RefreshCw, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { StatusBadge, ImportButton, Card } from "@/components/common/ui";
import { AKUN, TINDAKAN } from "@/components/shipping/ScannerPanel";
import { api, errMsg, downloadFile } from "@/lib/api";
import { wib } from "@/lib/fmt";
import { useAuth } from "@/context/AuthContext";

const RTS = ["RTS PROCESSING", "RTS - DIKEMBALIKAN", "RTS DITERIMA GUDANG"];
const EXPEDISI = ["AnterAja", "SICEPAT", "JNE", "JNE YES", "SPX", "POS REG", "INSTANT", "SAMEDAY", "SICEPAT HALU", "J&T", "ID Express", "Lainnya"];

function InlineSelect({ value, options, onChange, testId, width = "w-20" }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className={`h-7 text-xs ${width}`} data-testid={testId}><SelectValue placeholder="-" /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function Row({ r, i, submenu, onPatch, onDelete }) {
  const t = wib(r.created_at);
  return (
    <tr className="border-b last:border-0 hover:bg-muted/40 even:bg-muted/20" data-testid={`package-row-${r.no_resi}`}>
      <td className="px-3 py-2 text-center text-muted-foreground">{i}</td>
      <td className="px-3 py-2 font-mono font-semibold whitespace-nowrap">{r.no_resi}{r.is_duplicate && <span className="ml-1 text-red-600">×{r.duplicate_count + 1}</span>}</td>
      <td className="px-3 py-2 whitespace-nowrap">{r.expedisi}</td>
      <td className="px-3 py-2"><StatusBadge value={r.marketplace} /></td>
      <td className="px-3 py-2"><InlineSelect value={r.akun} options={AKUN} onChange={(v) => onPatch(r, { akun: v })} testId={`akun-select-${r.no_resi}`} /></td>
      <td className="px-3 py-2"><StatusBadge value={r.keterangan} /></td>
      <td className="px-3 py-2">
        {submenu === "rts" ? <InlineSelect value={r.status} options={RTS} width="w-44" onChange={(v) => onPatch(r, { status: v })} testId={`rts-status-select-${r.no_resi}`} />
          : <StatusBadge value={r.status} testId={`status-${r.no_resi}`} />}
      </td>
      <td className="px-3 py-2">
        {submenu === "cancel" ? <InlineSelect value={r.tindakan} options={TINDAKAN} width="w-48" onChange={(v) => onPatch(r, { tindakan: v })} testId={`tindakan-select-${r.no_resi}`} />
          : <StatusBadge value={r.warning} testId={`warning-${r.no_resi}`} />}
      </td>
      <td className="px-3 py-2"><StatusBadge value={r.drop_off} /></td>
      <td className="px-3 py-2 whitespace-nowrap">{t.hari}</td>
      <td className="px-3 py-2 whitespace-nowrap">{t.tanggal}</td>
      <td className="px-3 py-2 font-mono whitespace-nowrap">{t.waktu}</td>
      <td className="px-3 py-2 text-center">
        <button onClick={() => onDelete(r)} className="text-red-500 hover:text-red-700" data-testid={`delete-package-${r.no_resi}`}><Trash2 className="h-4 w-4" /></button>
      </td>
    </tr>
  );
}

export default function PackageTable({ submenu, start, end, refreshKey, onChanged, title }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [exp, setExp] = useState("all");
  const [size, setSize] = useState("10");
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    api.get("/shipping/packages", { params: { submenu, q, expedisi: exp === "all" ? "" : exp, start, end } })
      .then((r) => setRows(r.data)).catch((e) => toast.error(errMsg(e)));
  }, [submenu, q, exp, start, end]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);
  useEffect(() => {
    setPage(1);
  }, [submenu, q, exp, size]);

  const patch = async (r, body) => {
    try {
      await api.patch(`/shipping/packages/${r.id}`, body);
      toast.success("Data diperbarui");
      load();
      onChanged?.();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const del = async (r) => {
    await api.delete(`/shipping/packages/${r.id}`);
    load();
    onChanged?.();
  };
  const clearAll = async () => {
    try {
      const { data } = await api.delete("/shipping/packages", { params: { submenu } });
      toast.success(`${data.deleted} data dihapus`);
      load();
      onChanged?.();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const per = Number(size);
  const pages = Math.max(1, Math.ceil(rows.length / per));
  const shown = useMemo(() => rows.slice((page - 1) * per, page * per), [rows, page, per]);
  const scanSub = submenu !== "beresiko";

  return (
    <Card data-testid="package-table-card">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 p-4 border-b">
        <div>
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">Total {rows.length} data pada rentang tanggal terpilih</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={size} onValueChange={setSize}>
            <SelectTrigger className="w-20 h-9" data-testid="table-page-size"><SelectValue /></SelectTrigger>
            <SelectContent>{["10", "25", "50", "100"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex items-center rounded-md border h-9 px-2 bg-background">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari No. Resi..." className="bg-transparent px-2 text-sm outline-none w-36" data-testid="table-search-input" />
            {q && <button onClick={() => setQ("")}><X className="h-4 w-4 text-muted-foreground" /></button>}
          </div>
          <Select value={exp} onValueChange={setExp}>
            <SelectTrigger className="w-36 h-9" data-testid="table-expedisi-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Expedisi: Semua</SelectItem>
              {EXPEDISI.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={load} data-testid="table-refresh-button"><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => downloadFile(`/shipping/export?submenu=${submenu}&start=${start}&end=${end}`, `pengiriman_${submenu}.csv`)} data-testid="table-export-button"><Download className="h-4 w-4 mr-1" /> Export</Button>
          {scanSub && <ImportButton endpoint={`/shipping/import?submenu=${submenu}`} onDone={() => { load(); onChanged?.(); }} testId="table-import-button" label="Import" />}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" data-testid="package-table">
          <thead>
            <tr className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
              {["No", "Resi Pesanan", "Expedisi", "Marketplace", "Akun", "Keterangan", "Status Pesanan", submenu === "cancel" ? "Tindakan" : "Warning", "Drop Off", "Hari", "Tanggal", "Waktu", "Actions"].map((h) => (
                <th key={h} className="px-3 py-3 font-bold text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, idx) => <Row key={r.id} r={r} i={(page - 1) * per + idx + 1} submenu={submenu} onPatch={patch} onDelete={del} />)}
            {shown.length === 0 && <tr><td colSpan={13} className="text-center py-10 text-muted-foreground">Belum ada data</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-t text-xs">
        <span className="font-semibold" data-testid="table-total">Total: {rows.length} · Halaman {page}/{pages}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} data-testid="table-prev">Sebelumnya</Button>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)} data-testid="table-next">Berikutnya</Button>
          {user?.role === "admin" && scanSub && (
            <AlertDialog>
              <AlertDialogTrigger asChild><Button size="sm" variant="destructive" data-testid="table-clear-all-button"><Trash2 className="h-4 w-4 mr-1" /> Clear All Data</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Hapus semua data submenu ini?</AlertDialogTitle>
                  <AlertDialogDescription>Semua data pada submenu "{submenu}" akan dihapus permanen.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAll} data-testid="confirm-clear-all">Hapus</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </Card>
  );
}
