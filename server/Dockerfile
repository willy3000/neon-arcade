# Blackout Protocol online co-op relay. Build from the server/ folder:  docker build -t blackout-relay .
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY relay.js ./
ENV NODE_ENV=production PORT=8787 RELAY_TRUST_PROXY=1
EXPOSE 8787
USER node
CMD ["node", "relay.js"]
