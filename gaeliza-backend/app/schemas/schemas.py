from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal

# --- Profile ---
class ProfileBase(BaseModel):
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

class ProfileCreate(ProfileBase):
    pass

class Profile(ProfileBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True 

# --- Team ---
class TeamBase(BaseModel):
    name: str
    shield_url: Optional[str] = None
    type: Optional[str] = "temporal" 

class TeamCreate(TeamBase):
    pass

class Team(TeamBase):
    id: int
    created_at: datetime
    created_by: Optional[str] = None

    class Config:
        from_attributes = True

# --- Player ---
class PlayerBase(BaseModel):
    first_name: str
    last_name: str
    number: Optional[int] = None
    team_id: Optional[int] = None

class PlayerCreate(PlayerBase):
    pass

class Player(PlayerBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- Match ---
class MatchBase(BaseModel):
    home_team_id: int
    away_team_id: int
    match_date: datetime
    location: Optional[str] = None
    competition: Optional[str] = None
    video_url: Optional[str] = None

class MatchCreate(MatchBase):
    pass

class Match(MatchBase):
    id: int
    created_at: datetime
    created_by: str 

    class Config:
        from_attributes = True

# --- Action ---
class ActionBase(BaseModel):
    match_id: int
    player_id: Optional[int] = None
    type: str
    minute: int
    second: Optional[int] = 0
    x_position: Optional[Decimal] = None
    y_position: Optional[Decimal] = None
    description: Optional[str] = None

class ActionCreate(ActionBase):
    pass

class Action(ActionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- MatchParticipant ---
class MatchParticipantBase(BaseModel):
    match_id: int
    player_id: int
    team_id: int
    position: Optional[str] = None
    minutes_played: Optional[int] = 0

class MatchParticipantCreate(MatchParticipantBase):
    pass

class MatchParticipant(MatchParticipantBase):
    id: int

    class Config:
        from_attributes = True