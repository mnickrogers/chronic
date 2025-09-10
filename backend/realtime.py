from typing import Dict, Set
from fastapi import WebSocket
from asyncio import Lock


class WSManager:
    def __init__(self) -> None:
        self.channels: Dict[str, Set[WebSocket]] = {}
        self.lock = Lock()

    async def subscribe(self, channel: str, ws: WebSocket):
        async with self.lock:
            self.channels.setdefault(channel, set()).add(ws)

    async def unsubscribe(self, channel: str, ws: WebSocket):
        async with self.lock:
            conns = self.channels.get(channel)
            if conns and ws in conns:
                conns.remove(ws)
                if not conns:
                    self.channels.pop(channel, None)

    async def broadcast(self, channel: str, message: dict):
        conns = list(self.channels.get(channel, set()))
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                # Drop broken sockets silently
                await self.unsubscribe(channel, ws)


manager = WSManager()

