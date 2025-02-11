// index.js

// Load environment variables from .env
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

// Load Swagger document
// NOTE: We'll update api.yaml (next section) to include the fallback route
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
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
                                             id INTEGER PRIMARY KEY AUTOINCREMENT,
                                             username TEXT UNIQUE NOT NULL,
                                             password TEXT NOT NULL,
                                             created_at TEXT,
                                             updated_at TEXT
        )
    `);
});

// --------------------------
// Swagger UI Route
// --------------------------
// noinspection JSUnusedLocalSymbols, JSCheckFunctionSignatures
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// --------------------------
// Helper Middleware: Check Authentication (Session Based)
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
// Routes
// --------------------------

// Public Home Route
app.get('/', (req, res) => {
    res.send('Welcome to the session-based user management API!');
});

// Register Route (Public)
// noinspection JSUnusedLocalSymbols, JSCheckFunctionSignatures
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

// Login Route (Public)
// noinspection JSUnusedLocalSymbols, JSCheckFunctionSignatures
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
        db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
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
                // Successful login: create session
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
        });
    })
);

// Logout Route (Protected)
app.post('/logout', checkAuth, (req, res, next) => {
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

// Profile Route (Protected)
app.get('/profile', checkAuth, (req, res) => {
    res.json({
        message: 'This is a protected profile route.',
        user: req.session.user
    });
});

// --------------------------
// 404 Handler for Undefined Routes
// --------------------------
app.use((req, res, next) => {
    const err = new Error('Not Found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    next(err);
});

// --------------------------
// Centralized Error-Handling Middleware
// --------------------------
// noinspection JSUnusedLocalSymbols, JSCheckFunctionSignatures
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
