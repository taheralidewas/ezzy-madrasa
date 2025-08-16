# Use Node.js 18 Alpine for smaller size and better compatibility
FROM node:18-alpine

# Install Chromium and dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including whatsapp-web.js with its Puppeteer
RUN npm ci --only=production && \
    npm ls puppeteer-core || npm install puppeteer-core@latest

# Copy application code
COPY . .

# Create directories for WhatsApp data
RUN mkdir -p .wwebjs_auth .wwebjs_cache

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production

# Expose port
EXPOSE $PORT

# Start the application
CMD ["npm", "start"]