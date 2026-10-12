import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Store, Plus, RefreshCw, Power, Trash2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageBanner, Card, StatusBadge } from "@/components/common/ui";
import { api, errMsg } from "@/lib/api";
import { wib, MP_COLORS } from "@/lib/fmt";

export const MARKETPLACES = ["SHOPEE", "TOKOPEDIA", "TIKTOK SHOP", "LAZADA"];

export function DemoNotice() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 p-3 text-xs text-amber-900 dark:text-amber-200" data-testid="demo-notice">
      <Info className="h-4 w-4 shrink-0 mt-0.5" />
      <span><b>MODE DEMO:</b> data marketplace masih simulasi. Koneksi asli ke Shopee/Tokopedia/TikTok/Lazada membutuhkan App Key & Secret Partner API resmi dari masing-masing marketplace.</span>
    </div>
  );
}

export default function Stores() {
  const [stores, setStores] = useState([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ marketplace: "SHOPEE", nama_toko: "", username: "" });
  const [syncing, setSyncing] = useState(false);
  const load = useCallback(() => {
    api.get("/mp/stores").then((r) => setStores(r.data));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    try {
      await api.post("/mp/stores", f);
      toast.success("Akun toko terhubung (demo)");
      setOpen(false);
      setF({ marketplace: "SHOPEE", nama_toko: "", username: "" });
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const sync = async () => {
    setSyncing(true);
    const { data } = await api.post("/mp/sync");
    toast.success(`Sinkronisasi selesai: ${data.new_orders} pesanan baru`);
    setSyncing(false);
    load();
  };
  const toggle = async (s) => {
    await api.patch(`/mp/stores/${s.id}/toggle`);
    load();
  };
  const del = async (s) => {
    if (!window.confirm(`Hapus ${s.nama_toko} beserta data demo-nya?`)) return;
    await api.delete(`/mp/stores/${s.id}`);
    load();
  };

  return (
    <div data-testid="stores-page">
      <PageBanner icon={Store} title="Akun Toko Marketplace" subtitle="Marketplace Online · Kelola multi-akun dari berbagai marketplace" right={
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={sync} disabled={syncing} data-testid="mp-sync-button"><RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} /> Sinkronkan</Button>
          <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600" onClick={() => setOpen(true)} data-testid="store-add-button"><Plus className="h-4 w-4 mr-1" /> Hubungkan Toko</Button>
        </div>} />
      <div className="p-3 sm:p-5 space-y-4">
        <DemoNotice />
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {stores.map((s) => (
            <Card key={s.id} className="p-4 fade-up" data-testid={`store-card-${s.id}`}>
              <div className="flex items-center gap-3">
                <div className={`h-11 w-11 rounded-xl ${MP_COLORS[s.marketplace] || "bg-slate-500"} text-white grid place-items-center font-extrabold`}>{s.marketplace[0]}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">{s.nama_toko}</p>
                  <p className="text-xs text-muted-foreground">{s.marketplace} · @{s.username}</p>
                </div>
                <StatusBadge value={s.status} testId={`store-status-${s.id}`} />
              </div>
              <div className="flex items-center justify-between mt-4 text-[11px] text-muted-foreground">
                <span>Sinkron terakhir: {wib(s.last_sync).waktu}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => toggle(s)} data-testid={`store-toggle-${s.id}`}><Power className="h-3.5 w-3.5 mr-1" />{s.connected ? "Putuskan" : "Hubungkan"}</Button>
                  <Button size="sm" variant="ghost" className="text-red-500" onClick={() => del(s)} data-testid={`store-delete-${s.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="store-dialog">
          <DialogHeader><DialogTitle>Hubungkan Akun Toko</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Marketplace</Label>
              <Select value={f.marketplace} onValueChange={(v) => setF({ ...f, marketplace: v })}>
                <SelectTrigger data-testid="store-marketplace-select"><SelectValue /></SelectTrigger>
                <SelectContent>{MARKETPLACES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Nama Toko</Label><Input value={f.nama_toko} onChange={(e) => setF({ ...f, nama_toko: e.target.value })} data-testid="store-name-input" /></div>
            <div className="space-y-1"><Label className="text-xs">Username / Email Seller</Label><Input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} data-testid="store-username-input" /></div>
            <p className="text-[11px] text-muted-foreground">Mode demo: tidak ada password yang dikirim ke marketplace. Integrasi asli memakai OAuth Partner API.</p>
          </div>
          <DialogFooter><Button onClick={add} disabled={!f.nama_toko || !f.username} data-testid="store-save-button">Hubungkan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
