from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from .config import settings
from .routers import auth, orgs, projects, tasks, comments, realtime


def create_app() -> FastAPI:
    app = FastAPI(title="Chronic API", default_response_class=ORJSONResponse)

    # CORS for local dev (Next.js on 3000)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(auth.router, prefix="/api")
    app.include_router(orgs.router, prefix="/api")
    app.include_router(projects.router, prefix="/api")
    app.include_router(tasks.router, prefix="/api")
    app.include_router(comments.router, prefix="/api")
    app.include_router(realtime.router)

    @app.get("/healthz")
    async def healthz():
        return {"ok": True}

    return app


app = create_app()
