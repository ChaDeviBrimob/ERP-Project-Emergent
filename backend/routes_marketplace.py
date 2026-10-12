import random
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from core import db, NO_ID, now_iso, new_id, get_current_user, notify

router = APIRouter(prefix="/api/mp")
MARKETPLACES = ["SHOPEE", "TOKOPEDIA", "TIKTOK SHOP", "LAZADA"]
ORDER_STATUS = ["Belum Bayar", "Perlu Dikirim", "Dikirim", "Selesai", "Dibatalkan"]
RESI_PREFIX = {"SHOPEE": "SPXID", "TOKOPEDIA": "TL", "TIKTOK SHOP": "JP", "LAZADA": "LXAD"}
KURIR = {"SHOPEE": "SPX Standard", "TOKOPEDIA": "JNE REG", "TIKTOK SHOP": "J&T Express", "LAZADA": "LEX ID"}
PRINT_DEFAULT = {"paper": "100x150", "show_items": True, "show_qr": True, "show_sender": True, "show_price": False,
                 "sender_nama": "", "sender_telp": "", "sender_alamat": "", "catatan": "", "copies": 1}
CITIES = [("Jl. Melati No. 12", "Jakarta Selatan"), ("Jl. Kenanga No. 5", "Bandung"), ("Jl. Mawar No. 21", "Surabaya"),
          ("Jl. Anggrek No. 8", "Medan"), ("Jl. Dahlia No. 3", "Semarang")]


def demo_penerima(buyer):
    jalan, kota = random.choice(CITIES)
    return {"nama": buyer, "telp": f"08{random.randint(10**9, 10**10 - 1)}", "alamat": jalan, "kota": kota}
BUYERS = ["Rina S.", "Budi P.", "Ahmad F.", "Sari W.", "Dewi K.", "Joko T.", "Maya L.", "Rudi H."]
QUESTIONS = ["Kak, barangnya ready?", "Kapan dikirim ya kak?", "Bisa kirim hari ini?", "Ada varian warna lain?",
             "Resinya belum update kak", "Bisa minta bubble wrap tambahan?"]


def strip(d):
    return {k: v for k, v in d.items() if k != "_id"}


class StoreIn(BaseModel):
    marketplace: str
    nama_toko: str
    username: str


class ProductPatch(BaseModel):
    nama: Optional[str] = None
    harga: Optional[float] = None
    harga_coret: Optional[float] = None
    diskon_persen: Optional[float] = None
    stok: Optional[int] = None
    deskripsi: Optional[str] = None
    aktif: Optional[bool] = None


class BulkIn(BaseModel):
    ids: List[str]
    diskon_persen: Optional[float] = None
    harga: Optional[float] = None
    aktif: Optional[bool] = None


class PromoIn(BaseModel):
    nama: str
    tipe: str
    store_ids: List[str] = []
    nilai: float
    mulai: str
    selesai: str
    aktif: bool = True


class ReplyIn(BaseModel):
    text: str


class OrderStatusIn(BaseModel):
    status: str


class PrintIn(BaseModel):
    ids: List[str]
    auto_ship: bool = True


class PrintSettingIn(BaseModel):
    paper: str = "100x150"
    show_items: bool = True
    show_qr: bool = True
    show_sender: bool = True
    show_price: bool = False
    sender_nama: str = ""
    sender_telp: str = ""
    sender_alamat: str = ""
    catatan: str = ""
    copies: int = 1


def new_resi(marketplace):
    return f"{RESI_PREFIX.get(marketplace, 'JP')}{random.randint(10**9, 10**10 - 1)}"


async def store_map():
    return {s["id"]: s for s in await db.mp_stores.find({}, NO_ID).to_list(200)}


