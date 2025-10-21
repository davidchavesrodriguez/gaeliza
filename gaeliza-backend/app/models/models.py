from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, DECIMAL, Boolean
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime
import uuid

Base = declarative_base()


class Profile(Base):
    __tablename__ = "profiles"
    id = Column(String, primary_key=True) 
    username = Column(String, unique=True, nullable=False)
    full_name = Column(String)
    avatar_url = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    matches = relationship("Match", back_populates="creator")

class Team(Base):
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    shield_url = Column(String)
    type = Column(String, default="temporal", check_constraint="type IN ('oficial', 'temporal')")
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String, ForeignKey("profiles.id")) # Relación co perfil do usuario

    home_matches = relationship("Match", foreign_keys="Match.home_team_id", back_populates="home_team")
    away_matches = relationship("Match", foreign_keys="Match.away_team_id", back_populates="away_team")
    players = relationship("Player", back_populates="team")
    match_participants = relationship("MatchParticipant", back_populates="team")

class Player(Base):
    __tablename__ = "players"
    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    number = Column(Integer)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True) # Pode ser nulo
    created_at = Column(DateTime, default=datetime.utcnow)

    team = relationship("Team", back_populates="players")
    actions = relationship("Action", back_populates="player")

class Match(Base):
    __tablename__ = "matches"
    id = Column(Integer, primary_key=True, index=True)
    home_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    away_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    match_date = Column(DateTime, nullable=False)
    location = Column(String)
    competition = Column(String)
    video_url = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String, ForeignKey("profiles.id"), nullable=False) # Quen creou o partido

    home_team = relationship("Team", foreign_keys=[home_team_id], back_populates="home_matches")
    away_team = relationship("Team", foreign_keys=[away_team_id], back_populates="away_matches")
    actions = relationship("Action", back_populates="match")
    participants = relationship("MatchParticipant", back_populates="match")
    creator = relationship("Profile", back_populates="matches")

class Action(Base):
    __tablename__ = "actions"
    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=True) # Pode ser nulo
    type = Column(String, nullable=False)
    minute = Column(Integer, nullable=False)
    second = Column(Integer, default=0)
    x_position = Column(DECIMAL(5,2))
    y_position = Column(DECIMAL(5,2))
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    match = relationship("Match", back_populates="actions")
    player = relationship("Player", back_populates="actions")

class MatchParticipant(Base):
    __tablename__ = "match_participants"
    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    position = Column(String)
    minutes_played = Column(Integer, default=0)

    match = relationship("Match", back_populates="participants")
    player = relationship("Player", back_populates="match_participations")
    team = relationship("Team", back_populates="match_participants")

Team.players = relationship("Player", back_populates="team")
Player.match_participations = relationship("MatchParticipant", back_populates="player")
MatchParticipant.player = relationship("Player", back_populates="match_participations")