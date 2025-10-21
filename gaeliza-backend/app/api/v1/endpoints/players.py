from fastapi import APIRouter

router = APIRouter()

@router.get("/players")
def get_players():
    return {"message": "Obtendo xogadores..."}

@router.post("/players")
def create_player():
    return {"message": "Creando un novo xogador..."}
