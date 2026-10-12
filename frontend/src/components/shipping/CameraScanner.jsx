import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function CameraScanner({ open, onOpenChange, onResult }) {
  const [error, setError] = useState("");
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setError("");
    const timer = setTimeout(() => {
      const s = new Html5Qrcode("camera-reader");
      scannerRef.current = s;
      s.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 260, height: 140 } }, (text) => {
        s.stop().catch(() => {}).finally(() => {
          onResult(text);
          onOpenChange(false);
        });
      }).catch(() => setError("Kamera tidak dapat diakses. Izinkan akses kamera di browser."));
    }, 150);
    return () => {
      clearTimeout(timer);
      const s = scannerRef.current;
      if (s?.isScanning) s.stop().catch(() => {});
    };
  }, [open, onOpenChange, onResult]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="camera-scanner-dialog">
        <DialogHeader><DialogTitle>Scan dengan Kamera</DialogTitle></DialogHeader>
        <div id="camera-reader" className="w-full rounded-lg overflow-hidden bg-black min-h-[240px]" />
        {error && <p className="text-sm text-red-600" data-testid="camera-error">{error}</p>}
        <p className="text-xs text-muted-foreground">Arahkan kamera ke barcode / QR resi.</p>
      </DialogContent>
    </Dialog>
  );
}
