# Mantis Clone Deployment Guide

This document provides instructions for deploying the Mantis Clone API and frontend.

## Overview

The Mantis Clone application consists of two main components:

1. **API (Backend)**: An Express.js application with SQLite database
2. **Frontend**: A React application served from the same Express server

## Deployment Architecture

For simplicity, we've integrated the frontend into the API server. The Express server serves:
- API endpoints at the root path (`/`)
- Frontend React application at `/web/`
- API documentation at `/en/`, `/et/`, and `/api-docs/`

## Deployment Steps

### Prerequisites

- Node.js (>=14)
- npm (Node Package Manager)

### Deploying the Application

1. **Clone the repository**

```bash
git clone https://github.com/username/mantis-clone-api.git
cd mantis-clone-api
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

Create a `.env` file in the project root:

```env
PORT=3000
SESSION_SECRET=your_secret_key
```

4. **Start the server**

For production, you can use a process manager like PM2:

```bash
npm install -g pm2
pm2 start app.js --name mantis-clone
```

Or run directly with Node:

```bash
node app.js
```

5. **Access the application**

- Frontend: `http://your-domain.com/web/`
- API Documentation: `http://your-domain.com/api-docs/`

## Updating the Frontend

The frontend is already built and included in the `web/` directory. If you need to update it:

1. Make changes to the source code in `mantis-clone-web/`
2. Build the frontend:

```bash
cd mantis-clone-web
npm install
npm run build
```

3. Copy the build files to the `web/` directory:

```bash
rm -rf ../web/* && cp -r dist/* ../web/
```

4. Restart the server if necessary.

## Troubleshooting

- **Port already in use**: Change the port in the app.js file
- **CORS issues**: If accessing the API from a different domain, you may need to add CORS headers
- **Database issues**: The SQLite database file is created automatically; ensure the server has write permissions to the directory

## Domain Setup

For production, set up a domain with proper SSL certificates. If using a reverse proxy like Nginx, configure it to point to your Node.js application.