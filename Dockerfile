# Multi-stage build for F1 WebGPU Backend
FROM node:20-slim AS base

# Install Python and system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend code
COPY backend ./backend
COPY package*.json ./

# Install Node.js dependencies
WORKDIR /app/backend/node
RUN npm install

# Install Python dependencies
WORKDIR /app/backend/python
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# Set working directory back to app root
WORKDIR /app

# Expose port (Railway will override with PORT env var)
EXPOSE 3001

# Start the Node.js server
CMD ["node", "backend/node/server.mjs"]
