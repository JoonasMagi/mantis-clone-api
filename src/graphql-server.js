// GraphQL Server for Mantis Clone API
// Provides the same functionality as the REST API

require('dotenv').config();
const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { readFileSync } = require('fs');
const { join } = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

// Load GraphQL schema
const typeDefs = readFileSync(join(__dirname, '../schema/schema.graphql'), 'utf8');

// Database setup (reuse existing database)
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error connecting to SQLite database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
    }
});

// Initialize database tables if they don't exist
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

    db.run(`DROP TABLE IF EXISTS labels`);
    db.run(`
        CREATE TABLE labels (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            color       TEXT NOT NULL,
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
    `);
});

// Session storage (in-memory for simplicity, like REST version)
const sessions = new Map();

// Helper functions
function generateSessionToken() {
    return uuidv4();
}

function validateSession(sessionToken) {
    return sessions.get(sessionToken);
}

// Enum conversion helpers
function dbToGraphQLStatus(dbStatus) {
    const statusMap = {
        'open': 'OPEN',
        'in_progress': 'IN_PROGRESS',
        'resolved': 'RESOLVED',
        'closed': 'CLOSED'
    };
    return statusMap[dbStatus] || dbStatus;
}

function graphQLToDbStatus(graphqlStatus) {
    const statusMap = {
        'OPEN': 'open',
        'IN_PROGRESS': 'in_progress',
        'RESOLVED': 'resolved',
        'CLOSED': 'closed'
    };
    return statusMap[graphqlStatus] || graphqlStatus.toLowerCase();
}

function dbToGraphQLPriority(dbPriority) {
    const priorityMap = {
        'low': 'LOW',
        'medium': 'MEDIUM',
        'high': 'HIGH',
        'critical': 'CRITICAL'
    };
    return priorityMap[dbPriority] || dbPriority;
}

function graphQLToDbPriority(graphqlPriority) {
    const priorityMap = {
        'LOW': 'low',
        'MEDIUM': 'medium',
        'HIGH': 'high',
        'CRITICAL': 'critical'
    };
    return priorityMap[graphqlPriority] || graphqlPriority.toLowerCase();
}

function dbToGraphQLMilestoneStatus(dbStatus) {
    const statusMap = {
        'open': 'OPEN',
        'closed': 'CLOSED'
    };
    return statusMap[dbStatus] || dbStatus;
}

function graphQLToDbMilestoneStatus(graphqlStatus) {
    const statusMap = {
        'OPEN': 'open',
        'CLOSED': 'closed'
    };
    return statusMap[graphqlStatus] || graphqlStatus.toLowerCase();
}

