from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.websocket import manager
from app.routers import (
    assignments,
    audit_logs,
    auth,
    dashboard,
    incidents,
    lockers,
    notifications,
    students,
    users,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="Locker Management System",
    description="Full-stack locker management system for students",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API v1 router
api_prefix = "/api/v1"
app.include_router(auth.router, prefix=api_prefix)
app.include_router(users.router, prefix=api_prefix)
app.include_router(students.router, prefix=api_prefix)
app.include_router(lockers.router, prefix=api_prefix)
app.include_router(assignments.router, prefix=api_prefix)
app.include_router(dashboard.router, prefix=api_prefix)
app.include_router(incidents.router, prefix=api_prefix)
app.include_router(audit_logs.router, prefix=api_prefix)
app.include_router(notifications.router, prefix=api_prefix)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "locker-management-system"}
