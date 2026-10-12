import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Tags, Pencil, Search, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageBanner, Card, StatusBadge } from "@/components/common/ui";
import { DemoNotice } from "@/pages/mp/Stores";
import { StoreFilter } from "@/pages/mp/Orders";
import { api, errMsg } from "@/lib/api";
import { rupiah } from "@/lib/fmt";

function EditDialog({ product, onClose, onSaved }) {
  const [f, setF] = useState(product);
  useEffect(() => {
    setF(product);
  }, [product]);
  if (!f) return null;
  const save = async () => {
    try {
      await api.patch(`/mp/products/${f.id}`, { nama: f.nama, harga: Number(f.harga), harga_coret: Number(f.harga_coret), diskon_persen: Number(f.diskon_persen), stok: Number(f.stok), deskripsi: f.deskripsi, aktif: f.aktif });
      toast.success("Produk marketplace diperbarui");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" data-testid="mp-product-dialog">
        <DialogHeader><DialogTitle>Edit Listing · {f.nama_toko}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label className="text-xs">Nama Produk</Label><Input value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} data-testid="mp-product-name-input" /></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[["harga", "Harga"], ["harga_coret", "Harga Coret"], ["diskon_persen", "Diskon %"], ["stok", "Stok Online"]].map(([k, l]) => (
              <div key={k} className="space-y-1"><Label className="text-xs">{l}</Label><Input type="number" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} data-testid={`mp-product-${k}-input`} /></div>
            ))}
          </div>
          <p className="text-sm">Harga tampil: <b>{rupiah(f.harga * (1 - (f.diskon_persen || 0) / 100))}</b></p>
          <div className="space-y-1"><Label className="text-xs">Deskripsi</Label><Textarea rows={5} value={f.deskripsi} onChange={(e) => setF({ ...f, deskripsi: e.target.value })} data-testid="mp-product-desc-input" /></div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.aktif} onCheckedChange={(v) => setF({ ...f, aktif: v })} data-testid="mp-product-active-switch" /> Listing aktif</label>
        </div>
        <DialogFooter><Button onClick={save} data-testid="mp-product-save-button">Simpan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MpProducts() {
  const [rows, setRows] = useState([]);
  const [store, setStore] = useState("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState([]);
  const [bulk, setBulk] = useState("");
  const [edit, setEdit] = useState(null);
  const load = useCallback(() => {
    api.get("/mp/products", { params: { store_id: store === "all" ? "" : store, q } }).then((r) => setRows(r.data));
  }, [store, q]);
  useEffect(() => {
    load();
  }, [load]);

  const applyBulk = async () => {
    try {
      const { data } = await api.post("/mp/products/bulk", { ids: sel, diskon_persen: Number(bulk) });
      toast.success(`${data.updated} produk diperbarui`);
      setSel([]);
      setBulk("");
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div data-testid="mp-products-page">
      <PageBanner icon={Tags} title="Produk & Harga Marketplace" subtitle="Marketplace Online · Atur harga, harga coret, diskon & deskripsi per toko" />
      <div className="p-3 sm:p-5 space-y-4">
        <DemoNotice />
        <Card>
          <div className="flex flex-wrap items-center gap-2 p-4 border-b">
            <StoreFilter value={store} onChange={setStore} />
            <div className="flex items-center rounded-md border h-9 px-2 bg-background">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk" className="bg-transparent px-2 text-sm outline-none w-40" data-testid="mp-product-search" />
            </div>
            {sel.length > 0 && (
              <div className="flex items-center gap-2 ml-auto rounded-lg bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5" data-testid="bulk-bar">
                <span className="text-xs font-semibold">{sel.length} dipilih</span>
                <Input type="number" placeholder="Diskon %" className="h-8 w-24" value={bulk} onChange={(e) => setBulk(e.target.value)} data-testid="bulk-discount-input" />
                <Button size="sm" onClick={applyBulk} disabled={bulk === ""} data-testid="bulk-apply-button"><Percent className="h-3.5 w-3.5 mr-1" /> Terapkan</Button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="mp-products-table">
              <thead><tr className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-3"><Checkbox checked={rows.length > 0 && sel.length === rows.length} onCheckedChange={(v) => setSel(v ? rows.map((r) => r.id) : [])} data-testid="mp-select-all" /></th>
                {["Produk", "Toko", "SKU Gudang", "Harga", "Harga Coret", "Diskon", "Harga Tampil", "Stok", "Status", ""].map((h, i) => <th key={i} className="px-3 py-3 text-left whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-muted/40" data-testid={`mp-product-row-${p.id}`}>
                    <td className="px-3 py-2"><Checkbox checked={sel.includes(p.id)} onCheckedChange={() => toggle(p.id)} data-testid={`mp-select-${p.id}`} /></td>
                    <td className="px-3 py-2 font-medium min-w-[160px]">{p.nama}<p className="text-[10px] text-muted-foreground line-clamp-1">{p.deskripsi}</p></td>
                    <td className="px-3 py-2 whitespace-nowrap"><StatusBadge value={p.marketplace} /> {p.nama_toko}</td>
                    <td className="px-3 py-2 font-mono">{p.sku_ref || "-"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{rupiah(p.harga)}</td>
                    <td className="px-3 py-2 whitespace-nowrap line-through text-muted-foreground">{rupiah(p.harga_coret)}</td>
                    <td className="px-3 py-2 font-bold text-red-600" data-testid={`mp-discount-${p.id}`}>{p.diskon_persen}%</td>
                    <td className="px-3 py-2 font-bold whitespace-nowrap">{rupiah(p.harga * (1 - p.diskon_persen / 100))}</td>
                    <td className="px-3 py-2">{p.stok}</td>
                    <td className="px-3 py-2"><StatusBadge value={p.aktif ? "PUBLISHED" : "NONAKTIF"} /></td>
                    <td className="px-3 py-2"><button onClick={() => setEdit(p)} className="hover:text-indigo-600" data-testid={`mp-edit-${p.id}`}><Pencil className="h-4 w-4" /></button></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={11} className="py-10 text-center text-muted-foreground">Belum ada produk</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <EditDialog product={edit} onClose={() => setEdit(null)} onSaved={load} />
    </div>
  );
}