// GraphQL resolvers
const resolvers = {
    // Custom scalar for DateTime
    DateTime: {
        serialize: (value) => value,
        parseValue: (value) => value,
        parseLiteral: (ast) => ast.value,
    },

    // Enum resolvers - these map GraphQL enum values to their serialized form
    IssueStatus: {
        OPEN: 'OPEN',
        IN_PROGRESS: 'IN_PROGRESS',
        RESOLVED: 'RESOLVED',
        CLOSED: 'CLOSED'
    },

    IssuePriority: {
        LOW: 'LOW',
        MEDIUM: 'MEDIUM',
        HIGH: 'HIGH',
        CRITICAL: 'CRITICAL'
    },

    MilestoneStatus: {
        OPEN: 'OPEN',
        CLOSED: 'CLOSED'
    },

    Query: {
        // Authentication
        profile: async (_, { session_token }) => {
            const user = validateSession(session_token);
            if (!user) {
                throw new Error('Invalid session');
            }
            return user;
        },

        // Issues
        issues: async (_, { filters = {}, pagination = {}, session_token }) => {
            const { page = 1, per_page = 20 } = pagination;
            const pageNum = Math.max(1, page);
            const limitNum = Math.min(Math.max(1, per_page), 100);
            const offset = (pageNum - 1) * limitNum;

            const conditions = [];
            const params = [];

            if (filters.status) {
                conditions.push('status = ?');
                params.push(graphQLToDbStatus(filters.status));
            }
            if (filters.priority) {
                conditions.push('priority = ?');
                params.push(graphQLToDbPriority(filters.priority));
            }

            const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
            
            return new Promise((resolve, reject) => {
                const sql = `SELECT * FROM issues ${whereClause} LIMIT ${limitNum} OFFSET ${offset}`;
                db.all(sql, params, (err, rows) => {
                    if (err) {
                        reject(new Error(err.message));
                        return;
                    }
                    
                    // Get total count
                    const countSql = `SELECT COUNT(*) as total FROM issues ${whereClause}`;
                    db.get(countSql, params, (countErr, countRow) => {
                        if (countErr) {
                            reject(new Error(countErr.message));
                            return;
                        }
                        
                        resolve({
                            data: rows.map(row => ({
                                ...row,
                                status: dbToGraphQLStatus(row.status),
                                priority: dbToGraphQLPriority(row.priority)
                            })),
                            pagination: {
                                total: countRow.total,
                                page: pageNum,
                                per_page: limitNum
                            }
                        });
                    });
                });
            });
        },

        issue: async (_, { id, session_token }) => {
            return new Promise((resolve, reject) => {
                db.get('SELECT * FROM issues WHERE id = ?', [id], (err, row) => {
                    if (err) {
                        reject(new Error(err.message));
                        return;
                    }
                    if (!row) {
                        reject(new Error('Issue not found'));
                        return;
                    }
                    resolve({
                        ...row,
                        status: dbToGraphQLStatus(row.status),
                        priority: dbToGraphQLPriority(row.priority)
                    });
                });
            });
        },

        // Labels
        labels: async (_, { session_token }) => {
            return new Promise((resolve, reject) => {
                db.all('SELECT * FROM labels', [], (err, rows) => {
                    if (err) {
                        reject(new Error(err.message));
                        return;
                    }
                    resolve(rows);
                });
            });
        },

        // Comments
        comments: async (_, { issue_id, session_token }) => {
            return new Promise((resolve, reject) => {
                db.all('SELECT * FROM comments WHERE issue_id = ? ORDER BY created_at ASC', [issue_id], (err, rows) => {
                    if (err) {
                        reject(new Error(err.message));
                        return;
                    }
                    resolve(rows);
                });
            });
        },

        // Milestones
        milestones: async (_, { session_token }) => {
            return new Promise((resolve, reject) => {
                db.all('SELECT * FROM milestones', [], (err, rows) => {
                    if (err) {
                        reject(new Error(err.message));
                        return;
                    }
                    resolve(rows.map(row => ({
                        ...row,
                        status: dbToGraphQLMilestoneStatus(row.status)
                    })));
                });
            });
        }
    },

    Mutation: {
        // Authentication
        registerUser: async (_, { input }) => {
            const { username, password } = input;
            
            if (!username || !password) {
                throw new Error('Username and password are required.');
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const now = new Date().toISOString();

            return new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO users (username, password, created_at, updated_at) VALUES (?, ?, ?, ?)',
                    [username, hashedPassword, now, now],
                    function(err) {
                        if (err) {
                            if (err.message.includes('UNIQUE constraint failed')) {
                                reject(new Error('Username already taken.'));
                            } else {
                                reject(new Error(err.message));
                            }
                            return;
                        }
                        resolve({
                            message: 'User registered successfully!',
                            user_id: this.lastID
                        });
                    }
                );
            });
        },

        loginUser: async (_, { input }) => {
            const { username, password } = input;
            
            if (!username || !password) {
                throw new Error('Username and password are required.');
            }

            return new Promise((resolve, reject) => {
                db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
                    if (err) {
                        reject(new Error(err.message));
                        return;
                    }
                    if (!user) {
                        reject(new Error('Invalid credentials.'));
                        return;
                    }

                    const isValidPassword = await bcrypt.compare(password, user.password);
                    if (!isValidPassword) {
                        reject(new Error('Invalid credentials.'));
                        return;
                    }

                    const sessionToken = generateSessionToken();
                    sessions.set(sessionToken, user);

                    resolve({
                        message: 'Login successful!',
                        user_id: user.id,
                        session_token: sessionToken
                    });
                });
            });
        },

        logoutUser: async (_, { session_token }) => {
            if (!validateSession(session_token)) {
                throw new Error('Invalid session');
            }

            sessions.delete(session_token);
            return { message: 'Logout successful!' };
        },

        // Issues
        createIssue: async (_, { input, session_token }) => {
            const user = validateSession(session_token);
            if (!user) {
                throw new Error('Invalid session');
            }

            const { title, description, status, priority, assignee, creator } = input;

            if (!title || !status || !priority || !creator) {
                throw new Error('Missing required fields for creating an issue.');
            }

            const newId = uuidv4();
            const now = new Date().toISOString();

            return new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO issues (id, title, description, status, priority, assignee, creator, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [newId, title, description || '', graphQLToDbStatus(status), graphQLToDbPriority(priority), assignee || '', creator, now, now],
                    function(err) {
                        if (err) {
                            reject(new Error(err.message));
                            return;
                        }
                        db.get('SELECT * FROM issues WHERE id = ?', [newId], (err2, row) => {
                            if (err2) {
                                reject(new Error(err2.message));
                                return;
                            }
                            resolve({
                                ...row,
                                status: dbToGraphQLStatus(row.status),
                                priority: dbToGraphQLPriority(row.priority)
                            });
                        });
                    }
                );
            });
        },

        updateIssue: async (_, { id, input, session_token }) => {
            const user = validateSession(session_token);
            if (!user) {
                throw new Error('Invalid session');
            }

            const updates = [];
            const params = [];

            if (input.title !== undefined) {
                updates.push('title = ?');
                params.push(input.title);
            }
            if (input.description !== undefined) {
                updates.push('description = ?');
                params.push(input.description);
            }
            if (input.status !== undefined) {
                updates.push('status = ?');
                params.push(graphQLToDbStatus(input.status));
            }
            if (input.priority !== undefined) {
                updates.push('priority = ?');
                params.push(graphQLToDbPriority(input.priority));
            }
            if (input.assignee !== undefined) {
                updates.push('assignee = ?');
                params.push(input.assignee);
            }

            if (updates.length === 0) {
                throw new Error('No fields to update');
            }

            updates.push('updated_at = ?');
            params.push(new Date().toISOString());
            params.push(id);

            return new Promise((resolve, reject) => {
                db.run(
                    `UPDATE issues SET ${updates.join(', ')} WHERE id = ?`,
                    params,
                    function(err) {
                        if (err) {
                            reject(new Error(err.message));
                            return;
                        }
                        if (this.changes === 0) {
                            reject(new Error('Issue not found'));
                            return;
                        }
                        db.get('SELECT * FROM issues WHERE id = ?', [id], (err2, row) => {
                            if (err2) {
                                reject(new Error(err2.message));
                                return;
                            }
                            resolve({
                                ...row,
                                status: dbToGraphQLStatus(row.status),
                                priority: dbToGraphQLPriority(row.priority)
                            });
                        });
                    }
                );
            });
        },

        deleteIssue: async (_, { id, session_token }) => {
            const user = validateSession(session_token);
            if (!user) {
                throw new Error('Invalid session');
            }

            return new Promise((resolve, reject) => {
                db.run('DELETE FROM issues WHERE id = ?', [id], function(err) {
                    if (err) {
                        reject(new Error(err.message));
                        return;
                    }
                    if (this.changes === 0) {
                        reject(new Error('Issue not found'));
                        return;
                    }
                    resolve(true);
                });
            });
        },

        // Labels
        createLabel: async (_, { input, session_token }) => {
            const user = validateSession(session_token);
            if (!user) {
                throw new Error('Invalid session');
            }

            const { name, color, description } = input;

            if (!name || !color) {
                throw new Error('name and color are required.');
            }

            // Normalize color format
            let normalizedColor = color;
            if (!normalizedColor.startsWith('#')) {
                normalizedColor = '#' + normalizedColor;
            }
            if (normalizedColor.length === 4) {
                normalizedColor = '#' + normalizedColor[1] + normalizedColor[1] +
                                 normalizedColor[2] + normalizedColor[2] +
                                 normalizedColor[3] + normalizedColor[3];
            }

            const newId = uuidv4();

            return new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO labels (id, name, color, description) VALUES (?, ?, ?, ?)',
                    [newId, name, normalizedColor, description || ''],
                    function(err) {
                        if (err) {
                            reject(new Error(err.message));
                            return;
                        }
                        db.get('SELECT * FROM labels WHERE id = ?', [newId], (err2, row) => {
                            if (err2) {
                                reject(new Error(err2.message));
                                return;
                            }
                            resolve(row);
                        });
                    }
                );
            });
        },

        // Comments
        createComment: async (_, { issue_id, input, session_token }) => {
            const user = validateSession(session_token);
            if (!user) {
                throw new Error('Invalid session');
            }

            const { content, author } = input;

            if (!content || !author) {
                throw new Error('content and author are required.');
            }

            const newId = uuidv4();
            const now = new Date().toISOString();

            return new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO comments (id, issue_id, content, author, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [newId, issue_id, content, author, now, now],
                    function(err) {
                        if (err) {
                            reject(new Error(err.message));
                            return;
                        }
                        db.get('SELECT * FROM comments WHERE id = ?', [newId], (err2, row) => {
                            if (err2) {
                                reject(new Error(err2.message));
                                return;
                            }
                            resolve(row);
                        });
                    }
                );
            });
        },

        // Milestones
        createMilestone: async (_, { input, session_token }) => {
            const user = validateSession(session_token);
            if (!user) {
                throw new Error('Invalid session');
            }

            const { title, description, due_date, status } = input;

            if (!title || !status) {
                throw new Error('title and status are required.');
            }

            const newId = uuidv4();
            const now = new Date().toISOString();

            return new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO milestones (id, title, description, due_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [newId, title, description || '', due_date || null, graphQLToDbMilestoneStatus(status), now, now],
                    function(err) {
                        if (err) {
                            reject(new Error(err.message));
                            return;
                        }
                        db.get('SELECT * FROM milestones WHERE id = ?', [newId], (err2, row) => {
                            if (err2) {
                                reject(new Error(err2.message));
                                return;
                            }
                            resolve({
                                ...row,
                                status: dbToGraphQLMilestoneStatus(row.status)
                            });
                        });
                    }
                );
            });
        }
    }
};

// Create Apollo Server
async function startServer() {
    const app = express();

    // Enable CORS
    app.use(cors());

    const server = new ApolloServer({
        typeDefs,
        resolvers,
        context: ({ req }) => ({
            // Add any context needed
        }),
        introspection: true,
        playground: true
    });

    await server.start();
    server.applyMiddleware({ app, path: '/graphql' });

    const port = process.env.GRAPHQL_PORT || 4000;

    app.listen(port, () => {
        console.log(`🚀 GraphQL Server ready at http://localhost:${port}${server.graphqlPath}`);
        console.log(`📊 GraphQL Playground available at http://localhost:${port}${server.graphqlPath}`);
    });
}

// Start the server if this file is run directly
if (require.main === module) {
    startServer().catch(error => {
        console.error('Error starting server:', error);
        process.exit(1);
    });
}

module.exports = { typeDefs, resolvers, db, sessions, validateSession, generateSessionToken, startServer };
