import {
  Home, Package, SlidersHorizontal, LayoutDashboard, ScanBarcode, Truck, AlertTriangle, XCircle, Undo2,
  FileBarChart, Store, ShoppingBag, MessagesSquare, Tags, BadgePercent, Calculator as CalcIcon, Users,
} from "lucide-react";

export const NAV = [
  { label: "Dashboard", items: [{ to: "/", label: "Beranda", icon: Home, id: "beranda" }] },
  {
    label: "Data Internal · Gudang",
    items: [
      { to: "/gudang/produk", label: "Produk Gudang", icon: Package, id: "produk" },
      { to: "/gudang/penyesuaian", label: "Penyesuaian Stok", icon: SlidersHorizontal, id: "penyesuaian" },
    ],
  },
  {
    label: "Data Internal · Pengiriman",
    items: [
      { to: "/pengiriman?tab=dashboard", label: "Dashboard Pengiriman", icon: LayoutDashboard, id: "pp-dashboard" },
      { to: "/pengiriman?tab=process", label: "Scan Process Pesanan", icon: ScanBarcode, id: "pp-process" },
      { to: "/pengiriman?tab=pengiriman", label: "Scan Pengiriman Paket", icon: Truck, id: "pp-pengiriman" },
      { to: "/pengiriman?tab=beresiko", label: "Beresiko Terlambat", icon: AlertTriangle, id: "pp-beresiko" },
      { to: "/pengiriman?tab=cancel", label: "Cancel Order", icon: XCircle, id: "pp-cancel" },
      { to: "/pengiriman?tab=rts", label: "Returan Pembeli RTS", icon: Undo2, id: "pp-rts" },
      { to: "/pengiriman?tab=laporan", label: "Laporan", icon: FileBarChart, id: "pp-laporan" },
    ],
  },
  {
    label: "Marketplace Online (Demo)",
    items: [
      { to: "/marketplace/toko", label: "Akun Toko", icon: Store, id: "mp-toko" },
      { to: "/marketplace/pesanan", label: "Pesanan", icon: ShoppingBag, id: "mp-pesanan" },
      { to: "/marketplace/chat", label: "Chat Pembeli", icon: MessagesSquare, id: "mp-chat" },
      { to: "/marketplace/produk", label: "Produk & Harga", icon: Tags, id: "mp-produk" },
      { to: "/marketplace/promo", label: "Promo & Diskon", icon: BadgePercent, id: "mp-promo" },
    ],
  },
  { label: "Sales", items: [{ to: "/pos", label: "POS Kasir", icon: CalcIcon, id: "pos" }] },
  { label: "Settings", admin: true, items: [{ to: "/pengguna", label: "Mengelola Pengguna", icon: Users, id: "pengguna" }] },
];
