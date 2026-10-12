export const rupiah = (n) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");

const TZ = "Asia/Jakarta";
export function wib(iso) {
  if (!iso) return { hari: "-", tanggal: "-", waktu: "-" };
  const d = new Date(iso);
  return {
    hari: d.toLocaleDateString("id-ID", { weekday: "long", timeZone: TZ }),
    tanggal: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ }),
    waktu: d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: TZ }),
  };
}

export function todayWIB(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

const TONES = [
  [/JANGAN|DOUBLE|NOT VALID|BATAL|RESTOCK|DEAD|CEK|DIBATALKAN|TERPUTUS|SPASI/i, "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30"],
  [/SEGERA|BERESIKO|NEED|PENGAJUAN|URGENT|SLOW|SUSAH|Perlu|RTS|Belum/i, "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30"],
  [/TERKIRIM|AMAN|Pickup|DROPPED|Selesai|PUBLISHED|TERHUBUNG|DITERIMA GUDANG|Disiapkan/i, "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"],
  [/PROCESS|NEW|Dikirim|MENARIK/i, "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30"],
];
export function tone(text) {
  const t = String(text || "");
  for (const [re, cls] of TONES) if (re.test(t)) return cls;
  return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30";
}

export function beep(ok = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 1200 : 320;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.12 : 0.4));
  } catch (e) {
    /* audio not available */
  }
}

export const MP_COLORS = {
  SHOPEE: "bg-orange-500", TOKOPEDIA: "bg-green-600", "TIKTOK SHOP": "bg-slate-900", LAZADA: "bg-blue-700",
};
