import base64
import csv
import io
import re
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from core import db, NO_ID, now_iso, new_id, get_current_user, require_admin, notify
from logic import stock_fields

router = APIRouter(prefix="/api")
KONDISI = ["PUBLISHED", "SLOW MOVING", "DEAD STOCK", "URGENT"]
ADJ_TYPES = {"Stok Masuk (+)": "stock_in", "Return Masuk (+)": "return_in",
             "Barang Keluar (-)": "stock_out", "Barang Rusak (-)": "stock_out"}
EXPORT_COLS = [
    "barcode",
    "sku",
    "nama",
    "variant",
    "kategori",
    "action_summary",
    "supplier_utama",
    "min_stock",
    "stok_awal",
    "stock_in",
    "return_in",
    "stock_out",
    "stok_riil",
    "status_stok",
    "hpp",
    "harga_normal",
    "harga_jual",
    "diskon_promo",
    "kondisi",
]


class ProductIn(BaseModel):
    sku: str
    nama: str
    barcode: str = ""
    variant: str = ""
    kategori: str = ""
    action_summary: str = ""
    catatan_tindakan: str = ""
    catatan_staff: str = ""
    min_stock: int = 0
    stok_awal: int = 0
    stock_in: int = 0
    return_in: int = 0
    stock_out: int = 0
    hpp: float = 0
    harga_normal: float = 0
    harga_jual: float = 0
    diskon_promo: float = 0
    supplier_utama: str = ""
    lokasi_supplier: str = ""
    satuan_barang: str = "pcs"
    kondisi: str = "PUBLISHED"
    barang_susah: bool = False
    image: Optional[str] = None


class AdjIn(BaseModel):
    sku: str
    tipe: str
    qty: int
    catatan: str = ""


def with_calc(p):
    return {**p, **stock_fields(p)}


def parse_upload(content: bytes, filename: str):
    if filename.lower().endswith((".xlsx", ".xlsm")):
        import openpyxl
        ws = openpyxl.load_workbook(io.BytesIO(content), data_only=True).active
        rows = [[("" if c is None else str(c)).strip() for c in r] for r in ws.iter_rows(values_only=True)]
    else:
        text = content.decode("utf-8-sig", errors="ignore")
        rows = [[c.strip() for c in r] for r in csv.reader(io.StringIO(text))]
    rows = [r for r in rows if any(r)]
    if not rows:
        return []
    header_row = 0
    for index, row in enumerate(rows[:60]):
        joined = " ".join(normalize_header(cell) for cell in row)
        has_code = any(key in joined for key in ("barcode", "sku", "kode_barang"))
        has_name = any(key in joined for key in ("nama", "barang", "products"))
        if has_code and has_name:
            header_row = index
            break
    headers = unique_headers(rows[header_row])
    return [dict(zip(headers, row)) for row in rows[header_row + 1:]]