async def make_order(store, products):
    items = random.sample(products, k=min(len(products), random.randint(1, 2))) if products else []
    lines = [{"nama": p["nama"], "sku": p.get("sku_ref", ""), "qty": random.randint(1, 3),
              "harga": p["harga"] * (1 - p.get("diskon_persen", 0) / 100)} for p in items]
    order = {"id": new_id("ord"), "order_no": f"{store['marketplace'][:2]}{random.randint(10**9, 10**10 - 1)}",
             "store_id": store["id"], "marketplace": store["marketplace"], "buyer": random.choice(BUYERS),
             "items": lines, "total": round(sum(l["qty"] * l["harga"] for l in lines)), "status": "Perlu Dikirim",
             "resi": "", "kurir": KURIR.get(store["marketplace"], ""), "is_demo": True, "created_at": now_iso(),
             "berat_gram": random.choice([250, 500, 1000]), "print_count": 0}
    order["penerima"] = demo_penerima(order["buyer"])
    await db.mp_orders.insert_one(order)


@router.get("/stores")
async def list_stores(_=Depends(get_current_user)):
    return [strip(s) for s in await db.mp_stores.find({}, NO_ID).sort("created_at", 1).to_list(200)]


@router.post("/stores")
async def connect_store(body: StoreIn, _=Depends(get_current_user)):
    if body.marketplace not in MARKETPLACES:
        raise HTTPException(400, "Marketplace tidak didukung")
    doc = {**body.model_dump(), "id": new_id("str"), "status": "TERHUBUNG (DEMO)", "connected": True,
           "last_sync": now_iso(), "created_at": now_iso()}
    await db.mp_stores.insert_one(doc)
    return strip(doc)


@router.patch("/stores/{sid}/toggle")
async def toggle_store(sid: str, _=Depends(get_current_user)):
    s = await db.mp_stores.find_one({"id": sid}, NO_ID)
    if not s:
        raise HTTPException(404, "Toko tidak ditemukan")
    c = not s["connected"]
    await db.mp_stores.update_one({"id": sid}, {"$set": {"connected": c, "status": "TERHUBUNG (DEMO)" if c else "TERPUTUS"}})
    return {"connected": c}


@router.delete("/stores/{sid}")
async def delete_store(sid: str, _=Depends(get_current_user)):
    await db.mp_stores.delete_one({"id": sid})
    for col in (db.mp_orders, db.mp_products, db.mp_chats):
        await col.delete_many({"store_id": sid})
    return {"ok": True}


@router.post("/sync")
async def sync(_=Depends(get_current_user)):
    stores = [s for s in (await store_map()).values() if s["connected"]]
    new_orders = 0
    for s in stores:
        prods = await db.mp_products.find({"store_id": s["id"]}, NO_ID).to_list(100)
        for _i in range(random.randint(0, 2)):
            await make_order(s, prods)
            new_orders += 1
        await db.mp_stores.update_one({"id": s["id"]}, {"$set": {"last_sync": now_iso()}})
    if stores and random.random() > 0.4:
        s = random.choice(stores)
        await db.mp_chats.insert_one({"id": new_id("cht"), "store_id": s["id"], "marketplace": s["marketplace"],
                                      "buyer": random.choice(BUYERS), "unread": 1, "updated_at": now_iso(),
                                      "messages": [{"from": "buyer", "text": random.choice(QUESTIONS), "at": now_iso()}]})
        await notify("chat", "Chat Baru", f"Pesan baru di {s['nama_toko']}", "/marketplace/chat")
    return {"new_orders": new_orders, "stores": len(stores)}


@router.get("/orders")
async def list_orders(store_id: str = "", status: str = "", q: str = "", _=Depends(get_current_user)):
    flt = {}
    if store_id:
        flt["store_id"] = store_id
    if status:
        flt["status"] = status
    if q:
        flt["$or"] = [{"order_no": {"$regex": q, "$options": "i"}}, {"buyer": {"$regex": q, "$options": "i"}},
                      {"resi": {"$regex": q, "$options": "i"}}]
    smap = await store_map()
    orders = await db.mp_orders.find(flt, NO_ID).sort("created_at", -1).to_list(1000)
    return [{**strip(o), "nama_toko": smap.get(o["store_id"], {}).get("nama_toko", "-")} for o in orders]


