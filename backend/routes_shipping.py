import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from core import db, NO_ID, now, now_iso, new_id, get_current_user, require_admin, notify
from logic import (detect, STATUS_PROCESS, STATUS_SEGERA, STATUS_TERKIRIM, STATUS_JANGAN, STATUS_NEED,
                   WARN_DOUBLE, WARN_RISK, WARN_BATAL, RISK_HOURS, BATAL_HOURS, TINDAKAN, RTS_STATUS)
from routes_gudang import parse_upload, pick

router = APIRouter(prefix="/api/shipping")
WIB = timezone(timedelta(hours=7))
SUBMENUS = ("process", "pengiriman", "cancel", "rts")
ACTIVE_CANCEL = ("PENGAJUAN CANCEL", "PEMBATALAN DITERIMA")


class ScanIn(BaseModel):
    resi: str
    submenu: str
    akun: Optional[str] = None
    tindakan: Optional[str] = None


class PatchIn(BaseModel):
    akun: Optional[str] = None
    expedisi: Optional[str] = None
    marketplace: Optional[str] = None
    tindakan: Optional[str] = None
    status: Optional[str] = None


def wib_range(start: str, end: str):
    flt = {}
    if start:
        flt["$gte"] = datetime.fromisoformat(start).replace(tzinfo=WIB).astimezone(timezone.utc).isoformat()
    if end:
        e = datetime.fromisoformat(end).replace(tzinfo=WIB) + timedelta(days=1)
        flt["$lt"] = e.astimezone(timezone.utc).isoformat()
    return {"created_at": flt} if flt else {}


async def cancel_of(resi):
    c = await db.packages.find_one({"submenu": "cancel", "no_resi": resi}, NO_ID, sort=[("created_at", -1)])
    return c.get("tindakan") if c else None


def view_fields(base_status, base_warning, tindakan):
    if tindakan == "PEMBATALAN DITERIMA":
        return STATUS_JANGAN, tindakan
    if tindakan == "PENGAJUAN CANCEL":
        return base_status, tindakan
    return base_status, base_warning


async def auto_update():
    t = now()
    common = {"submenu": "process", "base_status": {"$in": [STATUS_PROCESS, STATUS_SEGERA]}}
    c24 = (t - timedelta(hours=RISK_HOURS)).isoformat()
    c48 = (t - timedelta(hours=BATAL_HOURS)).isoformat()
    newly = await db.packages.count_documents({**common, "base_status": STATUS_PROCESS, "created_at": {"$lt": c24}})
    for cutoff, warn, extra in ((c24, WARN_RISK, {"base_warning": {"$nin": [WARN_RISK, WARN_BATAL]}}),
                                (c48, WARN_BATAL, {"base_warning": {"$ne": WARN_BATAL}})):
        flt = {**common, "created_at": {"$lt": cutoff}, **extra}
        await db.packages.update_many({**flt, "tindakan": {"$nin": list(ACTIVE_CANCEL)}},
                                      {"$set": {"base_status": STATUS_SEGERA, "base_warning": warn,
                                                "status": STATUS_SEGERA, "warning": warn, "keterangan": "SEGERA KIRIMKAN"}})
        await db.packages.update_many({**flt, "tindakan": {"$in": list(ACTIVE_CANCEL)}},
                                      {"$set": {"base_status": STATUS_SEGERA, "base_warning": warn}})
    if newly:
        await notify("risk", "Paket Beresiko Terlambat", f"{newly} paket melewati {RISK_HOURS} jam belum dikirim",
                     "/pengiriman?tab=beresiko")


async def sync_cancel(resi, tindakan):
    async for r in db.packages.find({"no_resi": resi, "submenu": {"$in": ["process", "pengiriman"]}}, NO_ID):
        status, warning = view_fields(r["base_status"], r.get("base_warning", ""), tindakan)
        await db.packages.update_one({"id": r["id"]}, {"$set": {"status": status, "warning": warning,
                                                                "tindakan": tindakan}})


