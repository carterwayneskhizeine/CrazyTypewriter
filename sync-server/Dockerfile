FROM node:20-alpine

WORKDIR /app

# Install native dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3001

CMD ["npm", "start"]
