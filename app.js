// Load environment variables from .env
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid'); // For generating UUIDs
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

// Load Swagger document
const swaggerDocument = YAML.load('./api.yaml');

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// --------------------------
// Session Middleware
// --------------------------
app.use(
    session({
        store: new SQLiteStore({ db: 'sessions.sqlite', dir: '.' }),
        secret: process.env.SESSION_SECRET,
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
    // Users table for session-based auth
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      assignee TEXT,
      creator TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS labels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      description TEXT
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL,
      content TEXT NOT NULL,
      author TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT,
      status TEXT
    )
  `);
});

// --------------------------
// Swagger UI
// --------------------------
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// --------------------------
// Helper Middleware: checkAuth
// --------------------------
function checkAuth(req, res, next) {
    if (!req.session.user) {
        const err = new Error('Unauthorized: Please log in.');
        err.status = 401;
        err.code = 'UNAUTHORIZED';
        return next(err);
    }
    next();
}

// --------------------------
// Async Handler Wrapper
// --------------------------
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// --------------------------
// Auth & Session Routes
// --------------------------

// Home (public)
app.get('/', (req, res) => {
    res.send('Welcome to the session-based user management API!');
});

// Register (POST /register)
app.post(
    '/register',
    asyncHandler(async (req, res, next) => {
        const { username, password } = req.body;
        if (!username || !password) {
            const err = new Error('Username and password are required.');
            err.status = 400;
            err.code = 'INVALID_INPUT';
            return next(err);
        }
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const now = new Date().toISOString();
            db.run(
                `INSERT INTO users (username, password, created_at, updated_at)
         VALUES (?, ?, ?, ?)`,
                [username, hashedPassword, now, now],
                function (err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint failed')) {
                            const error = new Error('Username already taken.');
                            error.status = 409;
                            error.code = 'USER_EXISTS';
                            return next(error);
                        }
                        const error = new Error(err.message);
                        error.status = 500;
                        error.code = 'DB_ERROR';
                        return next(error);
                    }
                    res.status(201).json({
                        message: 'User registered successfully!',
                        user_id: this.lastID
                    });
                }
            );
        } catch (error) {
            error.status = 500;
            error.code = 'HASH_ERROR';
            next(error);
        }
    })
);

// Login (POST /login)
app.post(
    '/login',
    asyncHandler(async (req, res, next) => {
        const { username, password } = req.body;
        if (!username || !password) {
            const err = new Error('Username and password are required.');
            err.status = 400;
            err.code = 'INVALID_INPUT';
            return next(err);
        }
        db.get(
            `SELECT * FROM users WHERE username = ?`,
            [username],
            async (err, user) => {
                if (err) {
                    const error = new Error(err.message);
                    error.status = 500;
                    error.code = 'DB_ERROR';
                    return next(error);
                }
                if (!user) {
                    const error = new Error('Invalid username or password.');
                    error.status = 401;
                    error.code = 'INVALID_CREDENTIALS';
                    return next(error);
                }
                try {
                    const match = await bcrypt.compare(password, user.password);
                    if (!match) {
                        const error = new Error('Invalid username or password.');
                        error.status = 401;
                        error.code = 'INVALID_CREDENTIALS';
                        return next(error);
                    }
                    // Successful login
                    req.session.user = { id: user.id, username: user.username };
                    res.json({
                        message: 'Logged in successfully!',
                        user: { id: user.id, username: user.username }
                    });
                } catch (error) {
                    error.status = 500;
                    error.code = 'HASH_ERROR';
                    next(error);
                }
            }
        );
    })
);

// Logout (DELETE /logout) => protected
app.delete('/logout', checkAuth, (req, res, next) => {
    req.session.destroy((err) => {
        if (err) {
            const error = new Error('Logout failed.');
            error.status = 500;
            error.code = 'LOGOUT_ERROR';
            return next(error);
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
app.get(
    '/issues',
    asyncHandler(async (req, res, next) => {
        // Example: handle query params like ?status=, ?priority=, etc.
        const { status, priority, label, milestone, page = 1, per_page = 20 } =
            req.query;
        // Build a WHERE clause dynamically
        let conditions = [];
        let params = [];

        if (status) {
            conditions.push('status = ?');
            params.push(status);
        }
        if (priority) {
            conditions.push('priority = ?');
            params.push(priority);
        }
        // label and milestone are not used in a naive approach unless you do a JOIN or store them differently

        const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
        const limit = Math.min(per_page, 100);
        const offset = (page - 1) * limit;

        const sql = `
      SELECT * FROM issues
      ${whereClause}
      LIMIT ${limit} OFFSET ${offset}
    `;
        db.all(sql, params, (err, rows) => {
            if (err) {
                const error = new Error(err.message);
                error.status = 500;
                error.code = 'DB_ERROR';
                return next(error);
            }
            // Return them as "GetIssue" shape
            // For simplicity, just returning the rows
            // Real code might transform each row to match the EXACT field structure
            res.json({
                data: rows,
                pagination: {
                    total: rows.length, // naive approach, or do a separate COUNT(*)
                    page: parseInt(page, 10),
                    per_page: parseInt(limit, 10)
                }
            });
        });
    })
);

// POST /issues => CreateIssue
app.post(
    '/issues',
    asyncHandler(async (req, res, next) => {
        // According to `CreateIssue`, we expect { title, status, priority, creator, ... }
        const { title, description, status, priority, assignee, creator, labels, milestone } = req.body;
        if (!title || !status || !priority || !creator) {
            const err = new Error('Missing required fields for creating an issue.');
            err.status = 400;
            err.code = 'INVALID_INPUT';
            return next(err);
        }
        const now = new Date().toISOString();
        const newId = uuidv4();
        db.run(
            `INSERT INTO issues (id, title, description, status, priority, assignee, creator, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [newId, title, description || '', status, priority, assignee || '', creator, now, now],
            function (err) {
                if (err) {
                    const error = new Error(err.message);
                    error.status = 500;
                    error.code = 'DB_ERROR';
                    return next(error);
                }
                // Return the newly created record as `GetIssue`
                db.get(`SELECT * FROM issues WHERE id = ?`, [newId], (err, row) => {
                    if (err) {
                        const error = new Error(err.message);
                        error.status = 500;
                        error.code = 'DB_ERROR';
                        return next(error);
                    }
                    res.status(201).json(row);
                });
            }
        );
    })
);