def normalize_header(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", value.lower())
    return normalized.strip("_")


def unique_headers(row: list[str]) -> list[str]:
    result = []
    counts = {}
    for index, value in enumerate(row):
        base = normalize_header(value) or f"kolom_{index + 1}"
        counts[base] = counts.get(base, 0) + 1
        result.append(base if counts[base] == 1 else f"{base}_{counts[base]}")
    return result


def to_int(v):
    try:
        raw = re.sub(r"[^0-9-]", "", str(v))
        return int(raw) if raw not in ("", "-") else 0
    except ValueError:
        return 0


def pick(row, *keys):
    for k in keys:
        value = row.get(k)
        if value not in (None, ""):
            return value
    for k in keys:
        for rk, rv in row.items():
            pattern = rf"(?:^|_){re.escape(k)}(?:_|$)"
            if re.search(pattern, rk) and rv not in (None, ""):
                return rv
    return ""


@router.get("/products")
async def list_products(q: str = "", status: str = "", kondisi: str = "", _=Depends(get_current_user)):
    flt = {}
    if q:
        flt["$or"] = [
            {"sku": {"$regex": q, "$options": "i"}},
            {"barcode": {"$regex": q, "$options": "i"}},
            {"nama": {"$regex": q, "$options": "i"}},
            {"variant": {"$regex": q, "$options": "i"}},
        ]
    if kondisi:
        flt["kondisi"] = kondisi
    items = [with_calc(p) for p in await db.products.find(flt, NO_ID).sort("sku", 1).to_list(5000)]
    if status:
        items = [p for p in items if p["status_stok"] == status]
    return items


@router.post("/products")
async def create_product(body: ProductIn, _=Depends(get_current_user)):
    if await db.products.find_one({"sku": body.sku}):
        raise HTTPException(400, "SKU sudah ada")
    doc = {**body.model_dump(), "id": new_id("prd"), "created_at": now_iso(), "updated_at": now_iso()}
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return with_calc(doc)


@router.put("/products/{pid}")
async def update_product(pid: str, body: ProductIn, _=Depends(get_current_user)):
    data = body.model_dump()
    if data.get("image") is None:
        data.pop("image")
    dup = await db.products.find_one({"sku": body.sku, "id": {"$ne": pid}})
    if dup:
        raise HTTPException(400, "SKU sudah dipakai produk lain")
    await db.products.update_one({"id": pid}, {"$set": {**data, "updated_at": now_iso()}})
    p = await db.products.find_one({"id": pid}, NO_ID)
    if not p:
        raise HTTPException(404, "Produk tidak ditemukan")
    return with_calc(p)


@router.post("/products/{pid}/image")
async def upload_image(pid: str, file: UploadFile = File(...), _=Depends(get_current_user)):
    content = await file.read()
    if len(content) > 1_500_000:
        raise HTTPException(400, "Ukuran gambar maksimal 1.5MB")
    data_url = f"data:{file.content_type};base64,{base64.b64encode(content).decode()}"
    await db.products.update_one({"id": pid}, {"$set": {"image": data_url}})
    return {"image": data_url}


@router.delete("/products/{pid}")
async def delete_product(pid: str, _=Depends(require_admin)):
    await db.products.delete_one({"id": pid})
    return {"ok": True}


@router.get("/products/export")
async def export_products(_=Depends(get_current_user)):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([c.upper() for c in EXPORT_COLS])
    for p in await db.products.find({}, NO_ID).sort("sku", 1).to_list(5000):
        p = with_calc(p)
        w.writerow([p.get(c, "") for c in EXPORT_COLS])
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=data_gudang.csv"})


@router.post("/products/import")
async def import_products(file: UploadFile = File(...), _=Depends(get_current_user)):
    rows = parse_upload(await file.read(), file.filename)
    created = updated = 0
    for r in rows:
        barcode = pick(r, "barcode", "kode_barang")
        sku = pick(r, "sku_product", "sku", "kode_barang", "barcode")
        nama = pick(r, "nama_barang", "nama_products", "nama")
        if sku.upper() in {"KODE BARANG", "SKU PRODUCT", "BARCODE"}:
            continue
        if not sku or not nama:
            continue
        stok_awal = pick(r, "stok_awal", "stock_awal", "awal")
        stock_in = pick(r, "stock_in", "barang_masuk", "masuk")
        return_in = pick(r, "return_in", "retur_masuk", "retur")
        stock_out = pick(r, "stock_out", "stock_keluar", "keluar")
        real_stock = pick(r, "real_stock_inventory", "actual_inventory", "inventory_stock")
        if real_stock and not any((stok_awal, stock_in, return_in)):
            stok_awal = real_stock
            stock_in = 0
            return_in = 0
            stock_out = 0
        doc = {
            "sku": sku,
            "barcode": barcode or sku,
            "nama": nama,
            "variant": pick(r, "variant", "spesifikasi", "kapasitas"),
            "kategori": pick(r, "kategori"),
            "action_summary": pick(r, "action_summary", "to_do_task", "tindakan"),
            "catatan_tindakan": pick(r, "keterangan_catatan", "catatan_tindakan"),
            "catatan_staff": pick(r, "catatan_semua_staff", "catatan_staff"),
            "min_stock": to_int(pick(r, "minimum_keep_stock", "min_stock", "minimum")),
            "stok_awal": to_int(stok_awal),
            "stock_in": to_int(stock_in),
            "return_in": to_int(return_in),
            "stock_out": abs(to_int(stock_out)),
            "hpp": to_int(pick(r, "hpp", "cogs")),
            "harga_normal": to_int(pick(r, "harga_jual_normal", "harga_sebelum_promo")),
            "harga_jual": to_int(pick(r, "harga_jual_setelah", "harga_jual", "harga_setelah")),
            "diskon_promo": to_int(pick(r, "discount_promo", "discount", "disc")),
            "supplier_utama": pick(
                r,
                "nama_supplyer_utama",
                "nama_supplier_utama",
                "supplier_utama",
                "supplyer",
                "supplier",
            ),
            "lokasi_supplier": pick(
                r,
                "lokasi_supplyer_utama",
                "lokasi_suppleyr_utama",
                "lokasi_supplier",
                "lokasi_supplyer",
            ),
            "satuan_barang": pick(r, "satuan_barang", "satuan") or "pcs",
            "kondisi": (pick(r, "conditions", "kondisi", "status_of_products") or "PUBLISHED").upper(),
            "updated_at": now_iso(),
        }
        res = await db.products.update_one({"sku": sku}, {"$set": doc}, upsert=False)
        if res.matched_count:
            updated += 1
        else:
            await db.products.insert_one({**doc, "id": new_id("prd"), "barang_susah": False, "image": None,
                                          "created_at": now_iso()})
            created += 1
    return {"created": created, "updated": updated, "rows": len(rows)}


@router.get("/stock-adjustments")
async def list_adjustments(sku: str = "", _=Depends(get_current_user)):
    flt = {"sku": sku} if sku else {}
    docs = await db.stock_adjustments.find(flt, NO_ID).sort("created_at", -1).to_list(1000)
    return [{k: v for k, v in d.items() if k != "_id"} for d in docs]


@router.post("/stock-adjustments")
async def create_adjustment(body: AdjIn, user=Depends(get_current_user)):
    field = ADJ_TYPES.get(body.tipe)
    if not field or body.qty <= 0:
        raise HTTPException(400, "Tipe mutasi / qty tidak valid")
    p = await db.products.find_one({"sku": body.sku}, NO_ID)
    if not p:
        raise HTTPException(404, "SKU tidak ditemukan")
    await db.products.update_one({"sku": body.sku}, {"$inc": {field: body.qty}, "$set": {"updated_at": now_iso()}})
    doc = {**body.model_dump(), "id": new_id("adj"), "nama": p["nama"], "operator": user["name"],
           "created_at": now_iso()}
    await db.stock_adjustments.insert_one(doc)
    doc.pop("_id", None)
    after = with_calc(await db.products.find_one({"sku": body.sku}, NO_ID))
    if after["status_stok"] == "RESTOCK !!":
        await notify("stock", "Stok Menipis", f"{after['sku']} - {after['nama']} tersisa {after['stok_riil']}",
                     "/gudang/produk")
    return {"adjustment": doc, "product": after}


@router.get("/gudang/summary")
async def gudang_summary(_=Depends(get_current_user)):
    items = [with_calc(p) for p in await db.products.find({}, NO_ID).to_list(5000)]
    by_status, by_kondisi = {}, {}
    for p in items:
        by_status[p["status_stok"]] = by_status.get(p["status_stok"], 0) + 1
        by_kondisi[p["kondisi"]] = by_kondisi.get(p["kondisi"], 0) + 1
    return {"total_sku": len(items), "total_stok": sum(p["stok_riil"] for p in items),
            "nilai_stok": sum(p["nilai_stok"] for p in items), "by_status": by_status, "by_kondisi": by_kondisi,
            "restock": [{"sku": p["sku"], "nama": p["nama"], "stok_riil": p["stok_riil"], "min_stock": p["min_stock"]}
                        for p in items if p["status_stok"] == "RESTOCK !!"][:10]}
