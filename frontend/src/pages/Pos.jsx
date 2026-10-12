import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Receipt, Search, Minus, Plus, Trash2, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageBanner, Card } from "@/components/common/ui";
import { api, errMsg } from "@/lib/api";
import { rupiah, wib } from "@/lib/fmt";

function Cart({ cart, setCart, onDone }) {
  const [diskon, setDiskon] = useState("");
  const [metode, setMetode] = useState("Cash");
  const [bayar, setBayar] = useState("");
  const subtotal = cart.reduce((a, c) => a + c.qty * c.harga_jual, 0);
  const total = Math.max(subtotal - Number(diskon || 0), 0);
  const qty = (sku, d) => setCart((cs) => cs.map((c) => (c.sku === sku ? { ...c, qty: Math.max(1, Math.min(c.stok_riil, c.qty + d)) } : c)));
  const checkout = async () => {
    try {
      const { data } = await api.post("/pos/checkout", { items: cart.map((c) => ({ sku: c.sku, qty: c.qty })), diskon: Number(diskon || 0), metode, bayar: metode === "Cash" ? Number(bayar || 0) : total });
      toast.success(`${data.invoice} berhasil · Kembali ${rupiah(data.kembali)}`);
      setCart([]);
      setDiskon("");
      setBayar("");
      onDone();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  return (
    <Card className="p-4 space-y-3 h-fit lg:sticky lg:top-20" data-testid="pos-cart">
      <p className="font-bold">Keranjang</p>
      {cart.length === 0 && <p className="text-sm text-muted-foreground">Pilih produk untuk ditambahkan</p>}
      {cart.map((c) => (
        <div key={c.sku} className="flex items-center gap-2 text-sm" data-testid={`cart-item-${c.sku}`}>
          <div className="flex-1 min-w-0"><p className="font-medium truncate">{c.nama}</p><p className="text-xs text-muted-foreground">{rupiah(c.harga_jual)}</p></div>
          <button onClick={() => qty(c.sku, -1)} className="h-7 w-7 rounded border grid place-items-center" data-testid={`cart-minus-${c.sku}`}><Minus className="h-3 w-3" /></button>
          <span className="w-6 text-center tabular-nums">{c.qty}</span>
          <button onClick={() => qty(c.sku, 1)} className="h-7 w-7 rounded border grid place-items-center" data-testid={`cart-plus-${c.sku}`}><Plus className="h-3 w-3" /></button>
          <button onClick={() => setCart((cs) => cs.filter((x) => x.sku !== c.sku))} className="text-red-500"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <div className="border-t pt-3 space-y-2 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><b>{rupiah(subtotal)}</b></div>
        <Input type="number" placeholder="Diskon (Rp)" value={diskon} onChange={(e) => setDiskon(e.target.value)} data-testid="pos-discount-input" />
        <Select value={metode} onValueChange={setMetode}>
          <SelectTrigger data-testid="pos-method-select"><SelectValue /></SelectTrigger>
          <SelectContent>{["Cash", "Transfer", "QRIS"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
        {metode === "Cash" && <Input type="number" placeholder="Uang dibayar" value={bayar} onChange={(e) => setBayar(e.target.value)} data-testid="pos-pay-input" />}
        <div className="flex justify-between text-lg"><span>Total</span><b data-testid="pos-total">{rupiah(total)}</b></div>
        <Button className="w-full bg-emerald-500 hover:bg-emerald-600" disabled={!cart.length} onClick={checkout} data-testid="pos-checkout-button">Bayar</Button>
      </div>
    </Card>
  );
}

export default function Pos() {
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState([]);
  const load = useCallback(() => {
    api.get("/products", { params: { q } }).then((r) => setProducts(r.data));
    api.get("/pos/history").then((r) => setHistory(r.data));
  }, [q]);
  useEffect(() => {
    load();
  }, [load]);
  const add = (p) => {
    if (p.stok_riil <= 0) return toast.error("Stok habis");
    setCart((cs) => (cs.find((c) => c.sku === p.sku) ? cs.map((c) => (c.sku === p.sku ? { ...c, qty: Math.min(c.qty + 1, p.stok_riil) } : c)) : [...cs, { ...p, qty: 1 }]));
  };

  return (
    <div data-testid="pos-page">
      <PageBanner icon={Receipt} title="POS Kasir" subtitle="Penjualan langsung · otomatis mengurangi Stock Out gudang" />
      <div className="p-3 sm:p-5 grid lg:grid-cols-[1fr_340px] gap-4">
        <div className="space-y-4">
          <div className="flex items-center rounded-md border h-10 px-3 bg-card max-w-md">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari / scan SKU" className="bg-transparent px-2 text-sm outline-none w-full" data-testid="pos-search-input" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {products.map((p) => (
              <button key={p.id} onClick={() => add(p)} className="rounded-xl border bg-card p-3 text-left hover:border-indigo-400 transition-colors" data-testid={`pos-product-${p.sku}`}>
                <div className="aspect-square rounded-lg bg-muted mb-2 overflow-hidden grid place-items-center">{p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : <ImageOff className="h-5 w-5 text-muted-foreground" />}</div>
                <p className="text-sm font-semibold line-clamp-1">{p.nama}</p>
                <p className="text-[11px] text-muted-foreground font-mono">{p.sku} · stok {p.stok_riil}</p>
                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-300">{rupiah(p.harga_jual)}</p>
              </button>
            ))}
          </div>
          <Card>
            <p className="p-4 font-bold border-b">Riwayat Transaksi</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" data-testid="pos-history-table">
                <thead><tr className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">{["Invoice", "Waktu", "Items", "Total", "Metode", "Kasir"].map((h) => <th key={h} className="px-3 py-3 text-left">{h}</th>)}</tr></thead>
                <tbody>
                  {history.map((t) => (
                    <tr key={t.id} className="border-b"><td className="px-3 py-2 font-mono">{t.invoice}</td><td className="px-3 py-2">{wib(t.created_at).tanggal} {wib(t.created_at).waktu}</td><td className="px-3 py-2">{t.items.map((i) => `${i.nama} ×${i.qty}`).join(", ")}</td><td className="px-3 py-2 font-semibold">{rupiah(t.total)}</td><td className="px-3 py-2">{t.metode}</td><td className="px-3 py-2">{t.operator}</td></tr>
                  ))}
                  {history.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Belum ada transaksi</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <Cart cart={cart} setCart={setCart} onDone={load} />
      </div>
    </div>
  );
}