async def withdrawn_status(resi):
    for sub in ("pengiriman", "process", "rts"):
        r = await db.packages.find_one({"submenu": sub, "no_resi": resi, "is_duplicate": False}, NO_ID)
        if r:
            return r["base_status"]
    return "-"


async def do_scan(body: ScanIn, user):
    raw = body.resi.rstrip()
    resi = raw.strip().upper()
    if not resi:
        raise HTTPException(400, "Resi/barcode wajib diisi")
    if len(resi) < 3 or len(resi) > 100:
        raise HTTPException(400, "Panjang resi harus 3-100 karakter")
    if body.submenu not in SUBMENUS:
        raise HTTPException(400, "Submenu tidak valid")
    expedisi, marketplace = detect(raw)
    dup_count = await db.packages.count_documents({"submenu": body.submenu, "no_resi": resi})
    tindakan = await cancel_of(resi)
    akun = body.akun or ""
    prev = await db.packages.find_one({"no_resi": resi, "akun": {"$nin": ["", None]}}, NO_ID)
    if not akun and prev:
        akun = prev["akun"]
    alert = None
    doc = {"id": new_id("pkg"), "no_resi": resi, "submenu": body.submenu, "expedisi": expedisi,
           "marketplace": marketplace, "akun": akun, "drop_off": "", "tindakan": tindakan or "",
           "is_duplicate": dup_count > 0, "duplicate_count": dup_count, "user_id": user["user_id"],
           "operator": user["name"], "created_at": now_iso()}
    invalid = expedisi == "RESI NOT VALID"

    if body.submenu == "process":
        if dup_count or invalid:
            base_s, base_w, ket = STATUS_JANGAN, WARN_DOUBLE if dup_count else "RESI NOT VALID", "DOUBLE !!" if dup_count else "RESI NOT VALID"
        else:
            base_s, base_w, ket = STATUS_PROCESS, "", "Sudah Disiapkan"
    elif body.submenu == "pengiriman":
        proc = await db.packages.find_one({"submenu": "process", "no_resi": resi, "is_duplicate": False}, NO_ID)
        if not proc:
            raise HTTPException(400, "Resi belum ada di Scan Process Pesanan. Proses terlebih dahulu.")
        doc.update({"expedisi": proc["expedisi"], "marketplace": proc["marketplace"], "akun": akun or proc.get("akun", "")})
        if dup_count:
            base_s, base_w, ket = STATUS_JANGAN, WARN_DOUBLE, "DOUBLE !!"
        else:
            base_s, base_w, ket = STATUS_TERKIRIM, "", "Sudah di Pickup"
            doc["drop_off"] = "DROPPED OFF"
            p_status, p_warn = view_fields(STATUS_TERKIRIM, "", tindakan)
            await db.packages.update_many({"submenu": "process", "no_resi": resi, "is_duplicate": False},
                                          {"$set": {"base_status": STATUS_TERKIRIM, "base_warning": "", "status": p_status,
                                                    "warning": p_warn, "keterangan": "Sudah di Pickup",
                                                    "drop_off": "DROPPED OFF", "shipped_at": now_iso()}})
    elif body.submenu == "cancel":
        t = body.tindakan or "PENGAJUAN CANCEL"
        if t not in TINDAKAN:
            raise HTTPException(400, "Tindakan tidak valid")
        doc["tindakan"] = t
        base_s = STATUS_NEED if t == "PENGAJUAN CANCEL" else STATUS_JANGAN if t == "PEMBATALAN DITERIMA" else await withdrawn_status(resi)
        base_w, ket = t, ("DOUBLE !!" if dup_count else "Cancel Order")
        doc.update({"base_status": base_s, "base_warning": base_w, "status": base_s, "warning": base_w, "keterangan": ket})
        await db.packages.insert_one(doc)
        await sync_cancel(resi, t)
        await notify("cancel", "Pengajuan Cancel", f"Resi {resi}: {t}", "/pengiriman?tab=cancel")
        doc.pop("_id", None)
        return {"record": doc, "duplicate": dup_count > 0, "alert": None}
    else:
        shipped = await db.packages.find_one({"submenu": "pengiriman", "no_resi": resi}, NO_ID)
        base_s, base_w = "RTS - DIKEMBALIKAN", WARN_DOUBLE if dup_count else ""
        ket = "DOUBLE !!" if dup_count else ("Pernah Dikirim" if shipped else "Tidak Ditemukan di Pengiriman")

    status, warning = view_fields(base_s, base_w, tindakan) if body.submenu != "rts" else (base_s, base_w)
    doc.update({"base_status": base_s, "base_warning": base_w, "status": status, "warning": warning, "keterangan": ket})
    if status == STATUS_JANGAN:
        alert = f"JANGAN DIKIRIMKAN !! ({warning or ket})"
        if dup_count:
            await notify("duplicate", "Resi Double", f"Resi {resi} discan ulang di {body.submenu}",
                         f"/pengiriman?tab={body.submenu}")
    await db.packages.insert_one(doc)
    doc.pop("_id", None)
    return {"record": doc, "duplicate": dup_count > 0, "alert": alert}


