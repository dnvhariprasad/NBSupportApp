#!/bin/bash

echo "Checking for running services..."

# Kill process on port 8080 (Spring Boot)
if lsof -ti:8080 > /dev/null; then
    echo "Stopping Backend on port 8080..."
    kill -9 $(lsof -ti:8080)
    echo "Backend stopped."
else
    echo "No process found on port 8080."
fi

# Kill process on port 5173 (React/Vite)
if lsof -ti:5173 > /dev/null; then
    echo "Stopping Frontend on port 5173..."
    kill -9 $(lsof -ti:5173)
    echo "Frontend stopped."
else
    echo "No process found on port 5173."
fi
