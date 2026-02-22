import json
from fastapi import WebSocket
from typing import Dict


class WebSocketManager:
    def __init__(self):
        self._connections: Dict[str, WebSocket] = {}

    async def connect(self, session_id: str, ws: WebSocket):
        await ws.accept()
        self._connections[session_id] = ws

    def disconnect(self, session_id: str):
        self._connections.pop(session_id, None)

    async def broadcast(self, session_id: str, message: dict):
        ws = self._connections.get(session_id)
        if ws:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                self.disconnect(session_id)


ws_manager = WebSocketManager()
