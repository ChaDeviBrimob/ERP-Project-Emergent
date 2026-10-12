import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ShoppingBag, Search, Truck, RefreshCw, Printer, Settings2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import PrintSettingsDialog from "@/components/print/PrintSettingsDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageBanner, Card, StatusBadge } from "@/components/common/ui";
import { DemoNotice } from "@/pages/mp/Stores";
import { api, errMsg } from "@/lib/api";
import { rupiah, wib } from "@/lib/fmt";

const STATUS = ["Belum Bayar", "Perlu Dikirim", "Dikirim", "Selesai", "Dibatalkan"];

export function StoreFilter({ value, onChange }) {
  const [stores, setStores] = useState([]);
  useEffect(() => {
    api.get("/mp/stores").then((r) => setStores(r.data));
  }, []);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-52 h-9" data-testid="store-filter"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Semua Toko</SelectItem>
        {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.marketplace} · {s.nama_toko}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export default function Orders() {
  const [rows, setRows] = useState([]);
  const [store, setStore] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const printIds = (ids) => {
    if (!ids.length) return toast.error("Pilih pesanan dulu");
    window.open(`/cetak-resi?ids=${ids.join(",")}&auto=1`, "_blank");
    setTimeout(load, 1500);
  };
  const toggleSel = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const load = useCallback(() => {
    api.get("/mp/orders", { params: { store_id: store === "all" ? "" : store, status: status === "all" ? "" : status, q } }).then((r) => setRows(r.data));
  }, [store, status, q]);
  useEffect(() => {
    load();
  }, [load]);

  const ship = async (o) => {
    try {
      const { data } = await api.post(`/mp/orders/${o.id}/ship`);
      toast.success(`Resi dibuat: ${data.resi}`);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const setSt = async (o, s) => {
    await api.patch(`/mp/orders/${o.id}/status`, { status: s });
    load();
  };

  return (
    <div data-testid="orders-page">
      <PageBanner icon={ShoppingBag} title="Pesanan Marketplace" subtitle="Marketplace Online · Semua pesanan dari semua toko dalam satu tabel" />
      <div className="p-3 sm:p-5 space-y-4">
        <DemoNotice />
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {["all", ...STATUS].map((s) => (
            <button key={s} onClick={() => setStatus(s)} data-testid={`order-status-tab-${s}`} className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border ${status === s ? "bg-indigo-600 text-white border-indigo-600" : "bg-card"}`}>{s === "all" ? "Semua" : s}</button>
          ))}
        </div>
        <Card>
          <div className="flex flex-wrap items-center gap-2 p-4 border-b">
            <StoreFilter value={store} onChange={setStore} />
            <div className="flex items-center rounded-md border h-9 px-2 bg-background">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="No. pesanan / pembeli / resi" className="bg-transparent px-2 text-sm outline-none w-52" data-testid="order-search-input" />
            </div>
            <Button variant="ghost" size="sm" onClick={load} data-testid="order-refresh-button"><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)} data-testid="print-settings-button"><Settings2 className="h-4 w-4 mr-1" /> Pengaturan Cetak</Button>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" disabled={!sel.length} onClick={() => printIds(sel)} data-testid="print-selected-button"><Printer className="h-4 w-4 mr-1" /> Cetak Resi ({sel.length})</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="orders-table">
              <thead><tr className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground"><th className="px-3 py-3"><Checkbox checked={rows.length > 0 && sel.length === rows.length} onCheckedChange={(v) => setSel(v ? rows.map((r) => r.id) : [])} data-testid="order-select-all" /></th>{["No. Pesanan", "Toko", "Pembeli", "Produk", "Total", "Status", "Resi", "Dicetak", "Waktu", "Aksi"].map((h) => <th key={h} className="px-3 py-3 text-left whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} className="border-b hover:bg-muted/40" data-testid={`order-row-${o.order_no}`}>
                    <td className="px-3 py-2"><Checkbox checked={sel.includes(o.id)} onCheckedChange={() => toggleSel(o.id)} data-testid={`order-select-${o.order_no}`} /></td>
                    <td className="px-3 py-2 font-mono font-semibold">{o.order_no}</td>
                    <td className="px-3 py-2 whitespace-nowrap"><StatusBadge value={o.marketplace} /> <span className="ml-1">{o.nama_toko}</span></td>
                    <td className="px-3 py-2">{o.buyer}</td>
                    <td className="px-3 py-2 min-w-[180px]">{o.items.map((i) => `${i.nama} ×${i.qty}`).join(", ")}</td>
                    <td className="px-3 py-2 font-semibold whitespace-nowrap">{rupiah(o.total)}</td>
                    <td className="px-3 py-2"><StatusBadge value={o.status} testId={`order-status-${o.order_no}`} /></td>
                    <td className="px-3 py-2 font-mono">{o.resi || "-"}</td>
                    <td className="px-3 py-2" data-testid={`order-print-count-${o.order_no}`}>{o.print_count ? `${o.print_count}x` : "-"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{wib(o.created_at).tanggal}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {["Perlu Dikirim", "Dikirim", "Selesai"].includes(o.status) && <Button size="sm" variant="outline" className="h-7 mr-1" onClick={() => printIds([o.id])} data-testid={`order-print-${o.order_no}`}><Printer className="h-3.5 w-3.5" /></Button>}
                      {o.status === "Perlu Dikirim" ? (
                        <Button size="sm" className="h-7 bg-emerald-500 hover:bg-emerald-600" onClick={() => ship(o)} data-testid={`order-ship-${o.order_no}`}><Truck className="h-3.5 w-3.5 mr-1" /> Atur Kirim</Button>
                      ) : o.status === "Dikirim" ? (
                        <Button size="sm" variant="outline" className="h-7" onClick={() => setSt(o, "Selesai")} data-testid={`order-done-${o.order_no}`}>Selesai</Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={11} className="py-10 text-center text-muted-foreground">Tidak ada pesanan</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <PrintSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
