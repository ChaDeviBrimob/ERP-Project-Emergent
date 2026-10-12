import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgePercent, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageBanner, Card, StatusBadge } from "@/components/common/ui";
import { DemoNotice } from "@/pages/mp/Stores";
import { api, errMsg } from "@/lib/api";
import { todayWIB } from "@/lib/fmt";

const TIPE = ["Diskon Toko", "Voucher", "Flash Sale", "Bundling", "Gratis Ongkir"];
const EMPTY = { nama: "", tipe: "Diskon Toko", nilai: 10, mulai: todayWIB(), selesai: todayWIB(7), aktif: true, store_ids: [] };

export default function Promos() {
  const [rows, setRows] = useState([]);
  const [stores, setStores] = useState([]);
  const [f, setF] = useState(null);
  const load = useCallback(() => {
    api.get("/mp/promos").then((r) => setRows(r.data));
  }, []);
  useEffect(() => {
    load();
    api.get("/mp/stores").then((r) => setStores(r.data));
  }, [load]);

  const save = async () => {
    try {
      const body = { ...f, nilai: Number(f.nilai) };
      if (f.id) await api.put(`/mp/promos/${f.id}`, body);
      else await api.post("/mp/promos", body);
      toast.success("Promo disimpan");
      setF(null);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const del = async (p) => {
    await api.delete(`/mp/promos/${p.id}`);
    load();
  };
  const toggleStore = (id) => setF((x) => ({ ...x, store_ids: x.store_ids.includes(id) ? x.store_ids.filter((s) => s !== id) : [...x.store_ids, id] }));
  const storeName = (ids) => (ids.length ? ids.map((i) => stores.find((s) => s.id === i)?.nama_toko).filter(Boolean).join(", ") : "Semua Toko");

  return (
    <div data-testid="promos-page">
      <PageBanner icon={BadgePercent} title="Promo & Diskon" subtitle="Marketplace Online · Jadwalkan promo untuk satu atau banyak toko" right={<Button size="sm" className="bg-emerald-500 hover:bg-emerald-600" onClick={() => setF(EMPTY)} data-testid="promo-add-button"><Plus className="h-4 w-4 mr-1" /> Buat Promo</Button>} />
      <div className="p-3 sm:p-5 space-y-4">
        <DemoNotice />
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map((p) => (
            <Card key={p.id} className="p-4 border-l-4 border-l-pink-500" data-testid={`promo-card-${p.id}`}>
              <div className="flex justify-between gap-2">
                <div><p className="font-bold">{p.nama}</p><p className="text-xs text-muted-foreground">{p.tipe} · {storeName(p.store_ids)}</p></div>
                <StatusBadge value={p.aktif ? "PUBLISHED" : "NONAKTIF"} />
              </div>
              <p className="text-3xl font-extrabold text-pink-600 mt-2">{p.tipe === "Voucher" || p.tipe === "Gratis Ongkir" ? `Rp ${Number(p.nilai).toLocaleString("id-ID")}` : `${p.nilai}%`}</p>
              <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                <span>{p.mulai} → {p.selesai}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7" onClick={() => setF(p)} data-testid={`promo-edit-${p.id}`}>Edit</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-red-500" onClick={() => del(p)} data-testid={`promo-delete-${p.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
      <Dialog open={!!f} onOpenChange={(o) => !o && setF(null)}>
        {f && (
          <DialogContent data-testid="promo-dialog">
            <DialogHeader><DialogTitle>{f.id ? "Edit Promo" : "Buat Promo"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label className="text-xs">Nama Promo</Label><Input value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} data-testid="promo-name-input" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Tipe</Label>
                  <Select value={f.tipe} onValueChange={(v) => setF({ ...f, tipe: v })}>
                    <SelectTrigger data-testid="promo-type-select"><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPE.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Nilai (% / Rp)</Label><Input type="number" value={f.nilai} onChange={(e) => setF({ ...f, nilai: e.target.value })} data-testid="promo-value-input" /></div>
                <div className="space-y-1"><Label className="text-xs">Mulai</Label><Input type="date" value={f.mulai} onChange={(e) => setF({ ...f, mulai: e.target.value })} data-testid="promo-start-input" /></div>
                <div className="space-y-1"><Label className="text-xs">Selesai</Label><Input type="date" value={f.selesai} onChange={(e) => setF({ ...f, selesai: e.target.value })} data-testid="promo-end-input" /></div>
              </div>
              <div className="space-y-1"><Label className="text-xs">Toko (kosong = semua)</Label>
                <div className="flex flex-wrap gap-1.5">{stores.map((s) => <button key={s.id} type="button" onClick={() => toggleStore(s.id)} className={`rounded-full border px-2.5 py-1 text-[11px] ${f.store_ids.includes(s.id) ? "bg-indigo-600 text-white border-indigo-600" : ""}`} data-testid={`promo-store-${s.id}`}>{s.nama_toko}</button>)}</div>
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={f.aktif} onCheckedChange={(v) => setF({ ...f, aktif: v })} data-testid="promo-active-switch" /> Aktif</label>
            </div>
            <DialogFooter><Button onClick={save} disabled={!f.nama} data-testid="promo-save-button">Simpan</Button></DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
