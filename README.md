# Mantis Clone API

A basic issue tracker API built with **Express.js**, **SQLite**, **Session-based Authentication**, and **Swagger (OpenAPI 3.0)**.

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
1. **Register a User**
```bash
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "pass123"}'
```

2. **Login a User**
```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"username": "alice", "password": "pass123"}'
```
The session cookie will be stored in `cookies.txt`.

3. **Access Protected Routes**
```bash
curl -X GET http://localhost:3000/profile -b cookies.txt
```

4. **Logout**
```bash
curl -X POST http://localhost:3000/logout -b cookies.txt
```

---

## 📝 API Endpoints

### 🔐 Auth Routes
| Method | Endpoint     | Description |
|--------|-------------|-------------|
| POST   | /register   | Register a new user |
| POST   | /login      | Log in a user |
| POST   | /logout     | Log out user |
| GET    | /profile    | Get logged-in user details |

### 📌 Issue Routes
| Method | Endpoint     | Description |
|--------|-------------|-------------|
| GET    | /issues     | Get all issues |
| POST   | /issues     | Create a new issue |
| GET    | /issues/{id} | Get issue details |
| PATCH  | /issues/{id} | Update an issue |
| DELETE | /issues/{id} | Delete an issue |

### 🏷 Label Routes
| Method | Endpoint    | Description |
|--------|------------|-------------|
| GET    | /labels    | Get all labels |
| POST   | /labels    | Create a new label |

### 💬 Comment Routes
| Method | Endpoint             | Description |
|--------|----------------------|-------------|
| GET    | /issues/{id}/comments | Get comments for an issue |
| POST   | /issues/{id}/comments | Add a comment to an issue |

### 🎯 Milestone Routes
| Method | Endpoint     | Description |
|--------|-------------|-------------|
| GET    | /milestones | Get all milestones |
| POST   | /milestones | Create a new milestone |

---

## ❌ Error Handling
All errors follow this structure:
```json
{
  "code": "ERROR_CODE",
  "message": "Error description",
  "details": {}
}
```

Common error responses:
| HTTP Code | Meaning |
|-----------|---------|
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## 📌 Development Notes
- **Database**: Uses **SQLite**.
- **Sessions**: Uses `express-session` with `connect-sqlite3`.
- **Password Hashing**: Uses `bcrypt` for secure password storage.
- **Documentation**: Uses **Swagger UI** for API reference.

---

## 🎯 Future Enhancements
- Add **email verification** for new users.
- Implement **role-based access control** (RBAC).
- Add support for **OAuth login** (Google, GitHub, etc.).

---

## 👨‍💻 Contributing
1. Fork the repository.
2. Create a feature branch: `git checkout -b feature-name`.
3. Commit changes: `git commit -m 'Add new feature'`.
4. Push to the branch: `git push origin feature-name`.
5. Submit a pull request!

---

## 📄 License
MIT License. See `LICENSE` for details.

---

### 🎉 Thank You!
Enjoy using **Mantis Clone API**! 🚀 If you have any issues or feature requests, feel free to create an issue.

