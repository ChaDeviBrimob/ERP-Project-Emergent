from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

import os
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from core import client
from routes_auth import router as auth_router
from routes_gudang import router as gudang_router
from routes_shipping import router as shipping_router
from routes_marketplace import router as mp_router
from routes_misc import router as misc_router
from seed import seed_users, seed_demo

app = FastAPI(title="VRCHINDO ERP")
for r in (auth_router, gudang_router, shipping_router, mp_router, misc_router):
    app.include_router(r)


@app.get("/api/")
async def root():
    return {"app": "VRCHINDO ERP", "ok": True}


app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ["FRONTEND_URL"].split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await seed_users()
    await seed_demo()


@app.on_event("shutdown")
async def shutdown():
    client.close()
