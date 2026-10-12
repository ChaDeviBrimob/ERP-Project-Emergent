import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import { wib } from "@/lib/fmt";

export default function NotificationBell() {
  const [data, setData] = useState({ items: [], unread: 0 });
  const navigate = useNavigate();
  const load = useCallback(() => {
    api.get("/notifications").then((r) => setData(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const open = async (n) => {
    await api.post(`/notifications/${n.id}/read`);
    load();
    if (n.link) navigate(n.link);
  };
  const readAll = async () => {
    await api.post("/notifications/read-all");
    load();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative h-9 w-9 grid place-items-center rounded-lg hover:bg-white/10" data-testid="header-notification-button">
          <Bell className="h-4 w-4" />
          {data.unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-[10px] font-bold grid place-items-center px-1" data-testid="notification-count">{data.unread > 99 ? "99+" : data.unread}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" data-testid="notification-panel">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm">Notifikasi</p>
          <button className="text-xs text-primary font-semibold" onClick={readAll} data-testid="notification-read-all">Tandai semua dibaca</button>
        </div>
        <div className="max-h-80 overflow-auto">
          {data.items.length === 0 && <p className="p-4 text-sm text-muted-foreground">Belum ada notifikasi</p>}
          {data.items.map((n) => (
            <button key={n.id} onClick={() => open(n)} className={`w-full text-left px-4 py-3 border-b last:border-0 hover:bg-accent ${n.read ? "" : "bg-indigo-50/60 dark:bg-indigo-500/10"}`} data-testid={`notification-item-${n.id}`}>
              <p className="text-sm font-semibold">{n.title}</p>
              <p className="text-xs text-muted-foreground">{n.message}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{wib(n.created_at).tanggal} {wib(n.created_at).waktu}</p>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
