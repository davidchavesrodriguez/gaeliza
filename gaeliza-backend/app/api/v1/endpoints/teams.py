from fastapi import APIRouter

router = APIRouter()

@router.get("/teams")
def get_teams():
    return {"message": "Obtendo equipos..."}

@router.post("/teams")
def create_team():
    return {"message": "Creando un novo equipo..."}
