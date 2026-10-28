# MODUL-AI para cualquier VPS con Docker:
#   docker build -t modul-ai .
#   docker run -d --name modul-ai -p 3000:3000 -v modul-data:/app/data --restart unless-stopped modul-ai
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public
RUN mkdir -p /app/data && chown node:node /app/data
ENV HOST=0.0.0.0 PORT=3000 DATA_DIR=/app/data
VOLUME /app/data
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "--no-warnings=ExperimentalWarning", "server/server.mjs"]
