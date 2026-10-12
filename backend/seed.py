import os
import random
from datetime import timedelta
from core import db, now, now_iso, new_id, hash_password, verify_password

DEMO_PRODUCTS = [
    ("BRG-001", "Contoh Produk A", "Hitam / M", "Fashion", 10, 50, 20, 2, 45, 35000, 59000, "PUBLISHED"),
    ("BRG-002", "Contoh Produk B", "Putih / L", "Fashion", 10, 30, 0, 0, 25, 40000, 69000, "SLOW MOVING"),
    ("BRG-003", "Contoh Produk C", "500ml", "Rumah Tangga", 15, 0, 40, 0, 0, 12000, 25000, "PUBLISHED"),
    ("BRG-004", "Contoh Produk D", "Set 3pcs", "Dapur", 5, 20, 5, 1, 4, 55000, 89000, "URGENT"),
    ("BRG-005", "Contoh Produk E", "Biru", "Aksesoris", 20, 100, 0, 0, 92, 8000, 19000, "PUBLISHED"),
    ("BRG-006", "Contoh Produk F", "Standar", "Elektronik", 3, 12, 0, 0, 1, 150000, 229000, "DEAD STOCK"),
]
DEMO_STORES = [("SHOPEE", "Toko Demo Shopee 1", "demo_shopee1"), ("SHOPEE", "Toko Demo Shopee 2", "demo_shopee2"),
               ("TOKOPEDIA", "Toko Demo Tokopedia", "demo_tokped"), ("TIKTOK SHOP", "Toko Demo TikTok", "demo_tiktok"),
               ("LAZADA", "Toko Demo Lazada", "demo_lazada")]
DEMO_RESI = ["SPXID0123456789", "JP1234567890", "TG2345678901", "CM9876543210", "12345678901234", "JNE00112233"]


async def seed_users():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    email = os.environ["ADMIN_EMAIL"].lower()
    pw = os.environ["ADMIN_PASSWORD"]
    u = await db.users.find_one({"email": email})
    if not u:
        await db.users.insert_one({"user_id": new_id("user"), "email": email, "name": "Admin VRCHINDO", "role": "admin",
                                   "active": True, "picture": None, "password_hash": hash_password(pw),
                                   "created_at": now_iso()})
    elif not verify_password(pw, u.get("password_hash", "")):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(pw), "role": "admin"}})
    if not await db.users.find_one({"email": "staff@vrchindo.com"}):
        await db.users.insert_one({"user_id": new_id("user"), "email": "staff@vrchindo.com", "name": "Staff Gudang",
                                   "role": "staff", "active": True, "picture": None,
                                   "password_hash": hash_password("Staff123!"), "created_at": now_iso()})


async def seed_demo():
    if await db.products.count_documents({}) == 0:
        for sku, nama, var, kat, mn, aw, i, r, o, hpp, jual, kon in DEMO_PRODUCTS:
            await db.products.insert_one({"id": new_id("prd"), "sku": sku, "nama": nama, "variant": var, "kategori": kat,
                                          "min_stock": mn, "stok_awal": aw, "stock_in": i, "return_in": r, "stock_out": o,
                                          "hpp": hpp, "harga_jual": jual, "kondisi": kon, "barang_susah": False,
                                          "image": None, "is_demo": True, "created_at": now_iso(), "updated_at": now_iso()})
    if await db.mp_stores.count_documents({}) == 0:
        for mp, nama, uname in DEMO_STORES:
            sid = new_id("str")
            await db.mp_stores.insert_one({"id": sid, "marketplace": mp, "nama_toko": nama, "username": uname,
                                           "status": "TERHUBUNG (DEMO)", "connected": True, "last_sync": now_iso(),
                                           "created_at": now_iso()})
            for sku, nama_p, *_rest in DEMO_PRODUCTS[:4]:
                harga = _rest[-2]
                await db.mp_products.insert_one({"id": new_id("mpp"), "store_id": sid, "sku_ref": sku, "nama": nama_p,
                                                 "harga": harga, "harga_coret": round(harga * 1.3),
                                                 "diskon_persen": random.choice([0, 5, 10]), "stok": random.randint(5, 60),
                                                 "deskripsi": f"Deskripsi {nama_p}. Edit sesuai kebutuhan toko.",
                                                 "aktif": True, "created_at": now_iso()})
            for k in range(2):
                await db.mp_orders.insert_one({"id": new_id("ord"), "order_no": f"{mp[:2]}{random.randint(10**9, 10**10 - 1)}",
                                               "store_id": sid, "marketplace": mp, "buyer": random.choice(["Rina S.", "Budi P.", "Sari W."]),
                                               "items": [{"nama": DEMO_PRODUCTS[k][1], "sku": DEMO_PRODUCTS[k][0], "qty": 1,
                                                          "harga": DEMO_PRODUCTS[k][10]}],
                                               "total": DEMO_PRODUCTS[k][10], "status": ["Perlu Dikirim", "Selesai"][k],
                                               "resi": "", "kurir": "", "is_demo": True, "created_at": now_iso()})
            await db.mp_chats.insert_one({"id": new_id("cht"), "store_id": sid, "marketplace": mp, "buyer": "Pembeli Demo",
                                          "unread": 1, "updated_at": now_iso(),
                                          "messages": [{"from": "buyer", "text": "Halo kak, pesanan saya kapan dikirim?", "at": now_iso()}]})
        await db.mp_promos.insert_one({"id": new_id("prm"), "nama": "Promo Demo Gajian", "tipe": "Diskon Toko",
                                       "store_ids": [], "nilai": 10, "mulai": now().date().isoformat(),
                                       "selesai": (now() + timedelta(days=7)).date().isoformat(), "aktif": True,
                                       "created_at": now_iso()})
    if await db.packages.count_documents({}) == 0:
        from logic import detect
        for idx, resi in enumerate(DEMO_RESI):
            eks, mp = detect(resi)
            created = (now() - timedelta(hours=[1, 3, 30, 50, 2, 5][idx])).isoformat()
            await db.packages.insert_one({"id": new_id("pkg"), "no_resi": resi, "submenu": "process", "expedisi": eks,
                                          "marketplace": mp, "akun": str(idx % 3 + 1), "drop_off": "", "tindakan": "",
                                          "is_duplicate": False, "duplicate_count": 0, "user_id": "seed", "operator": "Demo",
                                          "base_status": "PROCESS PACKING", "base_warning": "", "status": "PROCESS PACKING",
                                          "warning": "", "keterangan": "Sudah Disiapkan", "is_demo": True,
                                          "created_at": created})
