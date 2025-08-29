// SOAP Server for Mantis Clone API
require('dotenv').config();

const express = require('express');
const soap = require('soap');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.SOAP_PORT || 3001;

// Database connection (reuse the same database as REST API)
const db = new sqlite3.Database('database.sqlite', (err) => {
    if (err) {
        console.error('Error connecting to SQLite database:', err.message);
    } else {
        console.log('Connected to SQLite database for SOAP service.');
    }
});

// Session storage for SOAP (simple in-memory storage for demo)
const sessions = new Map();

// Helper function to validate session
function validateSession(sessionId) {
    return sessions.has(sessionId) && sessions.get(sessionId).expires > Date.now();
}

// Helper function to create SOAP fault
function createSoapFault(code, message, details = '') {
    const fault = new Error(message);
    fault.Fault = {
        Code: {
            Value: "soap:Server",
            Subcode: { Value: code }
        },
        Reason: { Text: message },
        Detail: { ErrorInfo: details }
    };
    return fault;
}

// SOAP Service Implementation
const soapService = {
    MantisCloneService: {
        MantisCloneSoapPort: {
            // User Operations
            RegisterUser: function(args, callback) {
                const { username, password } = args;
                
                if (!username || !password) {
                    return callback(createSoapFault('INVALID_INPUT', 'Username and password are required.'));
                }

                const now = new Date().toISOString();
                bcrypt.hash(password, 10)
                    .then((hashedPassword) => {
                        db.run(
                            `INSERT INTO users (username, password, created_at, updated_at) VALUES (?, ?, ?, ?)`,
                            [username, hashedPassword, now, now],
                            function(err) {
                                if (err) {
                                    if (err.message.includes('UNIQUE constraint failed')) {
                                        return callback(createSoapFault('USER_EXISTS', 'Username already taken.'));
                                    }
                                    return callback(createSoapFault('DB_ERROR', err.message));
                                }
                                callback(null, {
                                    message: 'User registered successfully!',
                                    user_id: this.lastID
                                });
                            }
                        );
                    })
                    .catch((error) => {
                        callback(createSoapFault('HASH_ERROR', error.message));
                    });
            },

            LoginUser: function(args, callback) {
                const { username, password } = args;
                
                if (!username || !password) {
                    return callback(createSoapFault('INVALID_INPUT', 'Username and password are required.'));
                }

                db.get(
                    `SELECT * FROM users WHERE username = ?`,
                    [username],
                    async (err, user) => {
                        if (err) {
                            return callback(createSoapFault('DB_ERROR', err.message));
                        }
                        if (!user) {
                            return callback(createSoapFault('INVALID_CREDENTIALS', 'Invalid username or password.'));
                        }

                        try {
                            const match = await bcrypt.compare(password, user.password);
                            if (!match) {
                                return callback(createSoapFault('INVALID_CREDENTIALS', 'Invalid username or password.'));
                            }

                            // Create session
                            const sessionId = uuidv4();
                            const expires = Date.now() + (60 * 60 * 1000); // 1 hour
                            sessions.set(sessionId, {
                                user: { id: user.id, username: user.username },
                                expires: expires
                            });

                            callback(null, {
                                message: 'Session created successfully!',
                                user: { id: user.id, username: user.username },
                                session_id: sessionId
                            });
                        } catch (error) {
                            callback(createSoapFault('HASH_ERROR', error.message));
                        }
                    }
                );
            },

            Logout: function(args, callback) {
                const { session_id } = args;
                
                if (!session_id || !validateSession(session_id)) {
                    return callback(createSoapFault('UNAUTHORIZED', 'Invalid or expired session.'));
                }

                sessions.delete(session_id);
                callback(null, { message: 'Logged out successfully!' });
            },

            GetProfile: function(args, callback) {
                const { session_id } = args;
                
                if (!session_id || !validateSession(session_id)) {
                    return callback(createSoapFault('UNAUTHORIZED', 'Invalid or expired session.'));
                }

                const session = sessions.get(session_id);
                callback(null, {
                    message: 'Current user profile retrieved successfully.',
                    user: session.user
                });
            },

            // Issue Operations
            GetIssues: function(args, callback) {
                const { status, priority, page = 1, per_page = 20 } = args || {};
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

                const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
                const sql = `SELECT * FROM issues ${whereClause} LIMIT ${limitNum} OFFSET ${offset}`;

                db.all(sql, params, (err, rows) => {
                    if (err) {
                        return callback(createSoapFault('DB_ERROR', err.message));
                    }

                    // Convert rows to proper format
                    const issues = rows.map(row => ({
                        id: row.id,
                        title: row.title,
                        description: row.description || '',
                        status: row.status,
                        priority: row.priority,
                        assignee: row.assignee || '',
                        creator: row.creator,
                        created_at: row.created_at,
                        updated_at: row.updated_at || ''
                    }));

                    callback(null, {
                        data: { issue: issues },
                        pagination: {
                            total: rows.length,
                            page: pageNum,
                            per_page: limitNum
                        }
                    });
                });
            },

            CreateIssue: function(args, callback) {
                const { title, description, status, priority, assignee, creator } = args;
                
                if (!title || !status || !priority || !creator) {
                    return callback(createSoapFault('INVALID_INPUT', 'Missing required fields for creating an issue.'));
                }

                const now = new Date().toISOString();
                const newId = uuidv4();

                db.run(
                    `INSERT INTO issues (id, title, description, status, priority, assignee, creator, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [newId, title, description || '', status, priority, assignee || '', creator, now, now],
                    function(err) {
                        if (err) {
                            return callback(createSoapFault('DB_ERROR', err.message));
                        }

                        db.get(`SELECT * FROM issues WHERE id = ?`, [newId], (err2, row) => {
                            if (err2) {
                                return callback(createSoapFault('DB_ERROR', err2.message));
                            }

                            callback(null, {
                                id: row.id,
                                title: row.title,
                                description: row.description || '',
                                status: row.status,
                                priority: row.priority,
                                assignee: row.assignee || '',
                                creator: row.creator,
                                created_at: row.created_at,
                                updated_at: row.updated_at || ''
                            });
                        });
                    }
                );
            },

            GetIssue: function(args, callback) {
                const { issueId } = args;

                db.get(`SELECT * FROM issues WHERE id = ?`, [issueId], (err, row) => {
                    if (err) {
                        return callback(createSoapFault('DB_ERROR', err.message));
                    }
                    if (!row) {
                        return callback(createSoapFault('NOT_FOUND', 'Issue not found'));
                    }

                    callback(null, {
                        id: row.id,
                        title: row.title,
                        description: row.description || '',
                        status: row.status,
                        priority: row.priority,
                        assignee: row.assignee || '',
                        creator: row.creator,
                        created_at: row.created_at,
                        updated_at: row.updated_at || ''
                    });
                });
            },

            UpdateIssue: function(args, callback) {
                const { issueId, issue } = args;
                const now = new Date().toISOString();
                const fields = [];
                const params = [];

                if (issue.title !== undefined) {
                    fields.push('title = ?');
                    params.push(issue.title);
                }
                if (issue.description !== undefined) {
                    fields.push('description = ?');
                    params.push(issue.description);
                }
                if (issue.status !== undefined) {
                    fields.push('status = ?');
                    params.push(issue.status);
                }
                if (issue.priority !== undefined) {
                    fields.push('priority = ?');
                    params.push(issue.priority);
                }
                if (issue.assignee !== undefined) {
                    fields.push('assignee = ?');
                    params.push(issue.assignee);
                }

                fields.push('updated_at = ?');
                params.push(now);

                if (fields.length <= 1) {
                    return callback(createSoapFault('NO_UPDATE_FIELDS', 'No fields provided for update.'));
                }

                const sql = `UPDATE issues SET ${fields.join(', ')} WHERE id = ?`;
                params.push(issueId);

                db.run(sql, params, function(err) {
                    if (err) {
                        return callback(createSoapFault('DB_ERROR', err.message));
                    }
                    if (this.changes === 0) {
                        return callback(createSoapFault('NOT_FOUND', 'Issue not found'));
                    }

                    db.get(`SELECT * FROM issues WHERE id = ?`, [issueId], (err2, row) => {
                        if (err2) {
                            return callback(createSoapFault('DB_ERROR', err2.message));
                        }

                        callback(null, {
                            id: row.id,
                            title: row.title,
                            description: row.description || '',
                            status: row.status,
                            priority: row.priority,
                            assignee: row.assignee || '',
                            creator: row.creator,
                            created_at: row.created_at,
                            updated_at: row.updated_at || ''
                        });
                    });
                });
            },

            DeleteIssue: function(args, callback) {
                const { issueId } = args;

                db.run(`DELETE FROM issues WHERE id = ?`, [issueId], function(err) {
                    if (err) {
                        return callback(createSoapFault('DB_ERROR', err.message));
                    }
                    if (this.changes === 0) {
                        return callback(createSoapFault('NOT_FOUND', 'Issue not found'));
                    }

                    callback(null, { message: 'Issue deleted successfully!' });
                });
            },

            // Comment Operations
            GetComments: function(args, callback) {
                const { issueId } = args;

                db.all(`SELECT * FROM comments WHERE issue_id = ?`, [issueId], (err, rows) => {
                    if (err) {
                        return callback(createSoapFault('DB_ERROR', err.message));
                    }

                    const comments = rows.map(row => ({
                        id: row.id,
                        issue_id: row.issue_id,
                        content: row.content,
                        author: row.author,
                        created_at: row.created_at,
                        updated_at: row.updated_at || ''
                    }));

                    callback(null, { comment: comments });
                });
            },

            CreateComment: function(args, callback) {
                const { issueId, comment } = args;
                const { content, author } = comment;

                if (!content || !author) {
                    return callback(createSoapFault('INVALID_INPUT', 'content and author are required.'));
                }

                // First check if the issue exists
                db.get(`SELECT id FROM issues WHERE id = ?`, [issueId], (err, issue) => {
                    if (err) {
                        return callback(createSoapFault('DB_ERROR', err.message));
                    }
                    if (!issue) {
                        return callback(createSoapFault('NOT_FOUND', 'Cannot add comment: Issue not found'));
                    }

                    const now = new Date().toISOString();
                    const newId = uuidv4();

                    db.run(
                        `INSERT INTO comments (id, issue_id, content, author, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [newId, issueId, content, author, now, now],
                        function(err) {
                            if (err) {
                                return callback(createSoapFault('DB_ERROR', err.message));
                            }

                            db.get(`SELECT * FROM comments WHERE id = ?`, [newId], (err2, row) => {
                                if (err2) {
                                    return callback(createSoapFault('DB_ERROR', err2.message));
                                }

                                callback(null, {
                                    id: row.id,
                                    issue_id: row.issue_id,
                                    content: row.content,
                                    author: row.author,
                                    created_at: row.created_at,
                                    updated_at: row.updated_at || ''
                                });
                            });
                        }
                    );
                });
            },

            // Label Operations
            GetLabels: function(args, callback) {
                db.all(`SELECT * FROM labels`, [], (err, rows) => {
                    if (err) {
                        return callback(createSoapFault('DB_ERROR', err.message));
                    }

                    const labels = rows.map(row => ({
                        id: row.id,
                        name: row.name,
                        color: row.color,
                        description: row.description || ''
                    }));

                    callback(null, { label: labels });
                });
            },

            CreateLabel: function(args, callback) {
                const { name, color, description } = args;

                if (!name || !color) {
                    return callback(createSoapFault('INVALID_INPUT', 'name and color are required.'));
                }

                // Normalize color format
                let normalizedColor = color;
                if (!normalizedColor.startsWith('#')) {
                    normalizedColor = '#' + normalizedColor;
                }

                // If it's 3 chars (#RGB), expand to 6 chars (#RRGGBB)
                if (normalizedColor.length === 4) {
                    normalizedColor = '#' + normalizedColor[1] + normalizedColor[1] +
                                     normalizedColor[2] + normalizedColor[2] +
                                     normalizedColor[3] + normalizedColor[3];
                }

                // Validate color format - simplified for demo
                if (!normalizedColor.startsWith('#') || normalizedColor.length !== 7) {
                    return callback(createSoapFault('INVALID_COLOR',
                        `Color must be in format #RRGGBB (e.g., #FF0000). Received: "${color}"`));
                }

                const newId = uuidv4();
                db.run(
                    `INSERT INTO labels (id, name, color, description) VALUES (?, ?, ?, ?)`,
                    [newId, name, normalizedColor, description || ''],
                    function(err) {
                        if (err) {
                            return callback(createSoapFault('DB_ERROR', err.message));
                        }

                        db.get(`SELECT * FROM labels WHERE id = ?`, [newId], (err2, row) => {
                            if (err2) {
                                return callback(createSoapFault('DB_ERROR', err2.message));
                            }

                            callback(null, {
                                id: row.id,
                                name: row.name,
                                color: row.color,
                                description: row.description || ''
                            });
                        });
                    }
                );
            },

            // Milestone Operations
            GetMilestones: function(args, callback) {
                const { status } = args || {};
                let sql = `SELECT * FROM milestones`;
                const params = [];

                if (status) {
                    sql += ` WHERE status = ?`;
                    params.push(status);
                }

                db.all(sql, params, (err, rows) => {
                    if (err) {
                        return callback(createSoapFault('DB_ERROR', err.message));
                    }

                    const milestones = rows.map(row => ({
                        id: row.id,
                        title: row.title,
                        description: row.description || '',
                        due_date: row.due_date || '',
                        status: row.status
                    }));

                    callback(null, { milestone: milestones });
                });
            },

            CreateMilestone: function(args, callback) {
                const { title, description, due_date, status } = args;

                if (!title || !status) {
                    return callback(createSoapFault('INVALID_INPUT', 'title and status are required.'));
                }

                const newId = uuidv4();
                db.run(
                    `INSERT INTO milestones (id, title, description, due_date, status) VALUES (?, ?, ?, ?, ?)`,
                    [newId, title, description || '', due_date || null, status],
                    function(err) {
                        if (err) {
                            return callback(createSoapFault('DB_ERROR', err.message));
                        }

                        db.get(`SELECT * FROM milestones WHERE id = ?`, [newId], (err2, row) => {
                            if (err2) {
                                return callback(createSoapFault('DB_ERROR', err2.message));
                            }

                            callback(null, {
                                id: row.id,
                                title: row.title,
                                description: row.description || '',
                                due_date: row.due_date || '',
                                status: row.status
                            });
                        });
                    }
                );
            }
        }
    }
};

// Read WSDL file
const wsdlPath = path.join(__dirname, '../wsdl/mantis-clone.wsdl');
const wsdlXML = fs.readFileSync(wsdlPath, 'utf8');

// Start SOAP server
app.listen(port, function() {
    console.log(`SOAP server listening on port ${port}`);
    
    // Create SOAP service
    soap.listen(app, '/soap', soapService, wsdlXML, function() {
        console.log('SOAP service started at http://localhost:' + port + '/soap');
        console.log('WSDL available at http://localhost:' + port + '/soap?wsdl');
    });
});

module.exports = app;
