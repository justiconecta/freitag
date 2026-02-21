from fastapi import Depends, HTTPException, Header

from app.config import get_settings, Settings
from app.models.database import get_supabase_client


async def get_current_user(
    authorization: str = Header(...),
    settings: Settings = Depends(get_settings),
):
    """Validate Supabase JWT and return user info."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = authorization.replace("Bearer ", "")

    try:
        supabase = get_supabase_client(settings)
        user_response = supabase.auth.get_user(token)

        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        return user_response.user
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")
