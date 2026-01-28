#!/bin/bash

# Function to kill processes on exit
cleanup() {
    echo "Stopping services..."
    kill $BACKEND_PID
    kill $FRONTEND_PID
    exit
}

# Trap SIGINT (Ctrl+C)
trap cleanup SIGINT

# Function to check and kill process by port
check_and_kill() {
    PORT=$1
    NAME=$2
    if lsof -ti:$PORT > /dev/null; then
        echo "Port $PORT ($NAME) is in use. Killing process..."
        kill -9 $(lsof -ti:$PORT)
        echo "Process on port $PORT killed."
    else
        echo "Port $PORT is free."
    fi
}

# Pre-check and cleanup
check_and_kill 8080 "Backend"
check_and_kill 5173 "Frontend"

echo "Starting Backend (Spring Boot)..."
cd backend
./mvnw spring-boot:run &
BACKEND_PID=$!
echo "Backend started with PID $BACKEND_PID"

echo "Starting Frontend (React/Vite)..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!
echo "Frontend started with PID $FRONTEND_PID"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
