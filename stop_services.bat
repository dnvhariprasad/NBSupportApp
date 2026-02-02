@echo off
echo Checking for running services...

REM Find and kill process on port 8080 (Spring Boot)
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8080" ^| find "LISTENING"') do (
    echo Stopping Backend on port 8080 with PID %%a...
    taskkill /f /pid %%a
)

REM Find and kill process on port 5173 (React/Vite)
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5173" ^| find "LISTENING"') do (
    echo Stopping Frontend on port 5173 with PID %%a...
    taskkill /f /pid %%a
)

echo Done.
