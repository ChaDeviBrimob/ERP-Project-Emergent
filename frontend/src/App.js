import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { AuthCallback, ProtectedRoute } from "@/components/auth/AuthGuards";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/gudang/Products";
import StockAdjust from "@/pages/gudang/StockAdjust";
import Shipping from "@/pages/shipping/Shipping";
import Stores from "@/pages/mp/Stores";
import Orders from "@/pages/mp/Orders";
import Chat from "@/pages/mp/Chat";
import MpProducts from "@/pages/mp/MpProducts";
import Promos from "@/pages/mp/Promos";
import Pos from "@/pages/Pos";
import Users from "@/pages/Users";

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/gudang/produk" element={<Products />} />
        <Route path="/gudang/penyesuaian" element={<StockAdjust />} />
        <Route path="/pengiriman" element={<Shipping />} />
        <Route path="/marketplace/toko" element={<Stores />} />
        <Route path="/marketplace/pesanan" element={<Orders />} />
        <Route path="/marketplace/chat" element={<Chat />} />
        <Route path="/marketplace/produk" element={<MpProducts />} />
        <Route path="/marketplace/promo" element={<Promos />} />
        <Route path="/pos" element={<Pos />} />
        <Route path="/pengguna" element={<ProtectedRoute admin><Users /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}

function App() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    if (localStorage.getItem("theme") === "dark") {
      document.documentElement.classList.add("dark");
    }
  }, []);
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