@router.post("/orders/{oid}/ship")
async def ship_order(oid: str, _=Depends(get_current_user)):
    o = await db.mp_orders.find_one({"id": oid}, NO_ID)
    if not o or o["status"] != "Perlu Dikirim":
        raise HTTPException(400, "Pesanan tidak bisa diatur pengirimannya")
    resi = new_resi(o["marketplace"])
    await db.mp_orders.update_one({"id": oid}, {"$set": {"status": "Dikirim", "resi": resi,
                                                         "kurir": o.get("kurir") or KURIR.get(o["marketplace"], "")}})
    return {"resi": resi}


@router.post("/orders/print")
async def print_orders(body: PrintIn, _=Depends(get_current_user)):
    if not body.ids:
        raise HTTPException(400, "Pilih pesanan yang akan dicetak")
    smap = await store_map()
    out, skipped = [], []
    for oid in body.ids:
        o = await db.mp_orders.find_one({"id": oid}, NO_ID)
        if not o:
            continue
        if not o.get("resi"):
            if not (body.auto_ship and o["status"] == "Perlu Dikirim"):
                skipped.append(o["order_no"])
                continue
            o["resi"] = new_resi(o["marketplace"])
            o["status"] = "Dikirim"
        o["kurir"] = o.get("kurir") or KURIR.get(o["marketplace"], "")
        o["penerima"] = o.get("penerima") or demo_penerima(o["buyer"])
        o["print_count"] = o.get("print_count", 0) + 1
        await db.mp_orders.update_one({"id": oid}, {"$set": {"resi": o["resi"], "status": o["status"], "kurir": o["kurir"],
                                                             "penerima": o["penerima"], "print_count": o["print_count"],
                                                             "printed_at": now_iso()}})
        s = smap.get(o["store_id"], {})
        out.append({**strip(o), "nama_toko": s.get("nama_toko", "-")})
    return {"orders": out, "skipped": skipped, "settings": await get_print_settings()}


async def get_print_settings():
    saved = {d["marketplace"]: d for d in await db.mp_print_settings.find({}, NO_ID).to_list(20)}
    return {m: {**PRINT_DEFAULT, **{k: v for k, v in saved.get(m, {}).items() if k != "marketplace"}} for m in MARKETPLACES}


@router.get("/print-settings")
async def read_print_settings(_=Depends(get_current_user)):
    return await get_print_settings()


@router.put("/print-settings/{marketplace}")
async def save_print_settings(marketplace: str, body: PrintSettingIn, _=Depends(get_current_user)):
    if marketplace not in MARKETPLACES:
        raise HTTPException(400, "Marketplace tidak didukung")
    if body.paper not in ("100x150", "100x100", "A6", "A4") or not 1 <= body.copies <= 3:
        raise HTTPException(400, "Ukuran kertas / jumlah salinan tidak valid")
    await db.mp_print_settings.update_one({"marketplace": marketplace}, {"$set": {**body.model_dump(), "marketplace": marketplace}}, upsert=True)
    return (await get_print_settings())[marketplace]


@router.patch("/orders/{oid}/status")
async def order_status(oid: str, body: OrderStatusIn, _=Depends(get_current_user)):
    if body.status not in ORDER_STATUS:
        raise HTTPException(400, "Status tidak valid")
    await db.mp_orders.update_one({"id": oid}, {"$set": {"status": body.status}})
    return {"ok": True}


