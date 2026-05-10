# MarcosScript Backend

## Run the Backend

### Option 1 — From the project root (recommended)

```bash
cd C:\Users\Usuario\Desktop\Aplicaciones\MarcosScript
uv run uvicorn backend.main:app --reload
```

### Option 2 — From inside the `backend/` folder

```bash
cd C:\Users\Usuario\Desktop\Aplicaciones\MarcosScript\backend
uvicorn main:app --reload
```

> This works because `main.py` automatically adds the project root to `sys.path` at startup, so `from backend.database import ...` resolves correctly regardless of where you run from.

Both commands start the API on `http://localhost:8000`.

## Run Tests

```bash
cd C:\Users\Usuario\Desktop\Aplicaciones\MarcosScript\backend
pytest
```

## Why `backend.main:app`?

The project root is `MarcosScript/`, and the backend package lives at `backend/`. Using `backend.main:app` ensures Python resolves absolute imports like `from backend.database import ...` correctly.

Do NOT run `uvicorn main:app` from inside the `backend/` directory — that causes `ModuleNotFoundError: No module named 'backend'` because the `backend` package is not on the Python path when running from within itself.