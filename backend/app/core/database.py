from supabase import create_client, Client
from app.core.config import settings
from functools import lru_cache

@lru_cache()
def get_supabase() -> Client:
    return create_client(
        settings.supabase_url,
        settings.supabase_service_key  # service key for server-side operations
    )

db: Client = get_supabase()

# Alias used by chat.py for Storage uploads (same service-role client)
supabase_admin: Client = db