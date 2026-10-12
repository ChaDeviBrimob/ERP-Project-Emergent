import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errMsg } from "@/lib/api";
import { rupiah } from "@/lib/fmt";

export const SHEET_KONDISI = [
  "PUBLISHED",
  "HOLD DULU SEMENTARA",
  "DISCONTINUE",
  "UPLOAD PRODUCT",
  "DROPSHIP",
  "SLOW MOVING",
  "DEAD STOCK",
  "URGENT",
];
const EMPTY = {
  sku: "",
  barcode: "",
  nama: "",
  variant: "",
  kategori: "",
  action_summary: "",
  catatan_tindakan: "",
  catatan_staff: "",
  min_stock: 0,
  stok_awal: 0,
  stock_in: 0,
  return_in: 0,
  stock_out: 0,
  hpp: 0,
  harga_normal: 0,
  harga_jual: 0,
  diskon_promo: 0,
  supplier_utama: "",
  lokasi_supplier: "",
  satuan_barang: "pcs",
  kondisi: "PUBLISHED",
  barang_susah: false,
};
const NUMS = [
  ["min_stock", "Min Stock (Keep)"],
  ["stok_awal", "Stok Awal"],
  ["stock_in", "Stock In (Masuk)"],
  ["return_in", "Return In (Retur)"],
  ["stock_out", "Stock Out (Keluar)"],
  ["hpp", "HPP / COGS"],
  ["harga_normal", "Harga Normal"],
  ["harga_jual", "Harga Setelah Promo"],
  ["diskon_promo", "Diskon Promo (%)"],
];

export default function ProductDialog({ open, onOpenChange, product, onSaved }) {
  const [f, setF] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setF(product ? { ...EMPTY, ...product } : EMPTY);
    setFile(null);
  }, [product, open]);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const riil = Number(f.stok_awal) + Number(f.stock_in) + Number(f.return_in) - Math.abs(Number(f.stock_out));
  const save = async () => {
    setBusy(true);
    try {
      const body = { ...f, image: undefined };
      NUMS.forEach(([k]) => { body[k] = Number(body[k]) || 0; });
      const { data } = product ? await api.put(`/products/${product.id}`, body) : await api.post("/products", body);
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        await api.post(`/products/${data.id}/image`, fd);
      }
      toast.success("Produk disimpan");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="product-dialog">
        <DialogHeader><DialogTitle>{product ? "Edit Produk Gudang" : "Tambah Produk Gudang"}</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-[140px_1fr] gap-4">
          <label className="aspect-square rounded-xl border-2 border-dashed grid place-items-center cursor-pointer overflow-hidden bg-muted/40" data-testid="product-image-upload">
            {file ? <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" /> : f.image ? <img src={f.image} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-muted-foreground flex flex-col items-center gap-1"><ImagePlus className="h-5 w-5" />Foto SKU</span>}
            <input type="file" accept="image/*" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} data-testid="product-image-input" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["barcode", "Barcode Barang"],
              ["sku", "SKU / Kode Internal"],
              ["nama", "Nama Barang"],
              ["variant", "Variant / Kapasitas"],
              ["kategori", "Kategori"],
              ["satuan_barang", "Satuan Barang"],
              ["action_summary", "Action Summary / To Do"],
              ["supplier_utama", "Supplier Utama"],
              ["lokasi_supplier", "Lokasi Supplier"],
            ].map(([k, l]) => (
              <div key={k} className="space-y-1">
                <Label className="text-xs">{l}</Label>
                <Input
                  value={f[k]}
                  onChange={(e) => set(k, e.target.value)}
                  data-testid={`product-${k}-input`}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {NUMS.map(([k, l]) => (
            <div key={k} className="space-y-1"><Label className="text-xs">{l}</Label><Input type="number" value={f[k]} onChange={(e) => set(k, e.target.value)} data-testid={`product-${k}-input`} /></div>
          ))}
          <div className="space-y-1"><Label className="text-xs">Kondisi Barang</Label>
            <Select value={f.kondisi} onValueChange={(v) => set("kondisi", v)}>
              <SelectTrigger data-testid="product-kondisi-select"><SelectValue /></SelectTrigger>
              <SelectContent>{SHEET_KONDISI.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Catatan Tindakan / Revisi</Label>
            <Input value={f.catatan_tindakan} onChange={(e) => set("catatan_tindakan", e.target.value)} data-testid="product-action-note-input" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Catatan Staff & Kondisi</Label>
            <Input value={f.catatan_staff} onChange={(e) => set("catatan_staff", e.target.value)} data-testid="product-staff-note-input" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 p-3 text-sm">
          <span>Stok Riil = Awal + In + Return − Out = <b data-testid="product-stok-riil-preview">{riil}</b></span>
          <span>Margin: <b>{f.harga_jual ? (((f.harga_jual - f.hpp) / f.harga_jual) * 100).toFixed(1) : 0}%</b> · {rupiah(f.harga_jual - f.hpp)}</span>
          <label className="flex items-center gap-2 text-xs"><Switch checked={f.barang_susah} onCheckedChange={(v) => set("barang_susah", v)} data-testid="product-susah-switch" /> Tandai STOCK BARANG SUSAH</label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="product-cancel-button">Batal</Button>
          <Button onClick={save} disabled={busy || !f.sku || !f.nama} data-testid="product-save-button">Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
