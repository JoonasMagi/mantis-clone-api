// Run: node app.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

// Load Swagger documents
const swaggerDocumentEN = YAML.load('./api-en.yaml');
const swaggerDocumentET = YAML.load('./api-et.yaml');
// Use English as default
const swaggerDocument = swaggerDocumentEN;

const app = express();
const port = process.env.PORT || 3000;

// CORS Configuration
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'], // Allow frontend and docs
    credentials: true, // Allow cookies/sessions
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Parse JSON bodies
app.use(express.json());

// --------------------------
// Session Middleware
// --------------------------
app.use(
    session({
        store: new SQLiteStore({ db: 'sessions.sqlite', dir: '.' }),
        secret: process.env.SESSION_SECRET || 'fallback_secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * 60, // 1 hour
            httpOnly: true, // Prevent XSS attacks
            secure: false, // Set to true in production with HTTPS
            sameSite: 'lax' // CSRF protection
        }
    })
);

// --------------------------
// Database Initialization
// --------------------------
const db = new sqlite3.Database('database.sqlite', (err) => {
    if (err) {
        console.error('Error connecting to SQLite database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
    }
});

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
  `);
});

// --------------------------
// Swagger UI - Multilingual Documentation
// --------------------------

// Import separate Swagger modules to avoid caching issues
const swaggerEN = require('./swagger-en');
const swaggerET = require('./swagger-et');

// Default documentation (English)
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerDocumentEN, {
    customSiteTitle: 'Mantis Clone API - English (Default)',
    customCss: '.swagger-ui .topbar { display: none }'
}));

// English documentation
app.use('/en', swaggerEN);

// Estonian documentation
app.use('/et', swaggerET);

// --------------------------
// Helper: checkAuth for protected routes
// --------------------------
function checkAuth(req, res, _next) {
    if (!req.session.user) {
        return res.status(401).json({
            code: 'UNAUTHORIZED',
            message: 'Unauthorized: Please log in.'
        });
    }
    _next();
}

// --------------------------
// Routes
// --------------------------

// Home Route with Language Selection (public)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Mantis Clone API - Language Selection</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    margin: 0;
                    padding: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .container {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                    padding: 3rem;
                    text-align: center;
                    max-width: 500px;
                    width: 90%;
                }
                h1 {
                    color: #333;
                    margin-bottom: 0.5rem;
                    font-size: 2.5rem;
                    font-weight: 700;
                }
                .subtitle {
                    color: #666;
                    margin-bottom: 2rem;
                    font-size: 1.1rem;
                }
                .language-buttons {
                    display: flex;
                    gap: 1rem;
                    justify-content: center;
                    flex-wrap: wrap;
                    margin-bottom: 2rem;
                }
                .lang-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 1rem 2rem;
                    background: #667eea;
                    color: white;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 1.1rem;
                    transition: all 0.3s ease;
                    border: none;
                    cursor: pointer;
                    min-width: 150px;
                }
                .lang-btn:hover {
                    background: #5a6fd8;
                    transform: translateY(-2px);
                    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
                }
                .lang-btn.estonian {
                    background: #28a745;
                }
                .lang-btn.estonian:hover {
                    background: #218838;
                    box-shadow: 0 8px 20px rgba(40, 167, 69, 0.3);
                }
                .flag {
                    font-size: 1.5rem;
                }
                .info {
                    color: #666;
                    font-size: 0.9rem;
                    line-height: 1.5;
                    margin-top: 2rem;
                    padding-top: 2rem;
                    border-top: 1px solid #eee;
                }
                .info a {
                    color: #667eea;
                    text-decoration: none;
                }
                .info a:hover {
                    text-decoration: underline;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🐛 Mantis Clone API</h1>
                <p class="subtitle">Choose your preferred language for API documentation</p>
                <p class="subtitle" style="font-size: 0.9rem; color: #888;">Valige API dokumentatsiooni jaoks eelistatud keel</p>

                <div class="language-buttons">
                    <a href="/en/" class="lang-btn">
                        <span class="flag">🇬🇧</span>
                        <span>English</span>
                    </a>
                    <a href="/et/" class="lang-btn estonian">
                        <span class="flag">🇪🇪</span>
                        <span>Eesti keel</span>
                    </a>
                </div>

                <div class="info">
                    <p><strong>About this API:</strong></p>
                    <p>A comprehensive issue tracking API built with Express.js, SQLite, and Swagger/OpenAPI 3.0 documentation.</p>
                    <p><strong>Selle API kohta:</strong></p>
                    <p>Põhjalik ülesannete jälgimise API, mis on ehitatud Express.js, SQLite ja Swagger/OpenAPI 3.0 dokumentatsiooniga.</p>
                    <br>
                    <p>Default documentation: <a href="/api-docs/">/api-docs/</a></p>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Create a new user (POST /register)
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({
            code: 'INVALID_INPUT',
            message: 'Username and password are required.'
        });
    }
    const now = new Date().toISOString();
    bcrypt
        .hash(password, 10)
        .then((hashedPassword) => {
            db.run(
                `
        INSERT INTO users (username, password, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        `,
                [username, hashedPassword, now, now],
                function (err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint failed')) {
                            return res.status(409).json({
                                code: 'USER_EXISTS',
                                message: 'Username already taken.'
                            });
                        }
                        return res.status(500).json({
                            code: 'DB_ERROR',
                            message: err.message
                        });
                    }
                    res.status(201).json({
                        message: 'User registered successfully!',
                        user_id: this.lastID
                    });
                }
            );
        })
        .catch((error) => {
            res.status(500).json({
                code: 'HASH_ERROR',
                message: error.message
            });
        });
});

// Create a new session (POST /login)
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({
            code: 'INVALID_INPUT',
            message: 'Username and password are required.'
        });
    }
    db.get(
        `SELECT * FROM users WHERE username = ?`,
        [username],
        async (err, user) => {
            if (err) {
                return res
                    .status(500)
                    .json({ code: 'DB_ERROR', message: err.message });
            }
            if (!user) {
                return res
                    .status(401)
                    .json({ code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' });
            }
            try {
                const match = await bcrypt.compare(password, user.password);
                if (!match) {
                    return res
                        .status(401)
                        .json({ code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' });
                }
                // Successful login
                req.session.user = { id: user.id, username: user.username };
                res.json({
                    message: 'Session created successfully!',
                    user: { id: user.id, username: user.username },
                    session_id: req.session.id
                });
            } catch (error) {
                res.status(500).json({ code: 'HASH_ERROR', message: error.message });
            }
        }
    );
});

// Delete a session (DELETE /sessions/:sessionId) => protected
app.delete('/sessions/:sessionId', checkAuth, (req, res) => {
    const { sessionId } = req.params;

    // Check if the session ID matches the current session
    if (sessionId !== req.session.id) {
        return res.status(403).json({
            code: 'FORBIDDEN',
            message: 'You can only delete your own session.'
        });
    }

    req.session.destroy((err) => {
        if (err) {
            return res
                .status(500)
                .json({ code: 'LOGOUT_ERROR', message: 'Session deletion failed.' });
        }
        // Clear the session cookie more thoroughly
        res.clearCookie('connect.sid', {
            path: '/',
            httpOnly: true,
            secure: false,
            sameSite: 'lax'
        });
        res.json({ message: 'Session deleted successfully!' });
    });
});

// Simple logout endpoint (POST /logout) => protected
app.post('/logout', checkAuth, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res
                .status(500)
                .json({ code: 'LOGOUT_ERROR', message: 'Logout failed.' });
        }
        // Clear the session cookie more thoroughly
        res.clearCookie('connect.sid', {
            path: '/',
            httpOnly: true,
            secure: false,
            sameSite: 'lax'
        });
        res.json({ message: 'Logged out successfully!' });
    });
});

// Get current user profile (GET /profile) => protected
app.get('/profile', checkAuth, (req, res) => {
    res.json({
        message: 'Current user profile retrieved successfully.',
        user: req.session.user
    });
});

// --------------------------
// Issues
// --------------------------

// GET /issues
app.get('/issues', (req, res) => {
    const { status, priority, label, milestone, page = '1', per_page = '20' } =
        req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(per_page, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    if (status) {
        conditions.push('status = ?');
        params.push(status);
    }
    if (priority) {
        conditions.push('priority = ?');
        params.push(priority);
    }
    // ignoring label/milestone usage for a naive approach

    const whereClause = conditions.length
        ? 'WHERE ' + conditions.join(' AND ')
        : '';

    const sql = `
    SELECT * FROM issues
    ${whereClause}
    LIMIT ${limitNum} OFFSET ${offset}
  `;
    db.all(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ code: 'DB_ERROR', message: err.message });
        }
        res.json({
            data: rows,
            pagination: {
                total: rows.length,
                page: pageNum,
                per_page: limitNum
            }
        });
    });
});

// POST /issues
app.post('/issues', (req, res) => {
    const { title, description, status, priority, assignee, creator } = req.body;
    if (!title || !status || !priority || !creator) {
        return res.status(400).json({
            code: 'INVALID_INPUT',
            message: 'Missing required fields for creating an issue.'
        });
    }
    const now = new Date().toISOString();
    const newId = uuidv4();
    db.run(
        `
    INSERT INTO issues (id, title, description, status, priority, assignee, creator, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
        [newId, title, description || '', status, priority, assignee || '', creator, now, now],
        function (err) {
            if (err) {
                return res.status(500).json({ code: 'DB_ERROR', message: err.message });
            }
            db.get(`SELECT * FROM issues WHERE id = ?`, [newId], (err2, row) => {
                if (err2) {
                    return res.status(500).json({ code: 'DB_ERROR', message: err2.message });
                }
                res.status(201).json(row);
            });
        }
    );
});

