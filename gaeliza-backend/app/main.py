# app/main.py
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from .database.database import get_db
from .api.v1.endpoints import matches, teams, players, auth

app = FastAPI(title="Gaeliza API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "Benvido a Gaeliza API!"}

@app.get("/api/v1/health")
async def health_check():
    return {"status": "ok"}

@app.get("/db-test")
async def test_db_connection(db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute("SELECT 1")
        return {"status": "Conexión OK"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro de conexión: {str(e)}")