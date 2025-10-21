# app/main.py
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from .database.database import get_db # Importación correcta
from .api.v1.endpoints import matches, teams, players # Importamos os routers (xa debería funcionar se os ficheiros existen e están ben escritos)

app = FastAPI(title="Gaeliza API", version="0.1.0")

# Incluir routers de diferentes módulos
app.include_router(matches.router, prefix="/api/v1", tags=["matches"])
app.include_router(teams.router, prefix="/api/v1", tags=["teams"])
app.include_router(players.router, prefix="/api/v1", tags=["players"])

@app.get("/")
def read_root():
    return {"message": "Benvido a Gaeliza API!"}

# Endpoint de proba para verificar conexión e modelos
@app.get("/db-test")
async def test_db_connection(db: AsyncSession = Depends(get_db)):
    try:
        # Intenta facer unha pequena consulta para verificar a conexión
        result = await db.execute("SELECT 1")
        # Podes probar a interactuar cos modelos aquí tamén
        # from .models.models import Match
        # count = await db.execute(select(func.count(Match.id)))
        # print(f"Total matches: {count.scalar()}")
        return {"status": "Conexión OK"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro de conexión: {str(e)}")

# Exemplo de endpoint que usaría os modelos e esquemas (aínda sen autenticación real)
# from .models.models import Match as MatchModel
# from .schemas.schemas import MatchCreate
# import uuid # Para xerar un ID de proba

# @app.post("/matches_raw/", response_model=Match)
# async def create_match_raw(match_data: MatchCreate, db: AsyncSession = Depends(get_db)):
#     # ESTE EXEMPLO NON É REALISTA SEN AUTENTICACIÓN
#     # created_by = "un_user_id_obtido_do_token" # Isto é o correcto
#     # created_by = str(uuid.uuid4()) # Isto é un hack de proba, NON usar en produción
#     # Supoñamos que o created_by veñen do token JWT, por iso NON o incluímos en MatchCreate
#     # Pero para probalo, imos facer unha chamada directa a SQLAlchemy
#     # O ideal é crear unha función no ficheiro de lóxica de negocio (services) ou dentro do endpoint de matches
#     db_match = MatchModel(
#         home_team_id=match_data.home_team_id,
#         away_team_id=match_data.away_team_id,
#         match_date=match_data.match_date,
#         location=match_data.location,
#         competition=match_data.competition,
#         video_url=match_data.video_url,
#         # created_by=created_by # Aquí debería ir o ID do usuario autenticado
#         # Por agora, imos deixar created_by como NULL ou usar un valor por defecto se é obrigatorio
#         # Se é obrigatorio, imos necesitar autenticación primeiro.
#         # Por exemplo, imos asumir un ID de proba temporal
#         created_by="temp_user_id_for_testing" # NON usar en produción
#     )
#     db.add(db_match)
#     await db.commit()
#     await db.refresh(db_match)
#     return db_match # Isto devolverá un obxecto Match que se converterá a JSON grazas a Pydantic

# Lembra que para interactuar cos modelos e esquemas, tamén necesitas importalos
# from .models.models import Match as MatchModel, Team as TeamModel, Player as PlayerModel, Action as ActionModel
# from .schemas.schemas import Match as MatchSchema, MatchCreate as MatchCreateSchema, etc.

# Inclúe os outros routers e o endpoint principal
# xa o fixemos arriba con app.include_router