// GET /issues/:issueId => GetIssue
app.get(
    '/issues/:issueId',
    asyncHandler((req, res, next) => {
        const { issueId } = req.params;
        db.get(`SELECT * FROM issues WHERE id = ?`, [issueId], (err, row) => {
            if (err) {
                const error = new Error(err.message);
                error.status = 500;
                error.code = 'DB_ERROR';
                return next(error);
            }
            if (!row) {
                const error = new Error('Issue not found');
                error.status = 404;
                error.code = 'NOT_FOUND';
                return next(error);
            }
            res.json(row);
        });
    })
);

// PATCH /issues/:issueId => UpdateIssue => returns GetIssue
app.patch(
    '/issues/:issueId',
    asyncHandler((req, res, next) => {
        const { issueId } = req.params;
        // We'll build an UPDATE statement dynamically based on fields present
        const fields = [];
        const params = [];
        const now = new Date().toISOString();

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
        // ignoring labels and milestone for now, as they'd typically require separate tables or references

        fields.push('updated_at = ?');
        params.push(now);

        if (!fields.length) {
            // no fields to update
            return res.status(400).json({
                code: 'NO_UPDATE_FIELDS',
                message: 'No fields provided for update.'
            });
        }

        const sql = `UPDATE issues SET ${fields.join(', ')} WHERE id = ?`;
        params.push(issueId);

        db.run(sql, params, function (err) {
            if (err) {
                const error = new Error(err.message);
                error.status = 500;
                error.code = 'DB_ERROR';
                return next(error);
            }
            if (this.changes === 0) {
                const error = new Error('Issue not found');
                error.status = 404;
                error.code = 'NOT_FOUND';
                return next(error);
            }
            // Return updated record
            db.get(`SELECT * FROM issues WHERE id = ?`, [issueId], (err, row) => {
                if (err) {
                    const error = new Error(err.message);
                    error.status = 500;
                    error.code = 'DB_ERROR';
                    return next(error);
                }
                res.json(row);
            });
        });
    })
);

// DELETE /issues/:issueId
app.delete(
    '/issues/:issueId',
    asyncHandler((req, res, next) => {
        const { issueId } = req.params;
        db.run(`DELETE FROM issues WHERE id = ?`, [issueId], function (err) {
            if (err) {
                const error = new Error(err.message);
                error.status = 500;
                error.code = 'DB_ERROR';
                return next(error);
            }
            if (this.changes === 0) {
                const error = new Error('Issue not found');
                error.status = 404;
                error.code = 'NOT_FOUND';
                return next(error);
            }
            res.status(204).send();
        });
    })
);

// --------------------------
// Comments
// --------------------------

// GET /issues/:issueId/comments
app.get(
    '/issues/:issueId/comments',
    asyncHandler((req, res, next) => {
        const { issueId } = req.params;
        db.all(`SELECT * FROM comments WHERE issue_id = ?`, [issueId], (err, rows) => {
            if (err) {
                const error = new Error(err.message);
                error.status = 500;
                error.code = 'DB_ERROR';
                return next(error);
            }
            res.json(rows);
        });
    })
);

