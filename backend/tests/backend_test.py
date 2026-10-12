"""Backend API tests for VRCHINDO ERP (auth, shipping, gudang, marketplace, pos, misc)."""
import os
import io
import csv
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://toko-gudang-app.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "chadevibrimob@gmail.com"
ADMIN_PASSWORD = "Vrchindo@2026"
STAFF_EMAIL = "staff@vrchindo.com"
STAFF_PASSWORD = "Staff123!"


def _session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin():
    s = _session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    s.headers["Authorization"] = f"Bearer {data['token']}"
    return s


@pytest.fixture(scope="session")
def staff(admin):
    # ensure staff exists
    s = _session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD})
    if r.status_code != 200:
        # try create via admin
        admin.post(f"{BASE_URL}/api/users", json={"email": STAFF_EMAIL, "name": "Staff Test", "role": "staff", "password": STAFF_PASSWORD})
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD})
    assert r.status_code == 200, f"staff login failed: {r.status_code} {r.text}"
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s


# ---------- AUTH ----------
class TestAuth:
    def test_health(self):
        r = requests.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_login_wrong_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong_pw_XYZ"})
        assert r.status_code == 401

    def test_me_admin(self, admin):
        r = admin.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == ADMIN_EMAIL
        assert u["role"] == "admin"

    def test_me_unauth(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code in (401, 403)

    def test_staff_cannot_list_users(self, staff):
        r = staff.get(f"{BASE_URL}/api/users")
        assert r.status_code == 403

    def test_admin_lists_users(self, admin):
        r = admin.get(f"{BASE_URL}/api/users")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_google_session_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/google/session", json={"session_id": "INVALID_" + uuid.uuid4().hex})
        assert r.status_code in (401, 403)


# ---------- USERS CRUD ----------
class TestUsers:
    def test_user_crud(self, admin):
        email = f"test_user_{uuid.uuid4().hex[:6]}@test.com"
        r = admin.post(f"{BASE_URL}/api/users", json={"email": email, "name": "TEST_U", "role": "staff", "password": "Pass1234!"})
        assert r.status_code == 200
        uid = r.json()["user_id"]
        # patch
        r = admin.patch(f"{BASE_URL}/api/users/{uid}", json={"name": "TEST_U2", "active": False})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_U2"
        assert r.json()["active"] is False
        # delete
        r = admin.delete(f"{BASE_URL}/api/users/{uid}")
        assert r.status_code == 200


# ---------- SHIPPING ----------
class TestShipping:
    @pytest.fixture(scope="class")
    def created_resis(self):
        return []

    def _scan(self, client, resi, submenu, **kw):
        return client.post(f"{BASE_URL}/api/shipping/scan", json={"resi": resi, "submenu": submenu, **kw})

    def test_scan_process_spx(self, admin, created_resis):
        resi = f"SPXTEST{uuid.uuid4().hex[:10].upper()}"
        r = self._scan(admin, resi, "process")
        assert r.status_code == 200, r.text
        rec = r.json()["record"]
        created_resis.append(resi)
        assert rec["expedisi"] == "SPX"
        assert rec["marketplace"] == "SHOPEE"
        assert rec["status"] == "PROCESS PACKING"
        assert rec["keterangan"] == "Sudah Disiapkan"

    def test_scan_duplicate(self, admin, created_resis):
        resi = f"TEST_DUP{uuid.uuid4().hex[:10].upper()}SPX"  # weird; use SPX prefix
        resi = f"SPXTEST{uuid.uuid4().hex[:8].upper()}"
        r1 = self._scan(admin, resi, "process")
        assert r1.status_code == 200
        created_resis.append(resi)
        r2 = self._scan(admin, resi, "process")
        assert r2.status_code == 200
        rec = r2.json()["record"]
        assert rec["status"] == "JANGAN DIKIRIMKAN !!"
        assert rec["warning"] == "DATA DOUBLE"
        assert rec["keterangan"] == "DOUBLE !!"
        assert r2.json()["duplicate"] is True

    def test_detect_rules(self, admin, created_resis):
        cases = [
            ("1" * 14, "AnterAja", "SHOPEE"),  # 14 digits
            ("1" * 12, "SICEPAT", "SHOPEE"),   # 12 digits
            (f"CM{uuid.uuid4().hex[:10].upper()}", "JNE", "SHOPEE"),
            (f"JP{uuid.uuid4().hex[:10].upper()}", "J&T", "SHOPEE"),  # J prefix -> SHOPEE default mp
            (f"TG{uuid.uuid4().hex[:10].upper()}", "Lainnya", "TIKTOK"),
            (f"TL{uuid.uuid4().hex[:10].upper()}", "JNE", "TOKPED"),
        ]
        for resi, exp_e, exp_m in cases:
            r = self._scan(admin, resi, "process")
            assert r.status_code == 200, f"{resi}: {r.text}"
            rec = r.json()["record"]
            created_resis.append(resi)
            assert rec["expedisi"] == exp_e, f"resi={resi} got {rec['expedisi']}"
            # for JP: PREFIX_RULES has JP->J&T,None then J->None,SHOPEE => mp=SHOPEE
            assert rec["marketplace"] == exp_m, f"resi={resi} got mp={rec['marketplace']}"

    def test_pengiriman_without_process_fails(self, admin):
        resi = f"NOPROC{uuid.uuid4().hex[:8].upper()}SPX"
        r = self._scan(admin, resi, "pengiriman")
        assert r.status_code == 400
        assert "belum ada" in r.json().get("detail", "").lower()

    def test_pengiriman_updates_process(self, admin, created_resis):
        resi = f"SPX{uuid.uuid4().hex[:10].upper()}"
        r1 = self._scan(admin, resi, "process")
        assert r1.status_code == 200
        created_resis.append(resi)
        r2 = self._scan(admin, resi, "pengiriman")
        assert r2.status_code == 200
        rec = r2.json()["record"]
        assert rec["status"] == "SUDAH TERKIRIM !!"
        assert rec["drop_off"] == "DROPPED OFF"
        # verify process record updated
        pkgs = admin.get(f"{BASE_URL}/api/shipping/packages?submenu=process&q={resi}").json()
        assert any(p["no_resi"] == resi and p["status"] == "SUDAH TERKIRIM !!" for p in pkgs)

    def test_cancel_order_flow(self, admin, created_resis):
        resi = f"SPX{uuid.uuid4().hex[:10].upper()}"
        r0 = self._scan(admin, resi, "process")
        assert r0.status_code == 200
        created_resis.append(resi)
        r1 = self._scan(admin, resi, "cancel", tindakan="PENGAJUAN CANCEL")
        assert r1.status_code == 200
        proc = admin.get(f"{BASE_URL}/api/shipping/packages?submenu=process&q={resi}").json()
        assert any(p["no_resi"] == resi and p["warning"] == "PENGAJUAN CANCEL" for p in proc)
        # find cancel record id and patch tindakan
        cancels = admin.get(f"{BASE_URL}/api/shipping/packages?submenu=cancel&q={resi}").json()
        assert cancels
        cid = cancels[0]["id"]
        r2 = admin.patch(f"{BASE_URL}/api/shipping/packages/{cid}", json={"tindakan": "PEMBATALAN DITERIMA"})
        assert r2.status_code == 200
        proc = admin.get(f"{BASE_URL}/api/shipping/packages?submenu=process&q={resi}").json()
        assert any(p["status"] == "JANGAN DIKIRIMKAN !!" for p in proc)
        # Menarik pembatalan
        r3 = admin.patch(f"{BASE_URL}/api/shipping/packages/{cid}", json={"tindakan": "MENARIK PEMBATALAN"})
        assert r3.status_code == 200
        proc = admin.get(f"{BASE_URL}/api/shipping/packages?submenu=process&q={resi}").json()
        assert any(p["status"] == "PROCESS PACKING" for p in proc), proc

    def test_rts_scan_and_patch(self, admin, created_resis):
        resi = f"SPX{uuid.uuid4().hex[:10].upper()}"
        self._scan(admin, resi, "process")
        self._scan(admin, resi, "pengiriman")
        created_resis.append(resi)
        r = self._scan(admin, resi, "rts")
        assert r.status_code == 200
        rec = r.json()["record"]
        assert rec["status"] == "RTS - DIKEMBALIKAN"
        pid = rec["id"]
        r2 = admin.patch(f"{BASE_URL}/api/shipping/packages/{pid}", json={"status": "RTS DITERIMA GUDANG"})
        assert r2.status_code == 200
        assert r2.json()["status"] == "RTS DITERIMA GUDANG"

    def test_kpi(self, admin):
        r = admin.get(f"{BASE_URL}/api/shipping/kpi")
        assert r.status_code == 200
        data = r.json()
        assert "current" in data and "kemarin" in data
        for k in ("diproses", "beresiko", "terkirim", "cancel", "rts", "double", "perlu_dikirim"):
            assert k in data["current"]

    def test_export_csv(self, admin):
        r = admin.get(f"{BASE_URL}/api/shipping/export?submenu=process")
        assert r.status_code == 200
        assert "NO_RESI" in r.text.split("\n")[0]

    def test_cleanup_shipping(self, admin, created_resis):
        # Delete all TEST created packages
        for sub in ("process", "pengiriman", "cancel", "rts"):
            pkgs = admin.get(f"{BASE_URL}/api/shipping/packages?submenu={sub}&limit=5000").json()
            for p in pkgs:
                if p["no_resi"] in created_resis:
                    admin.delete(f"{BASE_URL}/api/shipping/packages/{p['id']}")


# ---------- GUDANG ----------
class TestGudang:
    def test_product_crud_and_stock(self, admin):
        sku = f"TEST_SKU_{uuid.uuid4().hex[:6].upper()}"
        payload = {"sku": sku, "nama": "TEST Produk", "stok_awal": 10, "stock_in": 5,
                   "return_in": 2, "stock_out": 3, "min_stock": 5, "hpp": 100, "harga_jual": 200}
        r = admin.post(f"{BASE_URL}/api/products", json=payload)
        assert r.status_code == 200, r.text
        p = r.json()
        pid = p["id"]
        assert p["stok_riil"] == 10 + 5 + 2 - 3
        assert p["status_stok"] == "STOCK AMAN"
        # Stock adjustment
        r2 = admin.post(f"{BASE_URL}/api/stock-adjustments",
                        json={"sku": sku, "tipe": "Barang Keluar (-)", "qty": 20, "catatan": "test"})
        assert r2.status_code == 200
        after = r2.json()["product"]
        assert after["status_stok"] == "RESTOCK !!"
        # Update
        r3 = admin.put(f"{BASE_URL}/api/products/{pid}", json={**payload, "nama": "TEST Produk 2"})
        assert r3.status_code == 200
        assert r3.json()["nama"] == "TEST Produk 2"
        # Delete
        r4 = admin.delete(f"{BASE_URL}/api/products/{pid}")
        assert r4.status_code == 200

    def test_gudang_summary(self, admin):
        r = admin.get(f"{BASE_URL}/api/gudang/summary")
        assert r.status_code == 200
        assert "total_sku" in r.json()


# ---------- MARKETPLACE ----------
class TestMarketplace:
    def test_stores_sync_summary(self, admin):
        r = admin.get(f"{BASE_URL}/api/mp/stores")
        assert r.status_code == 200
        r2 = admin.post(f"{BASE_URL}/api/mp/sync")
        assert r2.status_code == 200
        r3 = admin.get(f"{BASE_URL}/api/mp/summary")
        assert r3.status_code == 200
        assert "stores" in r3.json()

    def test_orders_list(self, admin):
        r = admin.get(f"{BASE_URL}/api/mp/orders")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_chats_list(self, admin):
        r = admin.get(f"{BASE_URL}/api/mp/chats")
        assert r.status_code == 200

    def test_promos(self, admin):
        r = admin.get(f"{BASE_URL}/api/mp/promos")
        assert r.status_code == 200
        promo = {"nama": "TEST_PROMO", "tipe": "Diskon", "store_ids": [], "nilai": 10,
                 "mulai": "2026-01-01", "selesai": "2026-02-01", "aktif": True}
        r2 = admin.post(f"{BASE_URL}/api/mp/promos", json=promo)
        assert r2.status_code == 200
        pid = r2.json()["id"]
        r3 = admin.delete(f"{BASE_URL}/api/mp/promos/{pid}")
        assert r3.status_code == 200


# ---------- MISC ----------
class TestMisc:
    def test_notifications(self, admin):
        r = admin.get(f"{BASE_URL}/api/notifications")
        assert r.status_code == 200
        assert "items" in r.json()
        r2 = admin.post(f"{BASE_URL}/api/notifications/read-all")
        assert r2.status_code == 200

    def test_dashboard(self, admin):
        r = admin.get(f"{BASE_URL}/api/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in ("shipping_today", "trend", "gudang", "marketplace", "pos_today"):
            assert k in d

    def test_pos_checkout_fail_empty(self, admin):
        r = admin.post(f"{BASE_URL}/api/pos/checkout", json={"items": [], "metode": "Cash", "bayar": 0})
        assert r.status_code == 400

    def test_pos_full_flow(self, admin):
        sku = f"TEST_POS_{uuid.uuid4().hex[:6].upper()}"
        p = admin.post(f"{BASE_URL}/api/products", json={"sku": sku, "nama": "TEST POS", "stok_awal": 50,
                                                          "hpp": 100, "harga_jual": 500}).json()
        try:
            r = admin.post(f"{BASE_URL}/api/pos/checkout",
                           json={"items": [{"sku": sku, "qty": 2}], "metode": "Cash", "bayar": 2000})
            assert r.status_code == 200
            assert r.json()["total"] == 1000
            # check stock_out increased
            prods = admin.get(f"{BASE_URL}/api/products?q={sku}").json()
            assert prods[0]["stock_out"] == 2
        finally:
            admin.delete(f"{BASE_URL}/api/products/{p['id']}")
