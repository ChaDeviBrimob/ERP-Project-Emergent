import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MessagesSquare, Send, ArrowLeft } from "lucide-react";
import { PageBanner, Card, StatusBadge } from "@/components/common/ui";
import { DemoNotice } from "@/pages/mp/Stores";
import { StoreFilter } from "@/pages/mp/Orders";
import { api, errMsg } from "@/lib/api";
import { wib } from "@/lib/fmt";

const QUICK = ["Halo kak, terima kasih sudah menghubungi kami 🙏", "Barang ready kak, silakan diorder", "Pesanan kakak sudah kami proses dan segera dikirim", "Mohon ditunggu ya kak, resi akan update maksimal 1x24 jam"];

function Conversation({ chat, onBack, onSent }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);
  const send = async (t) => {
    const v = t ?? text;
    if (!v.trim()) return;
    try {
      await api.post(`/mp/chats/${chat.id}/reply`, { text: v });
      setText("");
      onSent();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  return (
    <div className="flex flex-col h-full" data-testid="chat-conversation">
      <div className="flex items-center gap-3 p-3 border-b">
        <button className="lg:hidden" onClick={onBack} data-testid="chat-back-button"><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex-1 min-w-0"><p className="font-bold truncate">{chat.buyer}</p><p className="text-xs text-muted-foreground">{chat.marketplace} · {chat.nama_toko}</p></div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/30">
        {chat.messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === "seller" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.from === "seller" ? "bg-indigo-600 text-white rounded-br-sm" : "bg-card border rounded-bl-sm"}`} data-testid={`chat-message-${i}`}>
              <p>{m.text}</p>
              <p className={`text-[10px] mt-1 ${m.from === "seller" ? "text-white/70" : "text-muted-foreground"}`}>{wib(m.at).waktu}{m.by ? ` · ${m.by}` : ""}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="p-3 border-t space-y-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {QUICK.map((q, i) => <button key={i} onClick={() => send(q)} className="shrink-0 rounded-full border px-3 py-1 text-[11px] hover:bg-accent" data-testid={`chat-quick-reply-${i}`}>{q.slice(0, 32)}…</button>)}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis balasan..." className="flex-1 h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-400" data-testid="chat-reply-input" />
          <button type="submit" className="h-10 w-10 rounded-lg bg-indigo-600 text-white grid place-items-center" data-testid="chat-send-button"><Send className="h-4 w-4" /></button>
        </form>
      </div>
    </div>
  );
}

export default function Chat() {
  const [chats, setChats] = useState([]);
  const [store, setStore] = useState("all");
  const [activeId, setActiveId] = useState(null);
  const load = useCallback(() => {
    api.get("/mp/chats", { params: { store_id: store === "all" ? "" : store } }).then((r) => setChats(r.data));
  }, [store]);
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);
  const openChat = async (c) => {
    setActiveId(c.id);
    if (c.unread) {
      await api.post(`/mp/chats/${c.id}/read`);
      load();
    }
  };
  const active = chats.find((c) => c.id === activeId);

  return (
    <div data-testid="chat-page">
      <PageBanner icon={MessagesSquare} title="Chat Pembeli" subtitle="Marketplace Online · Inbox gabungan semua akun toko" />
      <div className="p-3 sm:p-5 space-y-4">
        <DemoNotice />
        <Card className="grid lg:grid-cols-[340px_1fr] h-[calc(100vh-19rem)] min-h-[460px] overflow-hidden">
          <div className={`border-r flex flex-col ${active ? "hidden lg:flex" : "flex"}`}>
            <div className="p-3 border-b"><StoreFilter value={store} onChange={setStore} /></div>
            <div className="flex-1 overflow-y-auto">
              {chats.map((c) => {
                const last = c.messages[c.messages.length - 1];
                return (
                  <button key={c.id} onClick={() => openChat(c)} data-testid={`chat-item-${c.id}`} className={`w-full text-left p-3 border-b flex gap-3 hover:bg-accent ${activeId === c.id ? "bg-accent" : ""}`}>
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white grid place-items-center font-bold shrink-0">{c.buyer[0]}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2"><p className="font-semibold text-sm truncate">{c.buyer}</p><span className="text-[10px] text-muted-foreground">{wib(c.updated_at).waktu.slice(0, 5)}</span></div>
                      <div className="flex items-center gap-1 mt-0.5"><StatusBadge value={c.marketplace} /><span className="text-[11px] text-muted-foreground truncate">{c.nama_toko}</span></div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{last?.text}</p>
                    </div>
                    {c.unread > 0 && <span className="h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center" data-testid={`chat-unread-${c.id}`}>{c.unread}</span>}
                  </button>
                );
              })}
              {chats.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Belum ada chat</p>}
            </div>
          </div>
          <div className={`${active ? "flex" : "hidden lg:flex"} flex-col min-h-0`}>
            {active ? <Conversation chat={active} onBack={() => setActiveId(null)} onSent={load} /> : <div className="m-auto text-sm text-muted-foreground">Pilih percakapan</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
