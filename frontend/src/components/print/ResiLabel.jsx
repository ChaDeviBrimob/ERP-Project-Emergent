import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { QRCodeSVG } from "qrcode.react";
import { BRAND, PAPER } from "@/components/print/brand";
import { rupiah, wib } from "@/lib/fmt";

function Barcode({ value, height = 56, width = 2 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && value) {
      JsBarcode(ref.current, value, { format: "CODE128", height, width, displayValue: true, fontSize: 14, margin: 0, font: "monospace" });
    }
  }, [value, height, width]);
  return <svg ref={ref} className="max-w-full" />;
}

function Party({ title, nama, telp, alamat, big }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">{title}</p>
      <p className={`${big ? "text-[13px]" : "text-[11px]"} font-bold leading-tight`}>{nama || "-"}</p>
      {telp && <p className="text-[10px]">{telp}</p>}
      {alamat && <p className="text-[10px] leading-snug">{alamat}</p>}
    </div>
  );
}

function Items({ order, s }) {
  if (!s.show_items) return null;
  return (
    <table className="w-full text-[9px] border-t border-black/70 mt-1">
      <thead><tr className="text-left"><th className="py-0.5">Produk</th><th>SKU</th><th className="text-right">Qty</th>{s.show_price && <th className="text-right">Harga</th>}</tr></thead>
      <tbody>
        {order.items.map((i, k) => (
          <tr key={k} className="border-t border-dashed border-black/30"><td className="py-0.5 pr-1">{i.nama}</td><td className="font-mono">{i.sku || "-"}</td><td className="text-right">{i.qty}</td>{s.show_price && <td className="text-right">{rupiah(i.harga)}</td>}</tr>
        ))}
      </tbody>
    </table>
  );
}

function Header({ b, order, variant }) {
  if (variant === "tokopedia") {
    return (
      <div className="flex items-center justify-between px-2 py-1.5 text-white" style={{ background: b.color }}>
        <span className="text-lg font-extrabold lowercase tracking-tight">{b.name}</span>
        <span className="text-[11px] font-bold">{order.kurir}</span>
      </div>
    );
  }
  if (variant === "tiktok") {
    return (
      <div className="flex items-center justify-between px-2 py-1.5 border-b-2 border-black">
        <span className="text-base font-black tracking-tight"><span className="text-[#25f4ee]">♪</span> TikTok <span className="font-semibold">Shop</span></span>
        <span className="rounded bg-black text-white px-2 py-0.5 text-[11px] font-bold">{order.kurir}</span>
      </div>
    );
  }
  if (variant === "lazada") {
    return (
      <div className="flex items-center justify-between px-2 py-1.5 text-white" style={{ background: `linear-gradient(90deg, ${b.color}, #f36)` }}>
        <span className="text-lg font-extrabold">Lazada</span>
        <span className="text-[11px] font-bold">{order.kurir}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between px-2 py-1.5 border-b-2" style={{ borderColor: b.color }}>
      <span className="text-lg font-extrabold" style={{ color: b.color }}>Shopee</span>
      <span className="text-sm font-black">{order.kurir}</span>
    </div>
  );
}

export default function ResiLabel({ order, settings }) {
  const b = BRAND[order.marketplace] || BRAND.SHOPEE;
  const s = settings || {};
  const p = PAPER[s.paper] || PAPER["100x150"];
  const pen = order.penerima || {};
  const small = s.paper === "100x100";
  return (
    <div className="resi-label bg-white text-black border border-black flex flex-col overflow-hidden mx-auto" style={{ width: p.w, height: s.paper === "A4" ? "150mm" : p.h, fontFamily: "Arial, sans-serif" }} data-testid={`resi-label-${order.order_no}`}>
      <Header b={b} order={order} variant={b.layout} />
      <div className="px-2 pt-2 flex flex-col items-center border-b border-black/70 pb-1.5">
        <Barcode value={order.resi} height={small ? 40 : 56} />
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2 px-2 py-1.5 border-b border-black/70">
        <div className="space-y-0.5 text-[10px]">
          <p><b>No. Pesanan:</b> <span className="font-mono">{order.order_no}</span></p>
          <p><b>Toko:</b> {order.nama_toko}</p>
          <p><b>Berat:</b> {order.berat_gram || 500} gr · <b>{order.cod ? "COD" : "NON-COD"}</b></p>
          <p><b>Tanggal:</b> {wib(order.created_at).tanggal}</p>
        </div>
        {s.show_qr && <QRCodeSVG value={order.resi} size={small ? 48 : 64} />}
      </div>
      <div className={`grid ${s.show_sender ? "grid-cols-2" : "grid-cols-1"} gap-2 px-2 py-1.5 border-b border-black/70`}>
        <Party title="Penerima" nama={pen.nama} telp={pen.telp} alamat={[pen.alamat, pen.kota].filter(Boolean).join(", ")} big />
        {s.show_sender && <Party title="Pengirim" nama={s.sender_nama || order.nama_toko} telp={s.sender_telp} alamat={s.sender_alamat} />}
      </div>
      <div className="px-2 flex-1 overflow-hidden"><Items order={order} s={s} /></div>
      <div className="px-2 py-1 text-[9px] flex justify-between border-t border-black/70" style={{ background: b.soft }}>
        <span className="truncate">{s.catatan || `Cetak dari ERP VRCHINDO · ${b.name}`}</span>
        <span className="font-bold">{b.name}</span>
      </div>
    </div>
  );
}
