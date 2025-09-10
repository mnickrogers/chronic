from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..realtime import manager


router = APIRouter(tags=["realtime"]) 


@router.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data = await ws.receive_json()
            if "subscribe" in data:
                await manager.subscribe(data["subscribe"], ws)
                await ws.send_json({"type": "subscribed", "channel": data["subscribe"]})
            elif "unsubscribe" in data:
                await manager.unsubscribe(data["unsubscribe"], ws)
                await ws.send_json({"type": "unsubscribed", "channel": data["unsubscribe"]})
    except WebSocketDisconnect:
        # Clean up: remove from all channels
        for channel, conns in list(manager.channels.items()):
            if ws in conns:
                await manager.unsubscribe(channel, ws)

