import base64
import csv
import io
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
EXPORT_COLS = ["sku", "nama", "variant", "kategori", "min_stock", "stok_awal", "stock_in", "return_in",
               "stock_out", "stok_riil", "status_stok", "hpp", "harga_jual", "kondisi"]


class ProductIn(BaseModel):
    sku: str
    nama: str
    variant: str = ""
    kategori: str = ""
    min_stock: int = 0
    stok_awal: int = 0
    stock_in: int = 0
    return_in: int = 0
    stock_out: int = 0
    hpp: float = 0
    harga_jual: float = 0
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
    headers = [h.lower().replace(" ", "_") for h in rows[0]]
    return [dict(zip(headers, r)) for r in rows[1:]]


def to_int(v):
    try:
        return int(float(str(v).replace(",", "").replace(".", "") or 0)) if str(v).strip() not in ("", "-") else 0
    except ValueError:
        return 0


def pick(row, *keys):
    for k in keys:
        for rk, rv in row.items():
            if k in rk and rv not in (None, ""):
                return rv
    return ""


@router.get("/products")
async def list_products(q: str = "", status: str = "", kondisi: str = "", _=Depends(get_current_user)):
    flt = {}
    if q:
        flt["$or"] = [{"sku": {"$regex": q, "$options": "i"}}, {"nama": {"$regex": q, "$options": "i"}},
                      {"variant": {"$regex": q, "$options": "i"}}]
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
        sku = pick(r, "sku", "barcode", "kode")
        nama = pick(r, "nama")
        if not sku or not nama:
            continue
        doc = {"sku": sku, "nama": nama, "variant": pick(r, "variant", "spesifikasi"),
               "kategori": pick(r, "kategori"), "min_stock": to_int(pick(r, "min")),
               "stok_awal": to_int(pick(r, "stok_awal", "awal")), "stock_in": to_int(pick(r, "stock_in", "masuk")),
               "return_in": to_int(pick(r, "return", "retur")),
               "stock_out": abs(to_int(pick(r, "stock_out", "keluar"))),
               "hpp": to_int(pick(r, "hpp")), "harga_jual": to_int(pick(r, "harga_jual", "jual")),
               "kondisi": (pick(r, "kondisi") or "PUBLISHED").upper(), "updated_at": now_iso()}
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
