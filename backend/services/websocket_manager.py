import asyncio
from typing import Dict, List, Any
from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections and provides sync/async broadcast methods."""

    def __init__(self):
        # Maps event_id -> list of active WebSocket connections
        self.active_connections: Dict[int, List[WebSocket]] = {}
        self.loop: asyncio.AbstractEventLoop = None

    def set_loop(self, loop: asyncio.AbstractEventLoop):
        """Capture the main event loop for cross-thread broadcasting."""
        self.loop = loop

    async def connect(self, websocket: WebSocket, event_id: int):
        """Accept a connection and track it by event_id."""
        await websocket.accept()
        if event_id not in self.active_connections:
            self.active_connections[event_id] = []
        self.active_connections[event_id].append(websocket)
        print(f"WS: Client connected to event {event_id}. Total: {len(self.active_connections[event_id])}")

    def disconnect(self, websocket: WebSocket, event_id: int):
        """Untrack a disconnected websocket."""
        if event_id in self.active_connections:
            self.active_connections[event_id].remove(websocket)
            if not self.active_connections[event_id]:
                del self.active_connections[event_id]
        print(f"WS: Client disconnected from event {event_id}")

    async def broadcast_to_event(self, event_id: int, message: Dict[str, Any]):
        """Broadcast an async message to all clients of a specific event."""
        if event_id in self.active_connections:
            for connection in self.active_connections[event_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"WS Error: Failed to send message: {e}")

    def broadcast_sync(self, event_id: int, message: Dict[str, Any]):
        """Safe method to broadcast from synchronous threads (e.g., Watchdog)."""
        print(f"WS Sync: Attempting broadcast for event {event_id}, message: {message}")
        if self.loop is None:
            print("WS Error: Loop not set in ConnectionManager. Make sure lifespan is running.")
            return

        if event_id in self.active_connections:
            print(f"WS Sync: Found {len(self.active_connections[event_id])} active connections for event {event_id}")
            asyncio.run_coroutine_threadsafe(
                self.broadcast_to_event(event_id, message), 
                self.loop
            )
        else:
            print(f"WS Sync: No active connections for event {event_id}")


# Global singleton instance
manager = ConnectionManager()


def get_websocket_manager() -> ConnectionManager:
    """Get the global WebSocket manager singleton."""
    return manager
