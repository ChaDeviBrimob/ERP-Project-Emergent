import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Printer, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ResiLabel from "@/components/print/ResiLabel";
import { PAPER } from "@/components/print/brand";
import { api, errMsg } from "@/lib/api";

export default function PrintResi() {
  const [params] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const done = useRef(false);

  useEffect(() => {
    if (done.current) {
      return;
    }
    done.current = true;
    const ids = (params.get("ids") || "").split(",").filter(Boolean);
    api.post("/mp/orders/print", { ids, auto_ship: true })
      .then((r) => setData(r.data))
      .catch((e) => setError(errMsg(e)));
  }, [params]);

  useEffect(() => {
    if (data?.orders?.length && params.get("auto") === "1") {
      const t = setTimeout(() => window.print(), 700);
      return () => clearTimeout(t);
    }
  }, [data, params]);

  if (error) return <p className="p-6 text-red-600" data-testid="print-error">{error}</p>;
  if (!data) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const first = data.settings[data.orders[0]?.marketplace] || {};
  const page = PAPER[first.paper] || PAPER["100x150"];
  const labels = data.orders.flatMap((o) => Array.from({ length: data.settings[o.marketplace]?.copies || 1 }, (_, i) => ({ o, i })));

  return (
    <div className="min-h-screen bg-neutral-200 print:bg-white" data-testid="print-resi-page">
      <style>{`@media print { @page { size: ${page.w} ${page.h}; margin: 0; } .no-print { display: none !important; } .label-page { page-break-after: always; break-after: page; padding: 0 !important; margin: 0 !important; } }`}</style>
      <div className="no-print sticky top-0 z-10 bg-white border-b px-4 py-3 flex flex-wrap items-center gap-3">
        <Link to="/marketplace/pesanan" className="flex items-center gap-1 text-sm" data-testid="print-back-link"><ArrowLeft className="h-4 w-4" /> Kembali</Link>
        <p className="text-sm font-semibold" data-testid="print-count">{data.orders.length} pesanan · {labels.length} label · Kertas {page.label}</p>
        {data.skipped.length > 0 && <p className="text-xs text-amber-700">Dilewati (belum ada resi / status tidak bisa dikirim): {data.skipped.join(", ")}</p>}
        <Button className="ml-auto" onClick={() => window.print()} data-testid="print-now-button"><Printer className="h-4 w-4 mr-1" /> Cetak Sekarang</Button>
      </div>
      <div className="py-6 print:py-0 space-y-6 print:space-y-0">
        {labels.map(({ o, i }) => (
          <div key={`${o.id}-${i}`} className="label-page flex justify-center">
            <ResiLabel order={o} settings={data.settings[o.marketplace]} />
          </div>
        ))}
        {labels.length === 0 && <p className="text-center text-sm">Tidak ada label yang bisa dicetak.</p>}
      </div>
    </div>
  );
}
