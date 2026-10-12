import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const KEYS = ["C", "⌫", "%", "/", "7", "8", "9", "*", "4", "5", "6", "-", "1", "2", "3", "+", "0", "00", ".", "="];

function evaluate(expr) {
  if (!/^[\d+\-*/.() ]+$/.test(expr)) return "Error";
  try {
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict";return (${expr})`)();
    return Number.isFinite(v) ? String(Math.round(v * 1e8) / 1e8) : "Error";
  } catch (e) {
    return "Error";
  }
}

export default function CalculatorDialog({ open, onOpenChange }) {
  const [expr, setExpr] = useState("");
  const [disc, setDisc] = useState({ harga: "", persen: "" });
  const press = (k) => {
    if (k === "C") return setExpr("");
    if (k === "⌫") return setExpr((e) => e.slice(0, -1));
    if (k === "=") return setExpr((e) => evaluate(e));
    if (k === "%") return setExpr((e) => evaluate(`(${e || 0})/100`));
    setExpr((e) => (e === "Error" ? k : e + k));
  };
  const after = Number(disc.harga || 0) * (1 - Number(disc.persen || 0) / 100);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs" data-testid="calculator-dialog">
        <DialogHeader><DialogTitle>Kalkulator</DialogTitle></DialogHeader>
        <div className="rounded-lg bg-muted px-3 py-3 text-right font-mono text-2xl font-semibold min-h-[3.25rem] break-all" data-testid="calculator-display">{expr || "0"}</div>
        <div className="grid grid-cols-4 gap-2">
          {KEYS.map((k) => (
            <button
              key={k}
              onClick={() => press(k)}
              data-testid={`calc-key-${k === "/" ? "div" : k === "*" ? "mul" : k === "+" ? "plus" : k === "-" ? "minus" : k === "=" ? "eq" : k === "." ? "dot" : k === "⌫" ? "back" : k === "%" ? "pct" : k}`}
              className={`h-11 rounded-lg text-sm font-semibold transition-transform active:scale-95 ${
                k === "=" ? "bg-emerald-500 text-white" : /[/*\-+%]/.test(k) ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200" : k === "C" ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200" : "bg-secondary hover:bg-accent"
              }`}
            >{k}</button>
          ))}
        </div>
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cek Harga Diskon</p>
          <div className="grid grid-cols-2 gap-2">
            <input className="h-9 rounded-md border bg-background px-2 text-sm" placeholder="Harga" inputMode="numeric" value={disc.harga} onChange={(e) => setDisc({ ...disc, harga: e.target.value })} data-testid="calc-discount-price" />
            <input className="h-9 rounded-md border bg-background px-2 text-sm" placeholder="Diskon %" inputMode="numeric" value={disc.persen} onChange={(e) => setDisc({ ...disc, persen: e.target.value })} data-testid="calc-discount-percent" />
          </div>
          <p className="text-sm">Harga akhir: <b data-testid="calc-discount-result">Rp {Math.round(after).toLocaleString("id-ID")}</b></p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