// GET /issues/:issueId
app.get('/issues/:issueId', (req, res) => {
    const { issueId } = req.params;
    db.get(`SELECT * FROM issues WHERE id = ?`, [issueId], (err, row) => {
        if (err) {
            return res.status(500).json({ code: 'DB_ERROR', message: err.message });
        }
        if (!row) {
            return res
                .status(404)
                .json({ code: 'NOT_FOUND', message: 'Issue not found' });
        }
        res.json(row);
    });
});

// PATCH /issues/:issueId
app.patch('/issues/:issueId', (req, res) => {
    const { issueId } = req.params;
    const now = new Date().toISOString();
    const fields = [];
    const params = [];

    if (req.body.title !== undefined) {
        fields.push('title = ?');
        params.push(req.body.title);
    }
    if (req.body.description !== undefined) {
        fields.push('description = ?');
        params.push(req.body.description);
    }
    if (req.body.status !== undefined) {
        fields.push('status = ?');
        params.push(req.body.status);
    }
    if (req.body.priority !== undefined) {
        fields.push('priority = ?');
        params.push(req.body.priority);
    }
    if (req.body.assignee !== undefined) {
        fields.push('assignee = ?');
        params.push(req.body.assignee);
    }

    fields.push('updated_at = ?');
    params.push(now);

    if (!fields.length) {
        return res.status(400).json({
            code: 'NO_UPDATE_FIELDS',
            message: 'No fields provided for update.'
        });
    }

    const sql = `UPDATE issues SET ${fields.join(', ')} WHERE id = ?`;
    params.push(issueId);

    db.run(sql, params, function (err) {
        if (err) {
            return res.status(500).json({ code: 'DB_ERROR', message: err.message });
        }
        if (this.changes === 0) {
            return res
                .status(404)
                .json({ code: 'NOT_FOUND', message: 'Issue not found' });
        }
        db.get(`SELECT * FROM issues WHERE id = ?`, [issueId], (err2, row) => {
            if (err2) {
                return res.status(500).json({ code: 'DB_ERROR', message: err2.message });
            }
            res.json(row);
        });
    });
});

