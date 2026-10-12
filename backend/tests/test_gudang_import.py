"""Test master-sheet CSV import (title rows + unit rows + REAL STOCK INVENTORY rule)."""
import io
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "chadevibrimob@gmail.com"
ADMIN_PASSWORD = "Vrchindo@2026"


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    s.headers.pop("Content-Type", None)
    return s


def _csv_master(sku: str) -> bytes:
    # Mimic PT VRCHINDO master sheet: title rows, master header (no stok_awal/in/retur), unit row (KODE BARANG), data row
    lines = [
        "LAPORAN INVENTORY GUDANG PT VRCHINDO - JAN 2026,,,,,,,,,,,,,,",
        "Update terakhir : 10 Jan 2026,,,,,,,,,,,,,,",
        ",,,,,,,,,,,,,,",
        "NO,BARCODE,NAMA BARANG INVENTORY STOCK GUDANG,VARIANT,MINIMUM KEEP STOCK,STOCK KELUAR,REAL STOCK INVENTORY,HPP/COGS,HARGA JUAL NORMAL,HARGA JUAL SETELAH PROMO,DISCOUNT PROMO,NAMA SUPPLYER UTAMA,LOKASI SUPPLYER UTAMA,TO DO TASK,CONDITIONS",
        ",KODE BARANG,,,PCS,PCS,PCS,IDR,IDR,IDR,%,,,,",
        f"1,{sku},TEST Master Produk,500ml,12,8,41,15000,30000,27000,10,PT Supplier A,Jakarta,Restock minggu depan,PUBLISHED",
    ]
    return ("\n".join(lines)).encode("utf-8")


class TestMasterImport:
    def test_import_master_real_stock_rule(self, admin):
        sku = f"TEST_IMP_{uuid.uuid4().hex[:6].upper()}"
        content = _csv_master(sku)
        files = {"file": ("master.csv", content, "text/csv")}
        r = admin.post(f"{BASE_URL}/api/products/import", files=files)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["created"] >= 1, body

        # Fetch created product
        r2 = admin.get(f"{BASE_URL}/api/products?q={sku}")
        assert r2.status_code == 200
        matches = [p for p in r2.json() if p["sku"] == sku]
        assert matches, f"Imported SKU {sku} not found"
        p = matches[0]

        # Assertions per request
        assert p["barcode"] == sku
        assert p["nama"] == "TEST Master Produk"
        assert p["min_stock"] == 12
        assert p["hpp"] == 15000
        assert p["harga_normal"] == 30000
        assert p["harga_jual"] == 27000
        assert p["supplier_utama"] == "PT Supplier A"
        assert p["lokasi_supplier"] == "Jakarta"
        assert p["action_summary"] == "Restock minggu depan"
        assert p["kondisi"] == "PUBLISHED"
        # CRITICAL: stok_riil must equal REAL STOCK INVENTORY, NOT (REAL - STOCK KELUAR)
        assert p["stok_riil"] == 41, f"stok_riil expected 41 got {p['stok_riil']}; stok_awal={p['stok_awal']} stock_out={p['stock_out']}"
        assert p["stock_out"] == 0
        assert p["stock_in"] == 0
        assert p["return_in"] == 0

        # Cleanup
        admin.delete(f"{BASE_URL}/api/products/{p['id']}")