@router.post("/scan")
async def scan(body: ScanIn, user=Depends(get_current_user)):
    return await do_scan(body, user)


def build_filter(submenu, q, expedisi, start, end):
    flt = wib_range(start, end)
    if submenu == "beresiko":
        flt.update({"submenu": "process", "base_status": STATUS_SEGERA})
    elif submenu:
        flt["submenu"] = submenu
    if q:
        flt["no_resi"] = {"$regex": q.strip(), "$options": "i"}
    if expedisi:
        flt["expedisi"] = expedisi
    return flt


@router.get("/packages")
async def list_packages(submenu: str = "process", q: str = "", expedisi: str = "", start: str = "", end: str = "",
                        limit: int = 2000, _=Depends(get_current_user)):
    await auto_update()
    flt = build_filter(submenu, q, expedisi, start, end)
    docs = await db.packages.find(flt, NO_ID).sort("created_at", -1).to_list(limit)
    return [{k: v for k, v in d.items() if k != "_id"} for d in docs]


@router.patch("/packages/{pid}")
async def patch_package(pid: str, body: PatchIn, _=Depends(get_current_user)):
    rec = await db.packages.find_one({"id": pid}, NO_ID)
    if not rec:
        raise HTTPException(404, "Data tidak ditemukan")
    upd = {k: v for k, v in body.model_dump().items() if v is not None and k not in ("tindakan", "status")}
    if body.status is not None:
        if rec["submenu"] != "rts" or body.status not in RTS_STATUS:
            raise HTTPException(400, "Status hanya bisa diubah untuk Retur RTS")
        upd.update({"status": body.status, "base_status": body.status})
    if body.tindakan is not None:
        if rec["submenu"] != "cancel" or body.tindakan not in TINDAKAN:
            raise HTTPException(400, "Tindakan hanya untuk Cancel Order")
        t = body.tindakan
        s = STATUS_NEED if t == "PENGAJUAN CANCEL" else STATUS_JANGAN if t == "PEMBATALAN DITERIMA" else await withdrawn_status(rec["no_resi"])
        upd.update({"tindakan": t, "status": s, "base_status": s, "warning": t, "base_warning": t})
    await db.packages.update_one({"id": pid}, {"$set": upd})
    if body.tindakan is not None:
        await sync_cancel(rec["no_resi"], body.tindakan)
    doc = await db.packages.find_one({"id": pid}, NO_ID)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.delete("/packages/{pid}")
async def delete_package(pid: str, _=Depends(get_current_user)):
    await db.packages.delete_one({"id": pid})
    return {"ok": True}


@router.delete("/packages")
async def clear_packages(submenu: str, _=Depends(require_admin)):
    if submenu not in SUBMENUS:
        raise HTTPException(400, "Submenu tidak valid")
    res = await db.packages.delete_many({"submenu": submenu})
    return {"deleted": res.deleted_count}


