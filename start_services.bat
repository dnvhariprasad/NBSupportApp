@echo off
echo Starting Services...

REM Stop existing services first
call stop_services.bat

echo Starting Backend (Spring Boot)...
cd backend
if exist mvnw.cmd (
    start "Backend" cmd /k "mvnw.cmd spring-boot:run"
) else (
    echo "mvnw.cmd not found, trying mvn..."
    start "Backend" cmd /k "mvn spring-boot:run"
)
cd ..

echo Starting Frontend (React/Vite)...
cd frontend
if not exist node_modules (
    echo node_modules not found. Running npm install...
    call npm install
)
start "Frontend" cmd /k "npm run dev"
cd ..

echo Services started in separate windows.
