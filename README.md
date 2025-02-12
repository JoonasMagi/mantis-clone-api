# Mantis Clone API

A basic issue tracker API built with **Express.js**, **SQLite**, **Session-based Authentication**, and **Swagger (
OpenAPI 3.0)**.

## Features

- User **registration, login, logout**, and **session-based authentication**.
- CRUD operations for **issues, labels, comments, and milestones**.
- **SQLite** database for persistence.
- **Swagger UI documentation** at `/api-docs`.
- **Centralized error handling**.

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed:

- **Node.js** (>=14)
- **npm** (Node Package Manager)

### Install Dependencies

```bash
npm install
```

### Create an `.env` File

Create a `.env` file in the project root and add the following:

```env
PORT=3000
SESSION_SECRET=your_secret_key
```

### 5Run the Server

```bash
npm start
```

The server will start at `http://localhost:3000/`.

---

## 📖 API Documentation

### Swagger UI

Once the server is running, visit:

```
http://localhost:3000/api-docs
```

This provides an interactive API documentation interface.

---