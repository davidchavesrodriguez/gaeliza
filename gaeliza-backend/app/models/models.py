# Reemplaza la clase Profile en tu models.py con esta versión:

class Profile(Base):
    __tablename__ = "profiles"
    id = Column(String, primary_key=True) 
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)  # AÑADIDO
    password_hash = Column(String, nullable=False)  # AÑADIDO
    full_name = Column(String)
    avatar_url = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    matches = relationship("Match", back_populates="creator")