// POST /issues/:issueId/comments => CreateComment => returns GetComment
app.post(
    '/issues/:issueId/comments',
    asyncHandler((req, res, next) => {
        const { issueId } = req.params;
        const { content, author } = req.body; // from CreateComment
        if (!content || !author) {
            const err = new Error('content and author are required.');
            err.status = 400;
            err.code = 'INVALID_INPUT';
            return next(err);
        }
        const now = new Date().toISOString();
        const newId = uuidv4();

        db.run(
            `INSERT INTO comments (id, issue_id, content, author, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [newId, issueId, content, author, now, now],
            function (err) {
                if (err) {
                    const error = new Error(err.message);
                    error.status = 500;
                    error.code = 'DB_ERROR';
                    return next(error);
                }
                // Return newly created comment (GetComment shape)
                db.get(`SELECT * FROM comments WHERE id = ?`, [newId], (err, row) => {
                    if (err) {
                        const error = new Error(err.message);
                        error.status = 500;
                        error.code = 'DB_ERROR';
                        return next(error);
                    }
                    res.status(201).json(row);
                });
            }
        );
    })
);

// --------------------------
// Labels
// --------------------------

// GET /labels => returns array of GetLabel
app.get(
    '/labels',
    asyncHandler((req, res, next) => {
        db.all(`SELECT * FROM labels`, [], (err, rows) => {
            if (err) {
                const error = new Error(err.message);
                error.status = 500;
                error.code = 'DB_ERROR';
                return next(error);
            }
            res.json(rows);
        });
    })
);

// POST /labels => CreateLabel => returns GetLabel
app.post(
    '/labels',
    asyncHandler((req, res, next) => {
        const { name, color, description } = req.body;
        if (!name || !color) {
            const err = new Error('name and color are required.');
            err.status = 400;
            err.code = 'INVALID_INPUT';
            return next(err);
        }
        const newId = uuidv4();
        db.run(
            `INSERT INTO labels (id, name, color, description) VALUES (?, ?, ?, ?)`,
            [newId, name, color, description || ''],
            function (err) {
                if (err) {
                    const error = new Error(err.message);
                    error.status = 500;
                    error.code = 'DB_ERROR';
                    return next(error);
                }
                db.get(`SELECT * FROM labels WHERE id = ?`, [newId], (err, row) => {
                    if (err) {
                        const error = new Error(err.message);
                        error.status = 500;
                        error.code = 'DB_ERROR';
                        return next(error);
                    }
                    res.status(201).json(row);
                });
            }
        );
    })
);

// --------------------------
// Milestones
// --------------------------

// GET /milestones => returns array of GetMilestone
app.get(
    '/milestones',
    asyncHandler((req, res, next) => {
        const { status } = req.query; // can be open or closed
        let sql = `SELECT * FROM milestones`;
        let params = [];
        if (status) {
            sql += ` WHERE status = ?`;
            params.push(status);
        }
        db.all(sql, params, (err, rows) => {
            if (err) {
                const error = new Error(err.message);
                error.status = 500;
                error.code = 'DB_ERROR';
                return next(error);
            }
            res.json(rows);
        });
    })
);

// POST /milestones => CreateMilestone => returns GetMilestone
app.post(
    '/milestones',
    asyncHandler((req, res, next) => {
        const { title, description, due_date, status } = req.body;
        if (!title || !due_date || !status || !description) {
            const err = new Error('title, due_date, status, and description are required.');
            err.status = 400;
            err.code = 'INVALID_INPUT';
            return next(err);
        }
        const newId = uuidv4();
        db.run(
            `INSERT INTO milestones (id, title, description, due_date, status)
       VALUES (?, ?, ?, ?, ?)`,
            [newId, title, description, due_date, status],
            function (err) {
                if (err) {
                    const error = new Error(err.message);
                    error.status = 500;
                    error.code = 'DB_ERROR';
                    return next(error);
                }
                db.get(`SELECT * FROM milestones WHERE id = ?`, [newId], (err, row) => {
                    if (err) {
                        const error = new Error(err.message);
                        error.status = 500;
                        error.code = 'DB_ERROR';
                        return next(error);
                    }
                    res.status(201).json(row);
                });
            }
        );
    })
);

// --------------------------
// Fallback 404
// --------------------------
app.use((req, res, next) => {
    const err = new Error('Not Found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    next(err);
});

// --------------------------
// Error Handler
// --------------------------
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Internal Server Error',
        details: err.details || {}
    });
});

// --------------------------
// Start the Server
// --------------------------
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`Swagger docs available at http://localhost:${port}/api-docs`);
});
