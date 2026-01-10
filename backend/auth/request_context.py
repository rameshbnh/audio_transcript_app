from contextvars import ContextVar
import uuid

# Holds request ID per request
request_id_ctx: ContextVar[str] = ContextVar(
    "request_id",
    default=None
)

def generate_request_id() -> str:
    return str(uuid.uuid4())
