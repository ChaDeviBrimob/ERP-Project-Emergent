import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const done = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (done.current) {
      return;
    }
    done.current = true;
    const sid = new URLSearchParams(location.hash.slice(1)).get("session_id");
    api.post("/auth/google/session", { session_id: sid })
      .then(({ data }) => {
        setUser(data.user);
        window.history.replaceState(null, "", "/");
        navigate("/", { replace: true });
      })
      .catch((e) => {
        setUser(false);
        setError(errMsg(e));
      });
  }, [location.hash, navigate, setUser]);

  if (error) return <Navigate to="/login" replace state={{ error }} />;
  return (
    <div className="min-h-screen grid place-items-center" data-testid="auth-callback">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

export function ProtectedRoute({ children, admin = false }) {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="min-h-screen grid place-items-center" data-testid="auth-loading">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}
