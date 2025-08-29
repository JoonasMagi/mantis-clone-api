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
          color       TEXT NOT NULL CHECK (color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
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
          status      TEXT NOT NULL CHECK (status IN ('open','closed')),
          created_at  TIMESTAMP,
          updated_at  TIMESTAMP
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
