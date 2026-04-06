# Import all models so Alembic can detect them
from app.db.session import Base  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.student import Student  # noqa: F401
from app.models.locker import Locker  # noqa: F401
from app.models.assignment import Assignment  # noqa: F401
