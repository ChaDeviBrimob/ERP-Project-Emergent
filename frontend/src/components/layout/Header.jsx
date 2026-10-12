import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { PanelLeft, Calculator, CalendarDays, LayoutGrid, Truck, Moon, Sun, LogOut, Download, UserCircle2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import LiveClock from "@/components/layout/LiveClock";
import CalculatorDialog from "@/components/layout/CalculatorDialog";
import NotificationBell from "@/components/layout/NotificationBell";
import { useAuth } from "@/context/AuthContext";

function IconBtn({ children, ...p }) {
  return <button className="h-9 w-9 grid place-items-center rounded-lg hover:bg-white/10 transition-colors" {...p}>{children}</button>;
}

function useInstallPrompt() {
  const [evt, setEvt] = useState(null);
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setEvt(e); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  return evt;
}

export default function Header({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [calc, setCalc] = useState(false);
  const [q, setQ] = useState("");
  const [dark, setDark] = useState(document.documentElement.classList.contains("dark"));
  const install = useInstallPrompt();

  const toggleDark = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setDark(next);
  };
  const search = (e) => {
    e.preventDefault();
    navigate(`/gudang/produk?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="sticky top-0 z-40 erp-gradient text-white shadow-md" data-testid="app-header">
      <div className="flex items-center gap-2 px-3 sm:px-4 h-14">
        <Link to="/" className="flex items-center gap-2 font-bold text-sm sm:text-base whitespace-nowrap" data-testid="header-brand">
          PT. VRCHINDO Digital <span className="h-2 w-2 rounded-full bg-emerald-400 pulse-dot" />
        </Link>
        <IconBtn onClick={onToggleSidebar} data-testid="header-sidebar-toggle"><PanelLeft className="h-4 w-4" /></IconBtn>
        <form onSubmit={search} className="hidden md:block flex-1 max-w-xl">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari Produk (SKU / Nama)..." className="w-full h-9 rounded-lg bg-white text-slate-900 px-3 text-sm outline-none focus:ring-2 focus:ring-white/60" data-testid="header-search-input" />
        </form>
        <div className="flex-1 md:hidden" />
        <div className="flex items-center gap-1">
          <IconBtn onClick={() => setCalc(true)} data-testid="header-calculator-button" title="Kalkulator"><Calculator className="h-4 w-4" /></IconBtn>
          <Popover>
            <PopoverTrigger asChild>
              <button className="hidden sm:grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10" data-testid="header-calendar-button" title="Kalender"><CalendarDays className="h-4 w-4" /></button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0"><Calendar mode="single" selected={new Date()} /></PopoverContent>
          </Popover>
          <Link to="/pos" className="hidden lg:flex items-center gap-1.5 h-9 px-3 rounded-lg hover:bg-white/10 text-sm font-semibold" data-testid="header-pos-link"><LayoutGrid className="h-4 w-4" /> POS</Link>
          <Link to="/pengiriman?tab=process" className="hidden lg:flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-semibold" data-testid="header-shipping-link"><Truck className="h-4 w-4" /> Pengiriman Paket</Link>
          <LiveClock />
          <IconBtn onClick={toggleDark} data-testid="header-theme-toggle" title="Dark mode">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</IconBtn>
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 h-9 px-2 rounded-lg hover:bg-white/10 text-sm font-semibold" data-testid="header-user-menu">
                {user?.picture ? <img src={user.picture} alt="" className="h-6 w-6 rounded-full" /> : <UserCircle2 className="h-5 w-5" />}
                <span className="hidden xl:inline max-w-[140px] truncate">{user?.name}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="text-sm">{user?.name}</p>
                <p className="text-xs text-muted-foreground font-normal">{user?.email} · {user?.role}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {install && <DropdownMenuItem onClick={() => install.prompt()} data-testid="install-app-button"><Download className="h-4 w-4 mr-2" /> Install Aplikasi</DropdownMenuItem>}
              <DropdownMenuItem onClick={async () => { await logout(); navigate("/login"); }} data-testid="logout-button"><LogOut className="h-4 w-4 mr-2" /> Keluar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <CalculatorDialog open={calc} onOpenChange={setCalc} />
    </header>
  );
}
