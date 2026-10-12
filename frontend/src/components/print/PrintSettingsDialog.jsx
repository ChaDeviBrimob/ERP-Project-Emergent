import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ResiLabel from "@/components/print/ResiLabel";
import { PAPER } from "@/components/print/brand";
import { api, errMsg } from "@/lib/api";

const MPS = ["SHOPEE", "TOKOPEDIA", "TIKTOK SHOP", "LAZADA"];
const SAMPLE = { order_no: "2610ABC123", resi: "SPXID0012345678", nama_toko: "Toko Anda", berat_gram: 500, created_at: new Date().toISOString(), items: [{ nama: "Contoh Produk A", sku: "BRG-001", qty: 2, harga: 59000 }], penerima: { nama: "Nama Pembeli", telp: "0812xxxx", alamat: "Jl. Contoh No. 1", kota: "Jakarta" } };
const TOGGLES = [["show_items", "Tampilkan daftar produk"], ["show_qr", "Tampilkan QR Code"], ["show_sender", "Tampilkan pengirim"], ["show_price", "Tampilkan harga produk"]];

export default function PrintSettingsDialog({ open, onOpenChange }) {
  const [all, setAll] = useState(null);
  const [mp, setMp] = useState("SHOPEE");
  useEffect(() => {
    if (open) {
      api.get("/mp/print-settings").then((r) => setAll(r.data));
    }
  }, [open]);
  if (!all) return null;
  const s = all[mp];
  const set = (k, v) => setAll({ ...all, [mp]: { ...s, [k]: v } });
  const save = async () => {
    try {
      await api.put(`/mp/print-settings/${encodeURIComponent(mp)}`, { ...s, copies: Number(s.copies) });
      toast.success(`Pengaturan cetak ${mp} disimpan`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto" data-testid="print-settings-dialog">
        <DialogHeader><DialogTitle>Pengaturan Cetak Resi per Marketplace</DialogTitle></DialogHeader>
        <Tabs value={mp} onValueChange={setMp}>
          <TabsList>{MPS.map((m) => <TabsTrigger key={m} value={m} data-testid={`print-settings-tab-${m.replace(" ", "-")}`}>{m}</TabsTrigger>)}</TabsList>
        </Tabs>
        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Ukuran Kertas</Label>
                <Select value={s.paper} onValueChange={(v) => set("paper", v)}>
                  <SelectTrigger data-testid="print-paper-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PAPER).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Jumlah Salinan</Label>
                <Select value={String(s.copies)} onValueChange={(v) => set("copies", Number(v))}>
                  <SelectTrigger data-testid="print-copies-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{["1", "2", "3", "4", "5"].map((c) => <SelectItem key={c} value={c}>{c}x</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {TOGGLES.map(([k, l]) => (
              <label key={k} className="flex items-center justify-between text-sm"><span>{l}</span><Switch checked={!!s[k]} onCheckedChange={(v) => set(k, v)} data-testid={`print-${k}-switch`} /></label>
            ))}
            {[["sender_nama", "Nama Pengirim (default: nama toko)"], ["sender_telp", "No. HP Pengirim"], ["sender_alamat", "Alamat Pengirim"], ["catatan", "Catatan Footer"]].map(([k, l]) => (
              <div key={k} className="space-y-1"><Label className="text-xs">{l}</Label><Input value={s[k]} onChange={(e) => set(k, e.target.value)} data-testid={`print-${k}-input`} /></div>
            ))}
          </div>
          <div className="rounded-lg bg-neutral-200 p-3 overflow-auto max-h-[70vh]" data-testid="print-preview">
            <div className="origin-top scale-[0.8]"><ResiLabel order={{ ...SAMPLE, id: "x", marketplace: mp, resi: { SHOPEE: "SPXID0012345678", TOKOPEDIA: "TL0012345678", "TIKTOK SHOP": "JP0012345678", LAZADA: "LXAD0012345678" }[mp], kurir: { SHOPEE: "SPX Standard", TOKOPEDIA: "JNE REG", "TIKTOK SHOP": "J&T Express", LAZADA: "LEX ID" }[mp] }} settings={s} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={save} data-testid="print-settings-save-button">Simpan Pengaturan {mp}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