async def kpi_counts(start, end):
    rng = wib_range(start, end)
    proc = {"submenu": "process", "is_duplicate": False, **rng}
    return {
        "diproses": await db.packages.count_documents({**proc, "base_status": {"$in": [STATUS_PROCESS, STATUS_SEGERA, STATUS_TERKIRIM]}}),
        "beresiko": await db.packages.count_documents({**proc, "base_status": STATUS_SEGERA}),
        "cancel": await db.packages.count_documents({"submenu": "cancel", **rng}),
        "terkirim": await db.packages.count_documents({"submenu": "pengiriman", "is_duplicate": False, "base_status": STATUS_TERKIRIM, **rng}),
        "perlu_dikirim": await db.packages.count_documents({**proc, "base_status": {"$in": [STATUS_PROCESS, STATUS_SEGERA]},
                                                            "tindakan": {"$ne": "PEMBATALAN DITERIMA"}}),
        "rts": await db.packages.count_documents({"submenu": "rts", **rng}),
        "double": await db.packages.count_documents({"is_duplicate": True, **rng}),
    }


@router.get("/kpi")
async def kpi(start: str = "", end: str = "", _=Depends(get_current_user)):
    await auto_update()
    y = (datetime.now(WIB) - timedelta(days=1)).date().isoformat()
    return {"current": await kpi_counts(start, end), "kemarin": await kpi_counts(y, y)}


@router.get("/report")
async def report(start: str = "", end: str = "", _=Depends(get_current_user)):
    rng = wib_range(start, end)
    rows = await db.packages.find({**rng, "is_duplicate": False}, NO_ID).to_list(20000)
    by_exp, by_mp, by_day, by_akun = {}, {}, {}, {}
    for r in rows:
        if r["submenu"] not in ("process", "pengiriman"):
            continue
        k = "terkirim" if r["submenu"] == "pengiriman" else "diproses"
        for bucket, key in ((by_exp, r["expedisi"]), (by_mp, r["marketplace"]), (by_akun, r.get("akun") or "-")):
            bucket.setdefault(key, {"diproses": 0, "terkirim": 0})[k] += 1
        d = datetime.fromisoformat(r["created_at"]).astimezone(WIB).date().isoformat()
        by_day.setdefault(d, {"tanggal": d, "diproses": 0, "terkirim": 0})[k] += 1
    fmt = lambda b: sorted([{"name": n, **v} for n, v in b.items()], key=lambda x: -x["diproses"])
    return {"by_expedisi": fmt(by_exp), "by_marketplace": fmt(by_mp), "by_akun": fmt(by_akun),
            "by_day": sorted(by_day.values(), key=lambda x: x["tanggal"]), "kpi": await kpi_counts(start, end)}


@router.get("/export")
async def export(submenu: str = "process", start: str = "", end: str = "", _=Depends(get_current_user)):
    cols = ["no_resi", "expedisi", "marketplace", "akun", "keterangan", "status", "warning", "tindakan", "drop_off",
            "operator", "created_at"]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([c.upper() for c in cols])
    for r in await db.packages.find(build_filter(submenu, "", "", start, end), NO_ID).sort("created_at", -1).to_list(20000):
        w.writerow([r.get(c, "") for c in cols])
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename=pengiriman_{submenu}.csv"})


@router.post("/import")
async def import_packages(submenu: str, file: UploadFile = File(...), user=Depends(get_current_user)):
    rows = parse_upload(await file.read(), file.filename)
    ok, failed = 0, []
    for r in rows:
        resi = pick(r, "resi", "awb", "barcode") or (list(r.values())[0] if r else "")
        try:
            await do_scan(ScanIn(resi=resi, submenu=submenu, akun=pick(r, "akun") or None,
                                 tindakan=pick(r, "tindakan") or None), user)
            ok += 1
        except HTTPException as e:
            failed.append({"resi": resi, "error": e.detail})
    return {"imported": ok, "failed": failed[:50], "rows": len(rows)}
