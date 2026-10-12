from datetime import datetime, timedelta
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from core import db, NO_ID, now_iso, new_id, get_current_user
from logic import stock_fields
from routes_shipping import kpi_counts, WIB
from routes_gudang import with_calc

router = APIRouter(prefix="/api")


def strip(d):
    return {k: v for k, v in d.items() if k != "_id"}


class CartItem(BaseModel):
    sku: str
    qty: int


class CheckoutIn(BaseModel):
    items: List[CartItem]
    diskon: float = 0
    metode: str = "Cash"
    bayar: float = 0


@router.get("/notifications")
async def notifications(_=Depends(get_current_user)):
    items = await db.notifications.find({}, NO_ID).sort("created_at", -1).to_list(50)
    return {"items": [strip(i) for i in items], "unread": await db.notifications.count_documents({"read": False})}


@router.post("/notifications/read-all")
async def read_all(_=Depends(get_current_user)):
    await db.notifications.update_many({"read": False}, {"$set": {"read": True}})
    return {"ok": True}


@router.post("/notifications/{nid}/read")
async def read_one(nid: str, _=Depends(get_current_user)):
    await db.notifications.update_one({"id": nid}, {"$set": {"read": True}})
    return {"ok": True}


@router.post("/pos/checkout")
async def checkout(body: CheckoutIn, user=Depends(get_current_user)):
    if not body.items:
        raise HTTPException(400, "Keranjang kosong")
    lines = []
    for it in body.items:
        p = await db.products.find_one({"sku": it.sku}, NO_ID)
        if not p or it.qty <= 0:
            raise HTTPException(400, f"SKU {it.sku} tidak valid")
        if stock_fields(p)["stok_riil"] < it.qty:
            raise HTTPException(400, f"Stok {p['nama']} tidak cukup")
        lines.append({"sku": p["sku"], "nama": p["nama"], "qty": it.qty, "harga": p["harga_jual"]})
    subtotal = sum(l["qty"] * l["harga"] for l in lines)
    total = max(subtotal - body.diskon, 0)
    if body.metode == "Cash" and body.bayar < total:
        raise HTTPException(400, "Uang bayar kurang")
    for l in lines:
        await db.products.update_one({"sku": l["sku"]}, {"$inc": {"stock_out": l["qty"]}})
    count = await db.pos_transactions.count_documents({}) + 1
    doc = {"id": new_id("pos"), "invoice": f"INV-{datetime.now(WIB):%Y%m%d}-{count:03d}", "items": lines,
           "subtotal": subtotal, "diskon": body.diskon, "total": total, "metode": body.metode,
           "bayar": body.bayar, "kembali": max(body.bayar - total, 0), "operator": user["name"], "created_at": now_iso()}
    await db.pos_transactions.insert_one(doc)
    return strip(doc)


@router.get("/pos/history")
async def pos_history(_=Depends(get_current_user)):
    return [strip(d) for d in await db.pos_transactions.find({}, NO_ID).sort("created_at", -1).to_list(200)]


@router.get("/dashboard")
async def dashboard(_=Depends(get_current_user)):
    today = datetime.now(WIB).date()
    days = [(today - timedelta(days=i)).isoformat() for i in range(6, -1, -1)]
    trend = []
    for d in days:
        k = await kpi_counts(d, d)
        trend.append({"tanggal": d[5:], "diproses": k["diproses"], "terkirim": k["terkirim"], "cancel": k["cancel"]})
    products = [with_calc(p) for p in await db.products.find({}, NO_ID).to_list(5000)]
    start_utc = datetime.fromisoformat(today.isoformat()).replace(tzinfo=WIB).isoformat()
    pos_today = await db.pos_transactions.find({"created_at": {"$gte": start_utc}}, NO_ID).to_list(1000)
    return {
        "shipping_today": await kpi_counts(today.isoformat(), today.isoformat()),
        "trend": trend,
        "gudang": {"total_sku": len(products), "total_stok": sum(p["stok_riil"] for p in products),
                   "nilai_stok": sum(p["nilai_stok"] for p in products),
                   "restock": sum(1 for p in products if p["status_stok"] == "RESTOCK !!")},
        "marketplace": {"perlu_dikirim": await db.mp_orders.count_documents({"status": "Perlu Dikirim"}),
                        "unread_chats": await db.mp_chats.count_documents({"unread": {"$gt": 0}}),
                        "stores": await db.mp_stores.count_documents({"connected": True})},
        "pos_today": {"count": len(pos_today), "omzet": sum(t["total"] for t in pos_today)},
    }
