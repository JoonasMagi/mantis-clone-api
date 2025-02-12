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
JWT_SECRET=your_jwt_secret
```

### Run the Server

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

## 🛠 Database Setup

SQLite is used as the database.
When you start the server for the first time, the following tables are created:

- `users` (for authentication)
- `issues` (for issue tracking)
- `labels` (for tagging issues)
- `comments` (for user discussions on issues)
- `milestones` (for project tracking)

### Reset the Database

To reset your database, delete `database.sqlite` and restart the server:

```bash
rm database.sqlite
npm start
```

---

## 🔑 Authentication

This API uses **session-based authentication**.

**Register a User**

```bash
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "pass123"}'
```

**Login a User**

```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"username": "alice", "password": "pass123"}'
```

The session cookie will be stored in `cookies.txt`.

**Access Protected Routes**

```bash
curl -X GET http://localhost:3000/profile -b cookies.txt
```

**Logout**

```bash
curl -X POST http://localhost:3000/logout -b cookies.txt
```

## 📌 Development Notes

- **Database**: Uses **SQLite**.
- **Sessions**: Uses `express-session` with `connect-sqlite3`.
- **Password Hashing**: Uses `bcrypt` for secure password storage.
- **Documentation**: Uses **Swagger UI** for API reference.

---

## 📄 License

MIT License. See `LICENSE` for details.

---

### 🎉 Thank You!

Enjoy using **Mantis Clone API**! 🚀 If you have any issues or feature requests, feel free to create an issue.

