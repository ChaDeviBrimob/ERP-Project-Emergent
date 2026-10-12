import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/common/ui";
import { api, downloadFile } from "@/lib/api";

function Breakdown({ title, rows, testId }) {
  return (
    <Card className="p-4" data-testid={testId}>
      <p className="font-bold mb-3">{title}</p>
      <table className="w-full text-xs">
        <thead><tr className="text-muted-foreground uppercase text-[10px] tracking-wider"><th className="text-left py-1">Nama</th><th className="text-right">Diproses</th><th className="text-right">Terkirim</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t"><td className="py-1.5 font-medium">{r.name}</td><td className="text-right tabular-nums">{r.diproses}</td><td className="text-right tabular-nums">{r.terkirim}</td></tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">Belum ada data</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

export default function ShippingReport({ start, end, refreshKey, full }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get("/shipping/report", { params: { start, end } }).then((r) => setData(r.data));
  }, [start, end, refreshKey]);
  if (!data) return null;
  return (
    <div className="space-y-4">
      <Card className="p-4" data-testid="shipping-trend-chart">
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold">Tren Harian Paket</p>
          {full && (
            <div className="flex gap-2">
              {["process", "pengiriman", "cancel", "rts"].map((s) => (
                <Button key={s} size="sm" variant="outline" onClick={() => downloadFile(`/shipping/export?submenu=${s}&start=${start}&end=${end}`, `laporan_${s}.csv`)} data-testid={`report-export-${s}`}>
                  <Download className="h-3.5 w-3.5 mr-1" />{s}
                </Button>
              ))}
            </div>
          )}
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={data.by_day}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="tanggal" fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="diproses" name="Diproses" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              <Bar dataKey="terkirim" name="Terkirim" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div className="grid md:grid-cols-3 gap-4">
        <Breakdown title="Per Expedisi" rows={data.by_expedisi} testId="report-by-expedisi" />
        <Breakdown title="Per Marketplace" rows={data.by_marketplace} testId="report-by-marketplace" />
        {full && <Breakdown title="Per Akun" rows={data.by_akun} testId="report-by-akun" />}
      </div>
    </div>
  );
}
