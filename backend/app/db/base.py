# Import all models so Alembic can detect them
from app.db.session import Base  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.student import Student  # noqa: F401
from app.models.locker import Locker  # noqa: F401
from app.models.assignment import Assignment  # noqa: F401
from app.models.audit_log import AuditLog  # noqa: F401
from app.models.incident import LockerIncident  # noqa: F401
from app.models.notification import Notification  # noqa: F401
