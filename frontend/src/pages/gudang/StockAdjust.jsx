import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageBanner, Card, StatusBadge } from "@/components/common/ui";
import { api, errMsg } from "@/lib/api";
import { wib } from "@/lib/fmt";

const TYPES = ["Stok Masuk (+)", "Return Masuk (+)", "Barang Keluar (-)", "Barang Rusak (-)"];

export default function StockAdjust() {
  const [products, setProducts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [f, setF] = useState({ sku: "", tipe: TYPES[0], qty: "", catatan: "" });
  const load = useCallback(() => {
    api.get("/products").then((r) => setProducts(r.data));
    api.get("/stock-adjustments").then((r) => setLogs(r.data));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/stock-adjustments", { ...f, qty: Number(f.qty) });
      toast.success(`Stok ${data.product.sku} sekarang ${data.product.stok_riil} (${data.product.status_stok})`);
      setF({ ...f, qty: "", catatan: "" });
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  const sel = products.find((p) => p.sku === f.sku);

  return (
    <div data-testid="stock-adjust-page">
      <PageBanner icon={SlidersHorizontal} title="Penyesuaian Stok" subtitle="Data Internal · Opname, barang masuk, keluar, rusak dengan jejak audit" />
      <div className="p-3 sm:p-5 grid lg:grid-cols-[360px_1fr] gap-4">
        <Card className="p-4 h-fit">
          <form onSubmit={submit} className="space-y-3" data-testid="stock-adjust-form">
            <div className="space-y-1"><Label className="text-xs">SKU Produk</Label>
              <Select value={f.sku || undefined} onValueChange={(v) => setF({ ...f, sku: v })}>
                <SelectTrigger data-testid="adjust-sku-select"><SelectValue placeholder="Pilih SKU" /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.sku} value={p.sku}>{p.sku} · {p.nama}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {sel && <p className="text-xs rounded-md bg-muted p-2">Stok riil saat ini: <b>{sel.stok_riil}</b> · Min: {sel.min_stock} · <StatusBadge value={sel.status_stok} /></p>}
            <div className="space-y-1"><Label className="text-xs">Tipe Mutasi</Label>
              <Select value={f.tipe} onValueChange={(v) => setF({ ...f, tipe: v })}>
                <SelectTrigger data-testid="adjust-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Qty</Label><Input type="number" min="1" required value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} data-testid="adjust-qty-input" /></div>
            <div className="space-y-1"><Label className="text-xs">Catatan / Alasan</Label><Input value={f.catatan} onChange={(e) => setF({ ...f, catatan: e.target.value })} data-testid="adjust-note-input" /></div>
            <Button type="submit" className="w-full" disabled={!f.sku || !f.qty} data-testid="adjust-submit-button">Simpan Penyesuaian</Button>
          </form>
        </Card>
        <Card>
          <p className="p-4 font-bold border-b">Log Mutasi Stok</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="adjust-log-table">
              <thead><tr className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">{["Tanggal & Waktu", "SKU", "Nama", "Tipe", "Qty", "Catatan", "Operator"].map((h) => <th key={h} className="px-3 py-3 text-left">{h}</th>)}</tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b">
                    <td className="px-3 py-2 whitespace-nowrap">{wib(l.created_at).tanggal} {wib(l.created_at).waktu}</td>
                    <td className="px-3 py-2 font-mono">{l.sku}</td><td className="px-3 py-2">{l.nama}</td>
                    <td className={`px-3 py-2 font-semibold ${l.tipe.includes("+") ? "text-emerald-600" : "text-red-600"}`}>{l.tipe}</td>
                    <td className="px-3 py-2 tabular-nums">{l.qty}</td><td className="px-3 py-2">{l.catatan}</td><td className="px-3 py-2">{l.operator}</td>
                  </tr>
                ))}
                {logs.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">Belum ada mutasi</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
