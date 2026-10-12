import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { Loader2, ScanBarcode, Warehouse, Store, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const FEATURES = [
  [Warehouse, "Data Internal Gudang & Stok"],
  [ScanBarcode, "Scan Process & Pengiriman Paket"],
  [Store, "Multi-Toko Marketplace"],
  [MessagesSquare, "Chat & Pesanan dalam 1 Dashboard"],
];

export default function Login() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(location.state?.error || "");

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setUser(data.user);
      navigate("/");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const google = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-background">
      <div className="hidden lg:flex erp-gradient text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="flex items-center gap-2 font-bold text-lg">
          PT. VRCHINDO Digital Solutions <span className="h-2 w-2 rounded-full bg-emerald-400 pulse-dot" />
        </div>
        <div className="space-y-6 max-w-md fade-up">
          <h1 className="text-4xl xl:text-5xl font-extrabold leading-tight tracking-tight">Gudang, Pengiriman & Marketplace dalam satu layar.</h1>
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map(([Icon, t]) => (
              <div key={t} className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur px-3 py-2.5 text-sm">
                <Icon className="h-4 w-4 shrink-0" /> {t}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-white/60">© {new Date().getFullYear()} PT. VRCHINDO Digital Solutions</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5 fade-up" data-testid="login-form">
          <div>
            <div className="lg:hidden mb-6 erp-gradient text-white rounded-xl p-4 font-bold">PT. VRCHINDO Digital Solutions</div>
            <h2 className="text-2xl font-bold tracking-tight">Masuk ke Dashboard</h2>
            <p className="text-sm text-muted-foreground mt-1">Akun dibuat oleh Admin. Hubungi Admin bila belum punya akun.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="login-email-input" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} data-testid="login-password-input" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-md px-3 py-2" data-testid="login-error">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading} data-testid="login-submit-button">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Masuk
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />atau<span className="h-px flex-1 bg-border" /></div>
          <Button type="button" variant="outline" className="w-full" onClick={google} data-testid="login-google-button">
            <svg className="h-4 w-4 mr-2" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            Masuk dengan Google
          </Button>
        </form>
      </div>
    </div>
  );
}
