import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Package, Plus, Download, Pencil, Trash2, Search, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageBanner, StatusBadge, ImportButton, Card, KpiCard } from "@/components/common/ui";
import ProductDialog, { SHEET_KONDISI } from "@/pages/gudang/ProductDialog";
import { api, errMsg, downloadFile } from "@/lib/api";
import { rupiah } from "@/lib/fmt";
import { useAuth } from "@/context/AuthContext";

const STATUS = ["STOCK AMAN", "RESTOCK !!", "NEW STOCK", "STOCK BARANG SUSAH"];

export default function Products() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState(params.get("q") || "");
  const [status, setStatus] = useState("all");
  const [kondisi, setKondisi] = useState("all");
  const [dlg, setDlg] = useState({ open: false, product: null });

  useEffect(() => {
    setQ(params.get("q") || "");
  }, [params]);
  const load = useCallback(() => {
    api.get("/products", { params: { q, status: status === "all" ? "" : status, kondisi: kondisi === "all" ? "" : kondisi } })
      .then((r) => setRows(r.data)).catch((e) => toast.error(errMsg(e)));
  }, [q, status, kondisi]);
  useEffect(() => {
    load();
  }, [load]);

  const del = async (p) => {
    if (!window.confirm(`Hapus ${p.sku}?`)) return;
    try {
      await api.delete(`/products/${p.id}`);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const total = rows.reduce((a, p) => a + p.stok_riil, 0);
  const nilai = rows.reduce((a, p) => a + p.nilai_stok, 0);

  return (
    <div data-testid="products-page">
      <PageBanner icon={Package} title="Data Base Barang Gudang" subtitle="Data Internal · Master SKU, stok riil & kondisi barang" />
      <div className="p-3 sm:p-5 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={Package} label="Total SKU" value={rows.length} color="#4f46e5" testId="gudang-kpi-sku" />
          <KpiCard icon={Package} label="Total Stok Riil" value={total} color="#10b981" testId="gudang-kpi-stok" />
          <KpiCard icon={Package} label="Perlu Restock" value={rows.filter((p) => p.status_stok === "RESTOCK !!").length} color="#ef4444" testId="gudang-kpi-restock" />
          <Card className="p-4 border-t-4 border-t-amber-500"><p className="text-xs text-muted-foreground">Nilai Stok (HPP)</p><p className="text-lg font-extrabold" data-testid="gudang-kpi-nilai">{rupiah(nilai)}</p></Card>
        </div>
        <Card>
          <div className="flex flex-col lg:flex-row lg:items-center gap-2 p-4 border-b">
            <div className="flex items-center rounded-md border h-9 px-2 bg-background flex-1 max-w-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari SKU / nama / variant" className="bg-transparent px-2 text-sm outline-none w-full" data-testid="product-search-input" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44 h-9" data-testid="product-status-filter"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Status: Semua</SelectItem>{STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={kondisi} onValueChange={setKondisi}>
              <SelectTrigger className="w-44 h-9" data-testid="product-kondisi-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Kondisi: Semua</SelectItem>
                {SHEET_KONDISI.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 lg:ml-auto">
              <ImportButton endpoint="/products/import" onDone={load} testId="product-import-button" />
              <Button variant="outline" size="sm" onClick={() => downloadFile("/products/export", "data_gudang.csv")} data-testid="product-export-button"><Download className="h-4 w-4 mr-1" /> Export</Button>
              <Button size="sm" onClick={() => setDlg({ open: true, product: null })} data-testid="product-add-button"><Plus className="h-4 w-4 mr-1" /> Tambah</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="product-table">
              <thead>
                <tr className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {[
                    "Foto",
                    "Barcode / SKU",
                    "Nama Barang",
                    "Variant",
                    "Min",
                    "Awal",
                    "In",
                    "Return",
                    "Out",
                    "Stok Riil",
                    "Status Stok",
                    "To Do",
                    "Supplier",
                    "HPP",
                    "Harga Jual",
                    "Margin",
                    "Kondisi",
                    "",
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="px-3 py-3 text-left font-bold whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-muted/40" data-testid={`product-row-${p.sku}`}>
                    <td className="px-3 py-2">{p.image ? <img src={p.image} alt="" className="h-9 w-9 rounded-md object-cover" /> : <div className="h-9 w-9 rounded-md bg-muted grid place-items-center"><ImageOff className="h-4 w-4 text-muted-foreground" /></div>}</td>
                    <td className="px-3 py-2 font-mono font-semibold whitespace-nowrap">
                      {p.barcode || p.sku}
                      <br />
                      <span className="text-muted-foreground">{p.sku}</span>
                    </td>
                    <td className="px-3 py-2 font-medium min-w-[160px]">{p.nama}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.variant}</td>
                    <td className="px-3 py-2 tabular-nums">{p.min_stock}</td>
                    <td className="px-3 py-2 tabular-nums">{p.stok_awal}</td>
                    <td className="px-3 py-2 tabular-nums text-emerald-600">+{p.stock_in}</td>
                    <td className="px-3 py-2 tabular-nums text-sky-600">+{p.return_in}</td>
                    <td className="px-3 py-2 tabular-nums text-red-600">-{Math.abs(p.stock_out)}</td>
                    <td
                      className="px-3 py-2 tabular-nums font-extrabold"
                      data-testid={`stok-riil-${p.sku}`}
                    >
                      {p.stok_riil}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge value={p.status_stok} testId={`status-stok-${p.sku}`} />
                    </td>
                    <td
                      className="px-3 py-2 max-w-36 truncate"
                      title={p.action_summary}
                      data-testid={`product-action-${p.sku}`}
                    >
                      {p.action_summary || "-"}
                    </td>
                    <td
                      className="px-3 py-2 max-w-36 truncate"
                      title={p.supplier_utama}
                      data-testid={`product-supplier-${p.sku}`}
                    >
                      {p.supplier_utama || "-"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{rupiah(p.hpp)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{rupiah(p.harga_jual)}</td>
                    <td className="px-3 py-2">{p.margin}%</td>
                    <td className="px-3 py-2"><StatusBadge value={p.kondisi} /></td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button className="p-1 hover:text-indigo-600" onClick={() => setDlg({ open: true, product: p })} data-testid={`edit-product-${p.sku}`}><Pencil className="h-4 w-4" /></button>
                      {user?.role === "admin" && <button className="p-1 text-red-500" onClick={() => del(p)} data-testid={`delete-product-${p.sku}`}><Trash2 className="h-4 w-4" /></button>}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={18}
                      className="py-10 text-center text-muted-foreground"
                      data-testid="product-empty-state"
                    >
                      Belum ada produk
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <p className="text-[11px] text-muted-foreground" data-testid="product-import-format-note">
          Import cocok dengan master Google Sheet: header BARCODE/KODE BARANG, NAMA, MINIMUM
          KEEP STOCK, STOCK KELUAR, REAL STOCK INVENTORY, HPP/COGS, harga, supplier, serta
          catatan. Judul laporan dan baris satuan otomatis dilewati.
        </p>
      </div>
      <ProductDialog open={dlg.open} product={dlg.product} onOpenChange={(o) => setDlg((d) => ({ ...d, open: o }))} onSaved={load} />
    </div>
  );
}
