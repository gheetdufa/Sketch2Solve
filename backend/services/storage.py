import os
import aiofiles

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


async def save_file(session_id: str, filename: str, data: bytes) -> str:
    session_dir = os.path.join(UPLOAD_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    filepath = os.path.join(session_dir, filename)
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(data)
    return f"/uploads/{session_id}/{filename}"
