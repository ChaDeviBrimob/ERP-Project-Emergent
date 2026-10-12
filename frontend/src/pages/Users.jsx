import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Users as UsersIcon, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageBanner, Card, StatusBadge } from "@/components/common/ui";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const EMPTY = { email: "", name: "", role: "staff", password: "" };

export default function Users() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState([]);
  const [f, setF] = useState(null);
  const load = useCallback(() => {
    api.get("/users").then((r) => setRows(r.data));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    try {
      await api.post("/users", { ...f, password: f.password || null });
      toast.success("Pengguna dibuat");
      setF(null);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const patch = async (u, body) => {
    try {
      await api.patch(`/users/${u.user_id}`, body);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const del = async (u) => {
    if (!window.confirm(`Hapus ${u.email}?`)) return;
    try {
      await api.delete(`/users/${u.user_id}`);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div data-testid="users-page">
      <PageBanner icon={UsersIcon} title="Mengelola Pengguna" subtitle="Hanya akun yang dibuat Admin yang bisa login (password atau Google)" right={<Button size="sm" className="bg-emerald-500 hover:bg-emerald-600" onClick={() => setF(EMPTY)} data-testid="user-add-button"><Plus className="h-4 w-4 mr-1" /> Tambah</Button>} />
      <div className="p-3 sm:p-5">
        <Card className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="users-table">
            <thead><tr className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">{["Nama", "Email", "Role", "Aktif", ""].map((h) => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.user_id} className="border-b" data-testid={`user-row-${u.email}`}>
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.user_id === me.user_id ? <StatusBadge value="ADMIN" /> : (
                      <Select value={u.role} onValueChange={(v) => patch(u, { role: v })}>
                        <SelectTrigger className="w-28 h-8" data-testid={`user-role-${u.email}`}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="admin">admin</SelectItem><SelectItem value="staff">staff</SelectItem></SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-4 py-3"><Switch checked={u.active} disabled={u.user_id === me.user_id} onCheckedChange={(v) => patch(u, { active: v })} data-testid={`user-active-${u.email}`} /></td>
                  <td className="px-4 py-3">{u.user_id !== me.user_id && <button className="text-red-500" onClick={() => del(u)} data-testid={`user-delete-${u.email}`}><Trash2 className="h-4 w-4" /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <Dialog open={!!f} onOpenChange={(o) => !o && setF(null)}>
        {f && (
          <DialogContent data-testid="user-dialog">
            <DialogHeader><DialogTitle>Tambah Pengguna</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label className="text-xs">Nama</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="user-name-input" /></div>
              <div className="space-y-1"><Label className="text-xs">Email</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="user-email-input" /></div>
              <div className="space-y-1"><Label className="text-xs">Role</Label>
                <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v })}>
                  <SelectTrigger data-testid="user-role-select"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="staff">staff</SelectItem><SelectItem value="admin">admin</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Password (kosongkan bila hanya login Google)</Label><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} data-testid="user-password-input" /></div>
            </div>
            <DialogFooter><Button onClick={create} disabled={!f.email || !f.name} data-testid="user-save-button">Simpan</Button></DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
