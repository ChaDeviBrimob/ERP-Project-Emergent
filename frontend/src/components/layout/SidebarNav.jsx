import { Link, useLocation } from "react-router-dom";
import { NAV } from "@/components/layout/nav";
import { useAuth } from "@/context/AuthContext";

function isActive(location, to) {
  const [path, qs] = to.split("?");
  if (location.pathname !== path) return false;
  if (!qs) return true;
  const want = new URLSearchParams(qs).get("tab");
  return (new URLSearchParams(location.search).get("tab") || "process") === want;
}

export default function SidebarNav({ onNavigate }) {
  const location = useLocation();
  const { user } = useAuth();
  return (
    <nav className="py-4 px-3 space-y-5" data-testid="sidebar-nav">
      {NAV.filter((g) => !g.admin || user?.role === "admin").map((g) => (
        <div key={g.label}>
          <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{g.label}</p>
          {g.items.map(({ to, label, icon: Icon, id }) => {
            const active = isActive(location, to);
            return (
              <Link
                key={to}
                to={to}
                onClick={onNavigate}
                data-testid={`nav-${id}`}
                className={`flex items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-colors ${
                  active
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm"
                    : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
