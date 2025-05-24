# Mantis Clone API

A comprehensive issue tracking API built with **Express.js**, **SQLite**, **Session-based Authentication**, and **Swagger/OpenAPI 3.0** documentation.

## Features

- **User Management**: Registration, login, logout, and session-based authentication
- **Issue Tracking**: Complete CRUD operations for issues, labels, comments, and milestones
- **Data Persistence**: SQLite database with built-in backup functionality
- **API Documentation**: Interactive Swagger UI available in English and Estonian
- **Security**: Rate limiting, session management, and secure password handling
- **Error Handling**: Centralized error management with detailed logging

## 🚀 Getting Started

### Prerequisites

- **Node.js** (>=14)
- **npm** (Node Package Manager)

### Installation

```bash
# Install dependencies
npm install
```

### Configuration

Create a `.env` file in the project root:

```env
PORT=3000
SESSION_SECRET=your_secret_key
```

### Running the Server

```bash
npm start
```

The server will be available at `http://localhost:3000/`.

## 📖 API Documentation

### Swagger UI

Access the interactive API documentation:

- **English version**: `http://localhost:3000/en/`
- **Estonian version**: `http://localhost:3000/et/`
- **Default version**: `http://localhost:3000/api-docs/`

The documentation is generated dynamically from YAML files:
- `api.yaml` - Default documentation
- `api-en.yaml` - English documentation
- `api-et.yaml` - Estonian documentation

## 🔄 Database Management

### Reset Database

For testing or development purposes, use the provided script:

```bash
node reset-db.js
```

This will:
- Create a backup of existing data
- Reset the database to its initial state
- Recreate all necessary tables

## 💻 API Endpoints

- **Authentication**: `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`
- **Issues**: `/api/issues`
- **Labels**: `/api/labels`
- **Comments**: `/api/comments`
- **Milestones**: `/api/milestones`

For detailed endpoint documentation, refer to the Swagger UI.

## 🔐 Security

- Session-based authentication
- Password hashing
- Rate limiting on authentication routes
- Input validation

## 📊 Multilingual Support

The API documentation is available in:
- English
- Estonian

## 📄 License

This project is open-source and available for personal and educational use.
