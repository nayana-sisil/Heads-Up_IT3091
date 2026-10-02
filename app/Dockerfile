# Stage 1: build the web interface
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: API plus the built interface in one container
FROM python:3.11-slim
RUN useradd -m -u 1000 user
WORKDIR /home/user/app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=user backend/ .
COPY --chown=user --from=web /web/dist ./static
USER user
ENV PORT=7860
EXPOSE 7860
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