@router.get("/products")
async def list_mp_products(store_id: str = "", q: str = "", _=Depends(get_current_user)):
    flt = {"store_id": store_id} if store_id else {}
    if q:
        flt["nama"] = {"$regex": q, "$options": "i"}
    smap = await store_map()
    items = await db.mp_products.find(flt, NO_ID).sort("nama", 1).to_list(2000)
    return [{**strip(p), "nama_toko": smap.get(p["store_id"], {}).get("nama_toko", "-"),
             "marketplace": smap.get(p["store_id"], {}).get("marketplace", "-")} for p in items]


@router.patch("/products/{pid}")
async def patch_mp_product(pid: str, body: ProductPatch, _=Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if "diskon_persen" in upd and not 0 <= upd["diskon_persen"] <= 90:
        raise HTTPException(400, "Diskon harus 0-90%")
    await db.mp_products.update_one({"id": pid}, {"$set": {**upd, "updated_at": now_iso()}})
    p = await db.mp_products.find_one({"id": pid}, NO_ID)
    if not p:
        raise HTTPException(404, "Produk tidak ditemukan")
    return strip(p)


@router.post("/products/bulk")
async def bulk_products(body: BulkIn, _=Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None and k != "ids"}
    if not upd or not body.ids:
        raise HTTPException(400, "Tidak ada perubahan")
    res = await db.mp_products.update_many({"id": {"$in": body.ids}}, {"$set": {**upd, "updated_at": now_iso()}})
    return {"updated": res.modified_count}


@router.get("/promos")
async def list_promos(_=Depends(get_current_user)):
    return [strip(p) for p in await db.mp_promos.find({}, NO_ID).sort("mulai", -1).to_list(500)]


@router.post("/promos")
async def create_promo(body: PromoIn, _=Depends(get_current_user)):
    doc = {**body.model_dump(), "id": new_id("prm"), "created_at": now_iso()}
    await db.mp_promos.insert_one(doc)
    return strip(doc)


@router.put("/promos/{pid}")
async def update_promo(pid: str, body: PromoIn, _=Depends(get_current_user)):
    await db.mp_promos.update_one({"id": pid}, {"$set": body.model_dump()})
    return {"ok": True}


@router.delete("/promos/{pid}")
async def delete_promo(pid: str, _=Depends(get_current_user)):
    await db.mp_promos.delete_one({"id": pid})
    return {"ok": True}


@router.get("/chats")
async def list_chats(store_id: str = "", _=Depends(get_current_user)):
    flt = {"store_id": store_id} if store_id else {}
    smap = await store_map()
    chats = await db.mp_chats.find(flt, NO_ID).sort("updated_at", -1).to_list(500)
    return [{**strip(c), "nama_toko": smap.get(c["store_id"], {}).get("nama_toko", "-")} for c in chats]


@router.post("/chats/{cid}/read")
async def read_chat(cid: str, _=Depends(get_current_user)):
    await db.mp_chats.update_one({"id": cid}, {"$set": {"unread": 0}})
    return {"ok": True}


@router.post("/chats/{cid}/reply")
async def reply_chat(cid: str, body: ReplyIn, user=Depends(get_current_user)):
    if not body.text.strip():
        raise HTTPException(400, "Pesan kosong")
    msg = {"from": "seller", "text": body.text.strip(), "at": now_iso(), "by": user["name"]}
    await db.mp_chats.update_one({"id": cid}, {"$push": {"messages": msg}, "$set": {"updated_at": now_iso(), "unread": 0}})
    return msg


@router.get("/summary")
async def summary(_=Depends(get_current_user)):
    stores = await db.mp_stores.find({}, NO_ID).to_list(200)
    by_status = {s: await db.mp_orders.count_documents({"status": s}) for s in ORDER_STATUS}
    unread = await db.mp_chats.count_documents({"unread": {"$gt": 0}})
    return {"stores": len(stores), "connected": sum(1 for s in stores if s["connected"]),
            "orders_by_status": by_status, "unread_chats": unread,
            "products": await db.mp_products.count_documents({}),
            "promos_aktif": await db.mp_promos.count_documents({"aktif": True})}
