# app/api/v1/endpoints/matches.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List # Importa List para anotar o tipo da resposta

# Asegúrate de que as rutas relativas sexan correctas
# from ...database import get_db # Ruta relativa antiga
from app.database.database import get_db # Ruta absoluta desde o paquete 'app'
from app.models.models import Match as MatchModel # Ruta absoluta
from app.schemas.schemas import MatchCreate, Match # Ruta absoluta

# Importa select
from sqlalchemy import select

router = APIRouter()

# Endpoint para obter todos os partidos (só para probas, despois pode haber RLS)
@router.get("/matches", response_model=List[Match]) # Anotamos o tipo de resposta
async def get_matches(db: AsyncSession = Depends(get_db)):
    # Consulta simple para obter todos os partidos
    result = await db.execute(select(MatchModel))
    matches = result.scalars().all()
    return matches

# Endpoint para crear un novo partido
@router.post("/matches", response_model=Match)
async def create_match(match_data: MatchCreate, db: AsyncSession = Depends(get_db)):
    # Aquí é onde normalmente verificarías o token JWT para obter o 'created_by'
    # Por agora, imos usar un ID temporal para probas.
    # ESTE É O PUNTO CRÍTICO PARA INTEGRAR A AUTENTICACIÓN REAL DE SUPABASE MÁIS ADELANTE.
    # Por exemplo, poderías recibir o 'user_id' como parámetro dunha función de dependencia de autenticación.
    # created_by = get_current_user_id_from_token(...) # Esta función crearíase despois
    created_by = "temp_user_id_for_testing" # ID temporal, substitúe isto cando teñas autenticación

    # Valida que os equipos existan (opcional pero recomendado)
    # result_home = await db.execute(select(TeamModel).where(TeamModel.id == match_data.home_team_id))
    # home_team = result_home.scalar_one_or_none()
    # if not home_team:
    #     raise HTTPException(status_code=404, detail="Home team not found")

    # result_away = await db.execute(select(TeamModel).where(TeamModel.id == match_data.away_team_id))
    # away_team = result_away.scalar_one_or_none()
    # if not away_team:
    #     raise HTTPException(status_code=404, detail="Away team not found")

    # Crea o obxecto MatchModel coas credenciais e os datos do esquema
    db_match = MatchModel(
        home_team_id=match_data.home_team_id,
        away_team_id=match_data.away_team_id,
        match_date=match_data.match_date,
        location=match_data.location,
        competition=match_data.competition,
        video_url=match_data.video_url,
        created_by=created_by # O ID do usuario autenticado
    )

    # Engade o obxecto á sesión e confirma os cambios na base de datos
    db.add(db_match)
    await db.commit()
    await db.refresh(db_match) # Actualiza o obxecto co ID xerado pola base de datos

    # Devolve o partido creado, convertido automaticamente a JSON grazas a Pydantic
    return db_match
