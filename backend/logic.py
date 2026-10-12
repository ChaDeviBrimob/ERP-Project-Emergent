import re

# Ordered most-specific first: (prefix, ekspedisi, marketplace)
PREFIX_RULES = [
    ("2505", "SAMEDAY", "SHOPEE"),
    ("SPX", "SPX", "SHOPEE"),
    ("SHPE", "POS REG", "SHOPEE"),
    ("TKSC", "SICEPAT HALU", None),
    ("JNE", "JNE", "JNE"),
    ("SCE", "SICEPAT", None),
    ("CM", "JNE", "SHOPEE"),
    ("JY", "JNE YES", None),
    ("TL", "JNE", "TOKPED"),
    ("JP", "J&T", None),
    ("ID", "ID Express", "SHOPEE"),
    ("TG", None, "TIKTOK"),
    ("TK", None, "TOKPED"),
    ("TP", None, "TOKPED"),
    ("25", "INSTANT", "SHOPEE"),
    ("J", None, "SHOPEE"),
]

STATUS_PROCESS = "PROCESS PACKING"
STATUS_SEGERA = "SEGERA KIRIMKAN"
STATUS_TERKIRIM = "SUDAH TERKIRIM !!"
STATUS_JANGAN = "JANGAN DIKIRIMKAN !!"
STATUS_NEED = "NEED RESPONSE"
WARN_DOUBLE = "DATA DOUBLE"
WARN_RISK = "BERESIKO TERLAMBAT"
WARN_BATAL = "BESOK BATAL"
RISK_HOURS = 24
BATAL_HOURS = 48
TINDAKAN = ["PENGAJUAN CANCEL", "MENARIK PEMBATALAN", "PEMBATALAN DITERIMA"]
RTS_STATUS = ["RTS PROCESSING", "RTS - DIKEMBALIKAN", "RTS DITERIMA GUDANG"]


def detect(resi: str):
    if resi.startswith(" "):
        return "RESI NOT VALID", "CEK SPASI RESI"
    r = resi.strip().upper()
    if re.fullmatch(r"\d{14}", r) and not r.startswith("2505"):
        return "AnterAja", "SHOPEE"
    if re.fullmatch(r"\d{12}", r) and not r.startswith("2505"):
        return "SICEPAT", "SHOPEE"
    eks, mp = None, None
    for prefix, e, m in PREFIX_RULES:
        if r.startswith(prefix):
            eks = eks or e
            mp = mp or m
            if eks and mp:
                break
    return eks or "Lainnya", mp or "CEK ULANG !!"


def stock_fields(p: dict) -> dict:
    riil = int(p.get("stok_awal", 0)) + int(p.get("stock_in", 0)) + int(p.get("return_in", 0)) - abs(int(p.get("stock_out", 0)))
    if p.get("barang_susah"):
        status = "STOCK BARANG SUSAH"
    elif int(p.get("stok_awal", 0)) == 0 and abs(int(p.get("stock_out", 0))) == 0 and int(p.get("stock_in", 0)) > 0:
        status = "NEW STOCK"
    elif riil <= int(p.get("min_stock", 0)):
        status = "RESTOCK !!"
    else:
        status = "STOCK AMAN"
    hpp, jual = float(p.get("hpp", 0)), float(p.get("harga_jual", 0))
    margin = round((jual - hpp) / jual * 100, 1) if jual else 0
    return {"stok_riil": riil, "status_stok": status, "margin": margin, "nilai_stok": riil * hpp}