// DELETE /issues/:issueId
app.delete('/issues/:issueId', (req, res) => {
    const { issueId } = req.params;
    db.run(`DELETE FROM issues WHERE id = ?`, [issueId], function (err) {
        if (err) {
            return res.status(500).json({ code: 'DB_ERROR', message: err.message });
        }
        if (this.changes === 0) {
            return res
                .status(404)
                .json({ code: 'NOT_FOUND', message: 'Issue not found' });
        }
        res.status(204).send();
    });
});

// Comments
// GET /issues/:issueId/comments
app.get('/issues/:issueId/comments', (req, res) => {
    const { issueId } = req.params;
    db.all(`SELECT * FROM comments WHERE issue_id = ?`, [issueId], (err, rows) => {
        if (err) {
            return res.status(500).json({ code: 'DB_ERROR', message: err.message });
        }
        res.json(rows);
    });
});

// POST /issues/:issueId/comments
app.post('/issues/:issueId/comments', (req, res) => {
    const { issueId } = req.params;
    const { content, author } = req.body;
    if (!content || !author) {
        return res.status(400).json({
            code: 'INVALID_INPUT',
            message: 'content and author are required.'
        });
    }

    // First check if the issue exists
    db.get(`SELECT id FROM issues WHERE id = ?`, [issueId], (err, issue) => {
        if (err) {
            return res.status(500).json({ code: 'DB_ERROR', message: err.message });
        }
        if (!issue) {
            return res.status(404).json({
                code: 'NOT_FOUND',
                message: 'Cannot add comment: Issue not found'
            });
        }

        const now = new Date().toISOString();
        const newId = uuidv4();
        db.run(
            `
        INSERT INTO comments (id, issue_id, content, author, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
            [newId, issueId, content, author, now, now],
            function (err) {
                if (err) {
                    return res
                        .status(500)
                        .json({ code: 'DB_ERROR', message: err.message });
                }
                db.get(`SELECT * FROM comments WHERE id = ?`, [newId], (err2, row) => {
                    if (err2) {
                        return res
                            .status(500)
                            .json({ code: 'DB_ERROR', message: err2.message });
                    }
                    res.status(201).json(row);
                });
            }
        );
    });
});

// Labels
// GET /labels
app.get('/labels', (req, res) => {
    db.all(`SELECT * FROM labels`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ code: 'DB_ERROR', message: err.message });
        }
        res.json(rows);
    });
});

// POST /labels
app.post('/labels', (req, res) => {
    const { name, color, description } = req.body;
    if (!name || !color) {
        return res.status(400).json({
            code: 'INVALID_INPUT',
            message: 'name and color are required.'
        });
    }
    const newId = uuidv4();
    db.run(
        `
    INSERT INTO labels (id, name, color, description)
    VALUES (?, ?, ?, ?)
    `,
        [newId, name, color, description || ''],
        function (err) {
            if (err) {
                return res
                    .status(500)
                    .json({ code: 'DB_ERROR', message: err.message });
            }
            db.get(`SELECT * FROM labels WHERE id = ?`, [newId], (err2, row) => {
                if (err2) {
                    return res
                        .status(500)
                        .json({ code: 'DB_ERROR', message: err2.message });
                }
                res.status(201).json(row);
            });
        }
    );
});

// Milestones
// GET /milestones
app.get('/milestones', (req, res) => {
    const { status } = req.query;
    let sql = `SELECT * FROM milestones`;
    const params = [];
    if (status) {
        sql += ` WHERE status = ?`;
        params.push(status);
    }
    db.all(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ code: 'DB_ERROR', message: err.message });
        }
        res.json(rows);
    });
});

// POST /milestones
app.post('/milestones', (req, res) => {
    const { title, description, due_date, status } = req.body;
    if (!title || !description || !due_date || !status) {
        return res.status(400).json({
            code: 'INVALID_INPUT',
            message: 'title, due_date, status, and description are required.'
        });
    }
    const newId = uuidv4();
    db.run(
        `
    INSERT INTO milestones (id, title, description, due_date, status)
    VALUES (?, ?, ?, ?, ?)
    `,
        [newId, title, description, due_date, status],
        function (err) {
            if (err) {
                return res.status(500).json({ code: 'DB_ERROR', message: err.message });
            }
            db.get(`SELECT * FROM milestones WHERE id = ?`, [newId], (err2, row) => {
                if (err2) {
                    return res
                        .status(500)
                        .json({ code: 'DB_ERROR', message: err2.message });
                }
                res.status(201).json(row);
            });
        }
    );
});

// Fallback 404
app.use((req, res) => {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Not Found' });
});

// Central Error Handler
app.use((err, req, res, _unusedNext) => {
    err.status = undefined;
    err.code = undefined;
    err.message = undefined;
    err.details = undefined;
    console.error(err);
    res.status(err.status || 500).json({
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Internal Server Error',
        details: err.details || {}
    });
});

// Start the Server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`Language selection page: http://localhost:${port}/`);
    console.log(`English docs: http://localhost:${port}/en/`);
    console.log(`Estonian docs: http://localhost:${port}/et/`);
    console.log(`Default docs: http://localhost:${port}/api-docs/`);
});
