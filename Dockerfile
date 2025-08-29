# Mantis Clone SOAP Service Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create database directory
RUN mkdir -p /app/data

# Expose SOAP service port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/soap?wsdl || exit 1

# Start the SOAP service
CMD ["node", "src/soap-server.js"]
