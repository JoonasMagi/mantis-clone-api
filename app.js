// Run: node app.js
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
// FIX: Add rate limiter for brute force protection
const rateLimit = require('express-rate-limit');

// Load Swagger document
const swaggerDocument = YAML.load('./api.yaml');

const app = express();
const port = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());

// FIX: Create rate limiter for authentication routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many login attempts, please try again after 15 minutes'
    }
});

// --------------------------
// Session Middleware
// --------------------------
app.use(
    session({
        store: new SQLiteStore({ 
            db: 'sessions.sqlite', 
            dir: '.',
            // Add clearExpired option to automatically clean up expired sessions
            clearExpired: true,
            // Check for expired sessions every hour (in milliseconds)
            checkExpirationInterval: 60 * 60 * 1000
        }),
        secret: process.env.SESSION_SECRET || 'fallback_secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * 60 // 1 hour
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
// Swagger UI
// --------------------------
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

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

// Home Route (public)
app.get('/', (req, res) => {
    res.send('Welcome to the session-based user management API!');
});

// Register (POST /register)
// FIX: Add rate limiting for authentication endpoints
app.post('/register', authLimiter, (req, res) => {
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
            // Don't expose bcrypt error messages to clients
            console.error('Password hashing error:', error.message);
            res.status(500).json({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An error occurred during registration. Please try again.'
            });
        });
});

// Login (POST /login)
// FIX: Add rate limiting for authentication endpoints
app.post('/login', authLimiter, (req, res) => {
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
                    message: 'Logged in successfully!',
                    user: { id: user.id, username: user.username }
                });
            } catch (error) {
                // Don't expose bcrypt error messages to clients
                console.error('Password comparison error:', error.message);
                res.status(500).json({ 
                    code: 'INTERNAL_SERVER_ERROR', 
                    message: 'An error occurred during login. Please try again.' 
                });
            }
        }
    );
});

// Logout (DELETE /logout) => protected
app.delete('/logout', checkAuth, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res
                .status(500)
                .json({ code: 'LOGOUT_ERROR', message: 'Logout failed.' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out successfully!' });
    });
});

// Profile (GET /profile) => protected
app.get('/profile', checkAuth, (req, res) => {
    res.json({
        message: 'This is a protected profile route.',
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
// FIX: Add checkAuth to protect data-modifying endpoints
app.post('/issues', checkAuth, (req, res) => {
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
// FIX: Add checkAuth to protect data-modifying endpoints
app.patch('/issues/:issueId', checkAuth, (req, res) => {
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
// FIX: Add checkAuth to protect data-modifying endpoints
app.delete('/issues/:issueId', checkAuth, (req, res) => {
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
// FIX: Add checkAuth to protect data-modifying endpoints
app.post('/issues/:issueId/comments', checkAuth, (req, res) => {
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
// FIX: Add checkAuth to protect data-modifying endpoints
app.post('/labels', checkAuth, (req, res) => {
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
// FIX: Add checkAuth to protect data-modifying endpoints
app.post('/milestones', checkAuth, (req, res) => {
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
// FIX: Don't overwrite error properties but provide defaults if missing
app.use((err, req, res, _unusedNext) => {
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
    console.log(`Swagger docs available at http://localhost:${port}/api-docs`);
});
