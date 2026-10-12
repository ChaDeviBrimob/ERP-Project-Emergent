import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Users as UsersIcon, Plus, Trash2, Pencil, Eye, EyeOff, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageBanner, Card, StatusBadge } from "@/components/common/ui";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { wib } from "@/lib/fmt";

const EMPTY = { email: "", name: "", role: "staff", password: "" };

export function PasswordField({ value, onChange, testId }) {
  const [show, setShow] = useState(false);
  const gen = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#";
    onChange(Array.from(crypto.getRandomValues(new Uint32Array(10)), (n) => chars[n % chars.length]).join(""));
    setShow(true);
  };
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} className="pr-9 font-mono" data-testid={testId} />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" data-testid={`${testId}-toggle`}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
      </div>
      <Button type="button" variant="outline" size="sm" className="h-10" onClick={gen} data-testid={`${testId}-generate`}><Wand2 className="h-4 w-4 mr-1" /> Buat</Button>
    </div>
  );
}

function EditUserDialog({ user, isSelf, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  useEffect(() => {
    setForm(user ? { name: user.name, email: user.email, role: user.role, password: "" } : null);
  }, [user]);
  if (!form) return null;
  const save = async () => {
    try {
      const body = { name: form.name, email: form.email, password: form.password || null };
      if (!isSelf) body.role = form.role;
      await api.patch(`/users/${user.user_id}`, body);
      toast.success(form.password ? `Data & password ${form.email} diperbarui. Password baru: ${form.password}` : "Data pengguna diperbarui", { duration: 10000 });
      onSaved();
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="user-edit-dialog">
        <DialogHeader><DialogTitle>Edit Pengguna</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label className="text-xs">Nama</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="user-edit-name-input" /></div>
          <div className="space-y-1"><Label className="text-xs">Email / Username Login</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="user-edit-email-input" /></div>
          {!isSelf && (
            <div className="space-y-1"><Label className="text-xs">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="user-edit-role-select"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="staff">staff</SelectItem><SelectItem value="admin">admin</SelectItem></SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Password Baru (kosongkan bila tidak diganti)</Label>
            <PasswordField value={form.password} onChange={(v) => setForm({ ...form, password: v })} testId="user-edit-password-input" />
            <p className="text-[11px] text-muted-foreground">Demi keamanan, password lama tersimpan terenkripsi sehingga tidak bisa ditampilkan. Admin bisa menggantinya dengan password baru, yang akan tampil sekali setelah disimpan.</p>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={!form.name || !form.email} data-testid="user-edit-save-button">Simpan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState([]);
  const [f, setF] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = useCallback(() => {
    api.get("/users").then((r) => setRows(r.data));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    try {
      await api.post("/users", { ...f, password: f.password || null });
      toast.success(f.password ? `Pengguna dibuat. Login: ${f.email} / ${f.password}` : "Pengguna dibuat (login Google)", { duration: 10000 });
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
            <thead><tr className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">{["Nama", "Email", "Role", "Password", "Login Terakhir", "Aktif", ""].map((h) => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
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
                  <td className="px-4 py-3 text-xs">{u.has_password ? <span className="font-mono" data-testid={`user-password-${u.email}`}>•••••••• <span className="text-muted-foreground font-sans">{u.password_updated_at ? `(diganti ${wib(u.password_updated_at).tanggal})` : "(terset)"}</span></span> : <span className="text-muted-foreground">Hanya Google</span>}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">{u.last_login ? `${wib(u.last_login).tanggal} ${wib(u.last_login).waktu}` : "-"}</td>
                  <td className="px-4 py-3"><Switch checked={u.active} disabled={u.user_id === me.user_id} onCheckedChange={(v) => patch(u, { active: v })} data-testid={`user-active-${u.email}`} /></td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button className="mr-3 hover:text-indigo-600" onClick={() => setEdit(u)} data-testid={`user-edit-${u.email}`}><Pencil className="h-4 w-4" /></button>
                    {u.user_id !== me.user_id && <button className="text-red-500" onClick={() => del(u)} data-testid={`user-delete-${u.email}`}><Trash2 className="h-4 w-4" /></button>}
                  </td>
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
              <div className="space-y-1"><Label className="text-xs">Password (kosongkan bila hanya login Google)</Label><PasswordField value={f.password} onChange={(v) => setF({ ...f, password: v })} testId="user-password-input" /></div>
            </div>
            <DialogFooter><Button onClick={create} disabled={!f.email || !f.name} data-testid="user-save-button">Simpan</Button></DialogFooter>
          </DialogContent>
        )}
      </Dialog>
      <EditUserDialog user={edit} isSelf={edit?.user_id === me.user_id} onClose={() => setEdit(null)} onSaved={load} />
    </div>
  );
}
