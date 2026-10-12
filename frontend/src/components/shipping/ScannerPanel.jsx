import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ScanBarcode, Camera, Check, Loader2, Keyboard, Database } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CameraScanner from "@/components/shipping/CameraScanner";
import { api, errMsg } from "@/lib/api";
import { beep } from "@/lib/fmt";

export const AKUN = Array.from({ length: 20 }, (_, i) => String(i + 1));
export const TINDAKAN = ["PENGAJUAN CANCEL", "MENARIK PEMBATALAN", "PEMBATALAN DITERIMA"];

export default function ScannerPanel({ submenu, onScanned }) {
  const [resi, setResi] = useState("");
  const [akun, setAkun] = useState("auto");
  const [tindakan, setTindakan] = useState("PENGAJUAN CANCEL");
  const [busy, setBusy] = useState(false);
  const [cam, setCam] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [submenu]);

  const submit = useCallback(async (value) => {
    const v = value ?? resi;
    if (!v.trim()) return toast.error("Resi/barcode wajib diisi");
    setBusy(true);
    try {
      const { data } = await api.post("/shipping/scan", {
        resi: v, submenu, akun: akun === "auto" ? null : akun, tindakan: submenu === "cancel" ? tindakan : null,
      });
      if (data.alert || data.duplicate) {
        beep(false);
        toast.error(`${data.record.no_resi}: ${data.alert || "DATA DOUBLE"}`);
      } else {
        beep(true);
        toast.success(`${data.record.no_resi} · ${data.record.expedisi} · ${data.record.status}`);
      }
      onScanned?.(data.record);
      setResi("");
    } catch (e) {
      beep(false);
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }, [resi, submenu, akun, tindakan, onScanned]);

  const onCamera = useCallback((text) => submit(text), [submit]);

  return (
    <div className="rounded-xl border-2 border-indigo-100 dark:border-indigo-500/20 bg-card p-4 sm:p-5 shadow-sm" data-testid="scanner-panel">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex items-center gap-3 lg:w-72 shrink-0">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white grid place-items-center"><ScanBarcode className="h-5 w-5" /></div>
          <div>
            <p className="text-xl font-bold tracking-tight">Barcode Scanner</p>
            <p className="text-xs text-muted-foreground">Terintegrasi database real-time</p>
          </div>
        </div>
        <form className="flex-1 flex items-stretch rounded-lg border overflow-hidden focus-within:ring-2 focus-within:ring-indigo-400" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <button type="button" onClick={() => setCam(true)} className="px-3 bg-indigo-600 text-white hover:bg-indigo-700" title="Kamera" data-testid="scanner-camera-button"><Camera className="h-4 w-4" /></button>
          <input ref={inputRef} value={resi} onChange={(e) => setResi(e.target.value)} placeholder="SCAN BARCODE ATAU KETIK NOMOR RESI..." className="flex-1 min-w-0 bg-background px-3 py-3 font-mono text-sm uppercase tracking-wider outline-none" data-testid="scan-barcode-input" autoComplete="off" />
          <button type="submit" disabled={busy} className="px-4 sm:px-5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center gap-1" data-testid="scan-process-button">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} PROCESS
          </button>
        </form>
        <div className="flex gap-2 shrink-0">
          <Select value={akun} onValueChange={setAkun}>
            <SelectTrigger className="w-28" data-testid="scan-akun-select"><SelectValue placeholder="Akun" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Akun: Auto</SelectItem>
              {AKUN.map((a) => <SelectItem key={a} value={a}>Akun {a}</SelectItem>)}
            </SelectContent>
          </Select>
          {submenu === "cancel" && (
            <Select value={tindakan} onValueChange={setTindakan}>
              <SelectTrigger className="w-48" data-testid="scan-tindakan-select"><SelectValue /></SelectTrigger>
              <SelectContent>{TINDAKAN.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
      </div>
      <div className="flex justify-between mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Keyboard className="h-3.5 w-3.5 text-indigo-500" /> Enter untuk memproses otomatis</span>
        <span className="flex items-center gap-1.5"><Database className="h-3.5 w-3.5 text-emerald-500" /> Data langsung masuk ke tabel</span>
      </div>
      <CameraScanner open={cam} onOpenChange={setCam} onResult={onCamera} />
    </div>
  );
}
