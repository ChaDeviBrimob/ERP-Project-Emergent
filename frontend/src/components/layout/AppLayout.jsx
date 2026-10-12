import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Home, ScanBarcode, Package, MessagesSquare, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import Header from "@/components/layout/Header";
import SidebarNav from "@/components/layout/SidebarNav";

const BOTTOM = [
  { to: "/", icon: Home, label: "Beranda", id: "home" },
  { to: "/pengiriman?tab=process", icon: ScanBarcode, label: "Scan", id: "scan" },
  { to: "/gudang/produk", icon: Package, label: "Gudang", id: "gudang" },
  { to: "/marketplace/chat", icon: MessagesSquare, label: "Chat", id: "chat" },
];

function BottomNav({ onMenu }) {
  const { pathname } = useLocation();
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t grid grid-cols-5 pb-[env(safe-area-inset-bottom)]" data-testid="bottom-nav">
      {BOTTOM.map(({ to, icon: Icon, label, id }) => {
        const active = pathname === to.split("?")[0];
        return (
          <Link key={id} to={to} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`} data-testid={`bottom-nav-${id}`}>
            <Icon className="h-5 w-5" />{label}
          </Link>
        );
      })}
      <button onClick={onMenu} className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold text-muted-foreground" data-testid="bottom-nav-menu">
        <Menu className="h-5 w-5" />Menu
      </button>
    </nav>
  );
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggle = () => (window.innerWidth < 1024 ? setMobileOpen(true) : setCollapsed((c) => !c));
  return (
    <div className="min-h-screen bg-background">
      <Header onToggleSidebar={toggle} />
      <div className="flex">
        <aside className={`hidden lg:block shrink-0 border-r bg-[hsl(var(--sidebar))] sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto transition-[width] duration-200 ${collapsed ? "w-0 border-0" : "w-64"}`} data-testid="sidebar">
          <SidebarNav />
        </aside>
        <main className="flex-1 min-w-0 pb-24 lg:pb-8" data-testid="main-content">
          <Outlet />
          <footer className="hidden lg:flex justify-between px-6 pt-8 text-[11px] text-muted-foreground">
            <span>Copyright © {new Date().getFullYear()} All rights reserved. · V1.0</span>
            <span>PT. VRCHINDO Digital Solutions</span>
          </footer>
        </main>
      </div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-72 overflow-y-auto">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      <BottomNav onMenu={() => setMobileOpen(true)} />
    </div>
  );
}
