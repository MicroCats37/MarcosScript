@echo off
echo Iniciando MarcosScript...

echo.
echo [1/3] Configurando el Backend...
cd backend
call uv sync
cd ..

echo.
echo [2/3] Ejecutando migraciones de la base de datos...
call backend\.venv\Scripts\python -m backend.migrations

echo.
echo [3/3] Iniciando servicios...

:: Iniciar Backend en una nueva ventana
start "MarcosScript Backend" cmd /k "echo Iniciando Backend... && title MarcosScript Backend && backend\.venv\Scripts\uvicorn backend.main:app --reload"

:: Iniciar Frontend en una nueva ventana
cd frontend
echo Instalando dependencias del Frontend (si faltan)...
call npm install
start "MarcosScript Frontend" cmd /k "echo Iniciando Frontend... && title MarcosScript Frontend && npm run dev"
cd ..

echo.
echo ========================================================
echo MarcosScript iniciado correctamente.
echo ========================================================
echo - Backend API: http://127.0.0.1:8000
echo - Frontend UI: http://localhost:5173
echo.
echo Se han abierto dos ventanas nuevas (una para el backend y otra para el frontend).
echo Para detener los servicios, simplemente cierra esas ventanas.
echo ========================================================
echo.
pause
