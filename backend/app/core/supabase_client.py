# # app/core/supabase_client.py
# from supabase import create_client, Client
# from app.core.config import settings

# if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
#     raise RuntimeError("Supabase URL or SERVICE_ROLE_KEY not configured")

# supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


# from supabase import create_client, Client
# import httpx

# # Disable HTTP/2 to avoid httpcore errors during large uploads
# transport = httpx.HTTPTransport(http2=False)

# supabase: Client = create_client(
#     settings.SUPABASE_URL,
#     settings.SUPABASE_SERVICE_ROLE_KEY,
#     http_client=httpx.Client(transport=transport, timeout=60.0)
# )


# app/core/supabase_client.py
from supabase import create_client
from app.core.config import settings

# Create a normal supabase client (no custom httpx injection because local package doesn't accept it)
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
