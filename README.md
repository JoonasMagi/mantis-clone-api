# Mantis Clone API

A basic issue tracker API built with **Express.js**, **SQLite**, **Session-based Authentication**, and **Swagger (
OpenAPI 3.0)**.

## Features

- User **registration, login, logout**, and **session-based authentication**.
- CRUD operations for **issues, labels, comments, and milestones**.
- **SQLite** database for persistence.
- **Swagger UI documentation** at `/api-docs`.
- **Centralized error handling**.
- **Security features** including rate limiting for authentication routes.

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

## 🔄 Resetting the Database

If you need to reset the database for testing or development purposes, use the following Node.js script instead of manually deleting the database files:

```bash
# Create a file named 'reset-db.js' with the following content:
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Define database file paths
const dbFiles = ['database.sqlite', 'sessions.sqlite'];

// Function to recreate the database structure
function initializeDatabase() {
  const db = new sqlite3.Database('database.sqlite', (err) => {
    if (err) {
      console.error('Error connecting to database:', err.message);
      return;
    }
    console.log('Database successfully recreated.');
    
    // Create tables
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          username   TEXT UNIQUE NOT NULL,
          password   TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP
        );
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS issues (
          id          TEXT PRIMARY KEY,
          title       TEXT      NOT NULL,
          description TEXT,
          status      TEXT      NOT NULL CHECK (status IN ('open','in_progress','resolved','closed')),
          priority    TEXT      NOT NULL CHECK (priority IN ('low','medium','high','critical')),
          assignee    TEXT,
          creator     TEXT      NOT NULL,
          created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at  TIMESTAMP
        );
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS labels (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          color       TEXT NOT NULL CHECK (color GLOB '^#[0-9A-Fa-f]{6}$'),
          description TEXT
        );
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS comments (
          id         TEXT PRIMARY KEY,
          issue_id   TEXT NOT NULL,
          content    TEXT NOT NULL,
          author     TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP
        );
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS milestones (
          id          TEXT PRIMARY KEY,
          title       TEXT NOT NULL,
          description TEXT,
          due_date    TEXT,
          status      TEXT NOT NULL CHECK (status IN ('open','closed'))
        );
      `, function(err) {
        if (err) {
          console.error("Error creating tables:", err.message);
        } else {
          console.log("Database tables successfully created.");
        }
        // Close the database connection
        db.close();
      });
    });
  });
}

// Backup existing database files
function backupDatabases() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, 'backups');
  
  // Create backups directory if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  dbFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const backupFile = path.join(backupDir, `${path.basename(file)}.${timestamp}.bak`);
      fs.copyFileSync(file, backupFile);
      console.log(`Backed up ${file} to ${backupFile}`);
    }
  });
}

// Reset databases
function resetDatabases() {
  // First backup the existing databases
  backupDatabases();
  
  // Then remove the existing database files
  dbFiles.forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`Removed ${file}`);
    }
  });
  
  // Finally initialize the database with fresh tables
  initializeDatabase();
  
  // Create a new empty sessions database
  const sessionsDb = new sqlite3.Database('sessions.sqlite', (err) => {
    if (err) {
      console.error('Error creating sessions database:', err.message);
    } else {
      console.log('Sessions database recreated successfully.');
      sessionsDb.close();
    }
  });
}

// Execute the reset
resetDatabases();
```

Run this script when you need to reset the database:

```bash
node reset-db.js
```

This method is safer than manually deleting files as it creates a backup of your data before resetting.
