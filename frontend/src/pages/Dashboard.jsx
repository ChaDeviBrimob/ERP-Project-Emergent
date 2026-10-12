import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Home, Package, Boxes, Wallet, AlertTriangle, Truck, ShoppingBag, MessagesSquare, Store, ScanBarcode, Receipt } from "lucide-react";
import { PageBanner, KpiCard, Card } from "@/components/common/ui";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/fmt";
import { useAuth } from "@/context/AuthContext";

const QUICK = [
  ["/pengiriman?tab=process", "Scan Process", ScanBarcode, "quick-scan-process"],
  ["/pengiriman?tab=pengiriman", "Scan Pengiriman", Truck, "quick-scan-kirim"],
  ["/gudang/produk", "Data Gudang", Package, "quick-gudang"],
  ["/marketplace/pesanan", "Pesanan Online", ShoppingBag, "quick-mp-orders"],
  ["/marketplace/chat", "Chat Pembeli", MessagesSquare, "quick-mp-chat"],
  ["/pos", "POS Kasir", Receipt, "quick-pos"],
];

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => {
    api.get("/dashboard").then((r) => setD(r.data));
  }, []);
  const s = d?.shipping_today || {};
  return (
    <div data-testid="dashboard-page">
      <PageBanner icon={Home} title={`Halo, ${user?.name || ""}`} subtitle="Ringkasan hari ini · Data Internal & Marketplace Online" />
      <div className="p-3 sm:p-5 space-y-5">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {QUICK.map(([to, l, I, id]) => (
            <Link key={to} to={to} data-testid={id} className="rounded-xl border bg-card p-3 flex flex-col items-center gap-1.5 text-center text-[11px] font-semibold hover:border-indigo-400 hover:-translate-y-0.5 transition-transform">
              <span className="h-9 w-9 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 grid place-items-center"><I className="h-4 w-4" /></span>{l}
            </Link>
          ))}
        </div>
        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Data Internal · Pengiriman Hari Ini</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={Package} label="Diproses" value={s.diproses} color="#7c3aed" testId="dash-kpi-diproses" />
            <KpiCard icon={AlertTriangle} label="Beresiko" value={s.beresiko} color="#f97316" testId="dash-kpi-beresiko" />
            <KpiCard icon={Truck} label="Terkirim" value={s.terkirim} color="#10b981" testId="dash-kpi-terkirim" />
            <KpiCard icon={Package} label="Perlu Dikirim" value={s.perlu_dikirim} color="#e11d48" testId="dash-kpi-perlu" />
          </div>
        </section>
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="p-4 lg:col-span-2" data-testid="dash-trend-chart">
            <p className="font-bold mb-3">Tren 7 Hari Paket</p>
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={d?.trend || []}>
                  <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c3aed" stopOpacity={0.4} /><stop offset="100%" stopColor="#7c3aed" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="tanggal" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip />
                  <Area type="monotone" dataKey="diproses" name="Diproses" stroke="#7c3aed" fill="url(#g1)" strokeWidth={2} />
                  <Area type="monotone" dataKey="terkirim" name="Terkirim" stroke="#10b981" fill="transparent" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Data Internal · Gudang</p>
            <KpiCard icon={Boxes} label="Total SKU" value={d?.gudang.total_sku} color="#4f46e5" testId="dash-total-sku" />
            <KpiCard icon={AlertTriangle} label="Perlu Restock" value={d?.gudang.restock} color="#ef4444" testId="dash-restock" />
            <Card className="p-4"><p className="text-xs text-muted-foreground">Nilai Stok (HPP)</p><p className="text-xl font-extrabold" data-testid="dash-nilai-stok">{rupiah(d?.gudang.nilai_stok)}</p></Card>
          </div>
        </div>
        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Marketplace Online (Demo) & Penjualan</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={Store} label="Toko Terhubung" value={d?.marketplace.stores} color="#0ea5e9" testId="dash-mp-stores" />
            <KpiCard icon={ShoppingBag} label="Pesanan Perlu Dikirim" value={d?.marketplace.perlu_dikirim} color="#f97316" testId="dash-mp-orders" />
            <KpiCard icon={MessagesSquare} label="Chat Belum Dibaca" value={d?.marketplace.unread_chats} color="#db2777" testId="dash-mp-chats" />
            <Card className="p-4 border-t-4 border-t-emerald-500"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="h-4 w-4" /> Omzet POS Hari Ini</div><p className="text-xl font-extrabold mt-1" data-testid="dash-pos-omzet">{rupiah(d?.pos_today.omzet)}</p><p className="text-[11px] text-muted-foreground">{d?.pos_today.count || 0} transaksi</p></Card>
          </div>
        </section>
      </div>
    </div>
  );
}
