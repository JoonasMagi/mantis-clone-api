require('dotenv').config();

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

// Load proto file
const PROTO_PATH = path.join(__dirname, '../proto/mantis.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});

const mantisProto = grpc.loadPackageDefinition(packageDefinition).mantis;

// Database setup (reuse existing database)
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error connecting to SQLite database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
    }
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

function createGrpcError(code, message, details = {}) {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    return error;
}

function mapIssueStatusToEnum(status) {
    const statusMap = {
        'open': 1,
        'in_progress': 2,
        'resolved': 3,
        'closed': 4
    };
    return statusMap[status] || 0;
}

function mapIssueStatusFromEnum(enumValue) {
    const statusMap = {
        1: 'open',
        2: 'in_progress',
        3: 'resolved',
        4: 'closed'
    };
    return statusMap[enumValue] || 'open';
}

function mapIssuePriorityToEnum(priority) {
    const priorityMap = {
        'low': 1,
        'medium': 2,
        'high': 3,
        'critical': 4
    };
    return priorityMap[priority] || 0;
}

function mapIssuePriorityFromEnum(enumValue) {
    const priorityMap = {
        1: 'low',
        2: 'medium',
        3: 'high',
        4: 'critical'
    };
    return priorityMap[enumValue] || 'low';
}

function mapMilestoneStatusToEnum(status) {
    const statusMap = {
        'open': 1,
        'closed': 2
    };
    return statusMap[status] || 0;
}

function mapMilestoneStatusFromEnum(enumValue) {
    const statusMap = {
        1: 'open',
        2: 'closed'
    };
    return statusMap[enumValue] || 'open';
}

// =============================================================================
// Auth Service Implementation
// =============================================================================

const authService = {
    Register: (call, callback) => {
        const { username, password } = call.request;
        
        if (!username || !password) {
            return callback(createGrpcError(
                grpc.status.INVALID_ARGUMENT,
                'Username and password are required.'
            ));
        }

        // Check if user exists
        db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
            if (err) {
                return callback(createGrpcError(
                    grpc.status.INTERNAL,
                    err.message
                ));
            }
            
            if (row) {
                return callback(createGrpcError(
                    grpc.status.ALREADY_EXISTS,
                    'Username already taken'
                ));
            }

            // Hash password and create user
            bcrypt.hash(password, 10, (hashErr, hashedPassword) => {
                if (hashErr) {
                    return callback(createGrpcError(
                        grpc.status.INTERNAL,
                        hashErr.message
                    ));
                }

                db.run(
                    'INSERT INTO users (username, password) VALUES (?, ?)',
                    [username, hashedPassword],
                    function(insertErr) {
                        if (insertErr) {
                            return callback(createGrpcError(
                                grpc.status.INTERNAL,
                                insertErr.message
                            ));
                        }

                        callback(null, {
                            message: 'User registered successfully',
                            user_id: this.lastID
                        });
                    }
                );
            });
        });
    },

    Login: (call, callback) => {
        const { username, password } = call.request;
        
        if (!username || !password) {
            return callback(createGrpcError(
                grpc.status.INVALID_ARGUMENT,
                'Username and password are required.'
            ));
        }

        db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
            if (err) {
                return callback(createGrpcError(
                    grpc.status.INTERNAL,
                    err.message
                ));
            }
            
            if (!user) {
                return callback(createGrpcError(
                    grpc.status.UNAUTHENTICATED,
                    'Invalid username or password'
                ));
            }

            bcrypt.compare(password, user.password, (compareErr, isMatch) => {
                if (compareErr) {
                    return callback(createGrpcError(
                        grpc.status.INTERNAL,
                        compareErr.message
                    ));
                }
                
                if (!isMatch) {
                    return callback(createGrpcError(
                        grpc.status.UNAUTHENTICATED,
                        'Invalid username or password'
                    ));
                }

                // Create session
                const sessionToken = generateSessionToken();
                sessions.set(sessionToken, {
                    id: user.id,
                    username: user.username
                });

                callback(null, {
                    message: 'Login successful',
                    user: {
                        id: user.id,
                        username: user.username
                    },
                    session_token: sessionToken
                });
            });
        });
    },

    Logout: (call, callback) => {
        const { session_token } = call.request;
        
        if (!session_token || !sessions.has(session_token)) {
            return callback(createGrpcError(
                grpc.status.UNAUTHENTICATED,
                'Invalid session'
            ));
        }

        sessions.delete(session_token);
        callback(null, {
            message: 'Successfully logged out'
        });
    },

    GetProfile: (call, callback) => {
        const { session_token } = call.request;
        const user = validateSession(session_token);
        
        if (!user) {
            return callback(createGrpcError(
                grpc.status.UNAUTHENTICATED,
                'Invalid session'
            ));
        }

        callback(null, {
            message: 'Profile retrieved successfully',
            user: {
                id: user.id,
                username: user.username
            }
        });
    }
};

// =============================================================================
// Label Service Implementation
// =============================================================================

const labelService = {
    GetLabels: (call, callback) => {
        db.all('SELECT * FROM labels', [], (err, rows) => {
            if (err) {
                return callback(createGrpcError(
                    grpc.status.INTERNAL,
                    err.message
                ));
            }

            const labels = rows.map(row => ({
                id: row.id,
                name: row.name,
                color: row.color,
                description: row.description || ''
            }));

            callback(null, { labels });
        });
    },

    CreateLabel: (call, callback) => {
        const { session_token, name, color, description } = call.request;
        const user = validateSession(session_token);
        
        if (!user) {
            return callback(createGrpcError(
                grpc.status.UNAUTHENTICATED,
                'Invalid session'
            ));
        }

        if (!name || !color) {
            return callback(createGrpcError(
                grpc.status.INVALID_ARGUMENT,
                'Name and color are required'
            ));
        }

        const newId = uuidv4();
        db.run(
            'INSERT INTO labels (id, name, color, description) VALUES (?, ?, ?, ?)',
            [newId, name, color, description || ''],
            function(err) {
                if (err) {
                    return callback(createGrpcError(
                        grpc.status.INTERNAL,
                        err.message
                    ));
                }

                callback(null, {
                    id: newId,
                    name,
                    color,
                    description: description || ''
                });
            }
        );
    },

    UpdateLabel: (call, callback) => {
        const { session_token, label_id, name, color, description } = call.request;
        const user = validateSession(session_token);
        
        if (!user) {
            return callback(createGrpcError(
                grpc.status.UNAUTHENTICATED,
                'Invalid session'
            ));
        }

        const updates = [];
        const params = [];
        
        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name);
        }
        if (color !== undefined) {
            updates.push('color = ?');
            params.push(color);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }

        if (updates.length === 0) {
            return callback(createGrpcError(
                grpc.status.INVALID_ARGUMENT,
                'No fields to update'
            ));
        }

        params.push(label_id);
        
        db.run(
            `UPDATE labels SET ${updates.join(', ')} WHERE id = ?`,
            params,
            function(err) {
                if (err) {
                    return callback(createGrpcError(
                        grpc.status.INTERNAL,
                        err.message
                    ));
                }

                if (this.changes === 0) {
                    return callback(createGrpcError(
                        grpc.status.NOT_FOUND,
                        'Label not found'
                    ));
                }

                // Return updated label
                db.get('SELECT * FROM labels WHERE id = ?', [label_id], (getErr, row) => {
                    if (getErr) {
                        return callback(createGrpcError(
                            grpc.status.INTERNAL,
                            getErr.message
                        ));
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

    DeleteLabel: (call, callback) => {
        const { session_token, label_id } = call.request;
        const user = validateSession(session_token);
        
        if (!user) {
            return callback(createGrpcError(
                grpc.status.UNAUTHENTICATED,
                'Invalid session'
            ));
        }

        db.run('DELETE FROM labels WHERE id = ?', [label_id], function(err) {
            if (err) {
                return callback(createGrpcError(
                    grpc.status.INTERNAL,
                    err.message
                ));
            }

            if (this.changes === 0) {
                return callback(createGrpcError(
                    grpc.status.NOT_FOUND,
                    'Label not found'
                ));
            }

            callback(null, {});
        });
    }
};

// =============================================================================
// Issue Service Implementation
// =============================================================================

const issueService = {
    GetIssues: (call, callback) => {
        const { status, priority, label, milestone, pagination } = call.request;
        const page = pagination?.page || 1;
        const perPage = Math.min(pagination?.per_page || 20, 100);
        const offset = (page - 1) * perPage;

        let query = 'SELECT * FROM issues';
        const conditions = [];
        const params = [];

        if (status && status !== 0) {
            conditions.push('status = ?');
            params.push(mapIssueStatusFromEnum(status));
        }
        if (priority && priority !== 0) {
            conditions.push('priority = ?');
            params.push(mapIssuePriorityFromEnum(priority));
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ` LIMIT ? OFFSET ?`;
        params.push(perPage, offset);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM issues';
        const countParams = [];

        if (conditions.length > 0) {
            countQuery += ' WHERE ' + conditions.join(' AND ');
            // Add the same filter params (excluding LIMIT/OFFSET)
            for (let i = 0; i < params.length - 2; i++) {
                countParams.push(params[i]);
            }
        }

        db.get(countQuery, countParams, (countErr, countRow) => {
            if (countErr) {
                return callback(createGrpcError(
                    grpc.status.INTERNAL,
                    countErr.message
                ));
            }

            db.all(query, params, (err, rows) => {
                if (err) {
                    return callback(createGrpcError(
                        grpc.status.INTERNAL,
                        err.message
                    ));
                }

                const issues = rows.map(row => ({
                    id: row.id,
                    title: row.title,
                    description: row.description || '',
                    status: mapIssueStatusToEnum(row.status),
                    priority: mapIssuePriorityToEnum(row.priority),
                    assignee: row.assignee || '',
                    creator: row.creator || '',
                    labels: [], // Simplified - would need join for full implementation
                    milestone: null, // Simplified - would need join for full implementation
                    created_at: {
                        seconds: Math.floor(new Date(row.created_at).getTime() / 1000),
                        nanos: 0
                    },
                    updated_at: {
                        seconds: Math.floor(new Date(row.updated_at).getTime() / 1000),
                        nanos: 0
                    }
                }));

                callback(null, {
                    data: issues,
                    pagination: {
                        total: countRow.total,
                        page: page,
                        per_page: perPage
                    }
                });
            });
        });
    },

    CreateIssue: (call, callback) => {
        const { session_token, title, description, status, priority, assignee, creator } = call.request;
        const user = validateSession(session_token);

        if (!user) {
            return callback(createGrpcError(
                grpc.status.UNAUTHENTICATED,
                'Invalid session'
            ));
        }

        if (!title || !status || !priority || !creator) {
            return callback(createGrpcError(
                grpc.status.INVALID_ARGUMENT,
                'Title, status, priority, and creator are required'
            ));
        }

        const newId = uuidv4();
        const now = new Date().toISOString();
        const statusStr = mapIssueStatusFromEnum(status);
        const priorityStr = mapIssuePriorityFromEnum(priority);

        db.run(
            'INSERT INTO issues (id, title, description, status, priority, assignee, creator, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [newId, title, description || '', statusStr, priorityStr, assignee || '', creator, now, now],
            function(err) {
                if (err) {
                    return callback(createGrpcError(
                        grpc.status.INTERNAL,
                        err.message
                    ));
                }

                callback(null, {
                    id: newId,
                    title,
                    description: description || '',
                    status,
                    priority,
                    assignee: assignee || '',
                    creator,
                    labels: [],
                    milestone: null,
                    created_at: {
                        seconds: Math.floor(new Date(now).getTime() / 1000),
                        nanos: 0
                    },
                    updated_at: {
                        seconds: Math.floor(new Date(now).getTime() / 1000),
                        nanos: 0
                    }
                });
            }
        );
    },

    GetIssue: (call, callback) => {
        const { issue_id } = call.request;

        db.get('SELECT * FROM issues WHERE id = ?', [issue_id], (err, row) => {
            if (err) {
                return callback(createGrpcError(
                    grpc.status.INTERNAL,
                    err.message
                ));
            }

            if (!row) {
                return callback(createGrpcError(
                    grpc.status.NOT_FOUND,
                    'Issue not found'
                ));
            }

            callback(null, {
                id: row.id,
                title: row.title,
                description: row.description || '',
                status: mapIssueStatusToEnum(row.status),
                priority: mapIssuePriorityToEnum(row.priority),
                assignee: row.assignee || '',
                creator: row.creator || '',
                labels: [],
                milestone: null,
                created_at: {
                    seconds: Math.floor(new Date(row.created_at).getTime() / 1000),
                    nanos: 0
                },
                updated_at: {
                    seconds: Math.floor(new Date(row.updated_at).getTime() / 1000),
                    nanos: 0
                }
            });
        });
    },

    UpdateIssue: (call, callback) => {
        const { session_token, issue_id, title, description, status, priority, assignee } = call.request;
        const user = validateSession(session_token);

        if (!user) {
            return callback(createGrpcError(
                grpc.status.UNAUTHENTICATED,
                'Invalid session'
            ));
        }

        const updates = [];
        const params = [];

        if (title !== undefined) {
            updates.push('title = ?');
            params.push(title);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (status !== undefined && status !== 0) {
            updates.push('status = ?');
            params.push(mapIssueStatusFromEnum(status));
        }
        if (priority !== undefined && priority !== 0) {
            updates.push('priority = ?');
            params.push(mapIssuePriorityFromEnum(priority));
        }
        if (assignee !== undefined) {
            updates.push('assignee = ?');
            params.push(assignee);
        }

        if (updates.length === 0) {
            return callback(createGrpcError(
                grpc.status.INVALID_ARGUMENT,
                'No fields to update'
            ));
        }

        updates.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(issue_id);

        db.run(
            `UPDATE issues SET ${updates.join(', ')} WHERE id = ?`,
            params,
            function(err) {
                if (err) {
                    return callback(createGrpcError(
                        grpc.status.INTERNAL,
                        err.message
                    ));
                }

                if (this.changes === 0) {
                    return callback(createGrpcError(
                        grpc.status.NOT_FOUND,
                        'Issue not found'
                    ));
                }

                // Return updated issue
                db.get('SELECT * FROM issues WHERE id = ?', [issue_id], (getErr, row) => {
                    if (getErr) {
                        return callback(createGrpcError(
                            grpc.status.INTERNAL,
                            getErr.message
                        ));
                    }

                    callback(null, {
                        id: row.id,
                        title: row.title,
                        description: row.description || '',
                        status: mapIssueStatusToEnum(row.status),
                        priority: mapIssuePriorityToEnum(row.priority),
                        assignee: row.assignee || '',
                        creator: row.creator || '',
                        labels: [],
                        milestone: null,
                        created_at: {
                            seconds: Math.floor(new Date(row.created_at).getTime() / 1000),
                            nanos: 0
                        },
                        updated_at: {
                            seconds: Math.floor(new Date(row.updated_at).getTime() / 1000),
                            nanos: 0
                        }
                    });
                });
            }
        );
    },

    DeleteIssue: (call, callback) => {
        const { session_token, issue_id } = call.request;
        const user = validateSession(session_token);

        if (!user) {
            return callback(createGrpcError(
                grpc.status.UNAUTHENTICATED,
                'Invalid session'
            ));
        }

        db.run('DELETE FROM issues WHERE id = ?', [issue_id], function(err) {
            if (err) {
                return callback(createGrpcError(
                    grpc.status.INTERNAL,
                    err.message
                ));
            }

            if (this.changes === 0) {
                return callback(createGrpcError(
                    grpc.status.NOT_FOUND,
                    'Issue not found'
                ));
            }

            callback(null, {});
        });
    }
};

// =============================================================================
// Comment Service Implementation
// =============================================================================

const commentService = {
    GetComments: (call, callback) => {
        const { issue_id } = call.request;

        db.all('SELECT * FROM comments WHERE issue_id = ? ORDER BY created_at ASC', [issue_id], (err, rows) => {
            if (err) {
                return callback(createGrpcError(
                    grpc.status.INTERNAL,
                    err.message
                ));
            }

            const comments = rows.map(row => ({
                id: row.id,
                issue_id: row.issue_id,
                content: row.content,
                author: row.author,
                created_at: {
                    seconds: Math.floor(new Date(row.created_at).getTime() / 1000),
                    nanos: 0
                },
                updated_at: {
                    seconds: Math.floor(new Date(row.updated_at).getTime() / 1000),
                    nanos: 0
                }
            }));

            callback(null, { comments });
        });
    },

    CreateComment: (call, callback) => {
        const { session_token, issue_id, content, author } = call.request;
        const user = validateSession(session_token);

        if (!user) {
            return callback(createGrpcError(
                grpc.status.UNAUTHENTICATED,
                'Invalid session'
            ));
        }

        if (!issue_id || !content || !author) {
            return callback(createGrpcError(
                grpc.status.INVALID_ARGUMENT,
                'Issue ID, content, and author are required'
            ));
        }

        // Check if issue exists
        db.get('SELECT id FROM issues WHERE id = ?', [issue_id], (checkErr, issueRow) => {
            if (checkErr) {
                return callback(createGrpcError(
                    grpc.status.INTERNAL,
                    checkErr.message
                ));
            }

            if (!issueRow) {
                return callback(createGrpcError(
                    grpc.status.NOT_FOUND,
                    'Issue not found'
                ));
            }

            const newId = uuidv4();
            const now = new Date().toISOString();

            db.run(
                'INSERT INTO comments (id, issue_id, content, author, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                [newId, issue_id, content, author, now, now],
                function(err) {
                    if (err) {
                        return callback(createGrpcError(
                            grpc.status.INTERNAL,
                            err.message
                        ));
                    }

                    callback(null, {
                        id: newId,
                        issue_id,
                        content,
                        author,
                        created_at: {
                            seconds: Math.floor(new Date(now).getTime() / 1000),
                            nanos: 0
                        },
                        updated_at: {
                            seconds: Math.floor(new Date(now).getTime() / 1000),
                            nanos: 0
                        }
                    });
                }
            );
        });
    },

    UpdateComment: (call, callback) => {
        const { session_token, comment_id, content, author } = call.request;
        const user = validateSession(session_token);

        if (!user) {
            return callback(createGrpcError(
                grpc.status.UNAUTHENTICATED,
                'Invalid session'
            ));
        }

        const updates = [];
        const params = [];

        if (content !== undefined) {
            updates.push('content = ?');
            params.push(content);
        }
        if (author !== undefined) {
            updates.push('author = ?');
            params.push(author);
        }

        if (updates.length === 0) {
            return callback(createGrpcError(
                grpc.status.INVALID_ARGUMENT,
                'No fields to update'
            ));
        }

        updates.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(comment_id);

        db.run(
            `UPDATE comments SET ${updates.join(', ')} WHERE id = ?`,
            params,
            function(err) {
                if (err) {
                    return callback(createGrpcError(
                        grpc.status.INTERNAL,
                        err.message
                    ));
                }

                if (this.changes === 0) {
                    return callback(createGrpcError(
                        grpc.status.NOT_FOUND,
                        'Comment not found'
                    ));
                }

                // Return updated comment
                db.get('SELECT * FROM comments WHERE id = ?', [comment_id], (getErr, row) => {
                    if (getErr) {
                        return callback(createGrpcError(
                            grpc.status.INTERNAL,
                            getErr.message
                        ));
                    }

                    callback(null, {
                        id: row.id,
                        issue_id: row.issue_id,
                        content: row.content,
                        author: row.author,
                        created_at: {
                            seconds: Math.floor(new Date(row.created_at).getTime() / 1000),
                            nanos: 0
                        },
                        updated_at: {
                            seconds: Math.floor(new Date(row.updated_at).getTime() / 1000),
                            nanos: 0
                        }
                    });
                });
            }
        );
    },

    DeleteComment: (call, callback) => {
        const { session_token, comment_id } = call.request;
        const user = validateSession(session_token);

        if (!user) {
            return callback(createGrpcError(
                grpc.status.UNAUTHENTICATED,
                'Invalid session'
            ));
        }

        db.run('DELETE FROM comments WHERE id = ?', [comment_id], function(err) {
            if (err) {
                return callback(createGrpcError(
                    grpc.status.INTERNAL,
                    err.message
                ));
            }

            if (this.changes === 0) {
                return callback(createGrpcError(
                    grpc.status.NOT_FOUND,
                    'Comment not found'
                ));
            }

            callback(null, {});
        });
    }
};

// =============================================================================
// Milestone Service Implementation
// =============================================================================

const milestoneService = {
    GetMilestones: (call, callback) => {
        const { status } = call.request;
        let query = 'SELECT * FROM milestones';
        const params = [];

        if (status && status !== 0) {
            query += ' WHERE status = ?';
            params.push(mapMilestoneStatusFromEnum(status));
        }

        db.all(query, params, (err, rows) => {
            if (err) {
                return callback(createGrpcError(
                    grpc.status.INTERNAL,
                    err.message
                ));
            }

            const milestones = rows.map(row => ({
                id: row.id,
                title: row.title,
                description: row.description || '',
                due_date: row.due_date,
                status: mapMilestoneStatusToEnum(row.status),
                created_at: {
                    seconds: Math.floor(new Date(row.created_at).getTime() / 1000),
                    nanos: 0
                },
                updated_at: {
                    seconds: Math.floor(new Date(row.updated_at).getTime() / 1000),
                    nanos: 0
                }
            }));

            callback(null, { milestones });
        });
    },

    CreateMilestone: (call, callback) => {
        const { session_token, title, description, due_date, status } = call.request;
        const user = validateSession(session_token);

        if (!user) {
            return callback(createGrpcError(
                grpc.status.UNAUTHENTICATED,
                'Invalid session'
            ));
        }

        if (!title || !due_date || !status) {
            return callback(createGrpcError(
                grpc.status.INVALID_ARGUMENT,
                'Title, due_date, and status are required'
            ));
        }

        const newId = uuidv4();
        const now = new Date().toISOString();
        const statusStr = mapMilestoneStatusFromEnum(status);

        db.run(
            'INSERT INTO milestones (id, title, description, due_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [newId, title, description || '', due_date, statusStr, now, now],
            function(err) {
                if (err) {
                    return callback(createGrpcError(
                        grpc.status.INTERNAL,
                        err.message
                    ));
                }

                callback(null, {
                    id: newId,
                    title,
                    description: description || '',
                    due_date,
                    status,
                    created_at: {
                        seconds: Math.floor(new Date(now).getTime() / 1000),
                        nanos: 0
                    },
                    updated_at: {
                        seconds: Math.floor(new Date(now).getTime() / 1000),
                        nanos: 0
                    }
                });
            }
        );
    },

    UpdateMilestone: (call, callback) => {
        const { session_token, milestone_id, title, description, due_date, status } = call.request;
        const user = validateSession(session_token);

        if (!user) {
            return callback(createGrpcError(
                grpc.status.UNAUTHENTICATED,
                'Invalid session'
            ));
        }

        const updates = [];
        const params = [];

        if (title !== undefined) {
            updates.push('title = ?');
            params.push(title);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (due_date !== undefined) {
            updates.push('due_date = ?');
            params.push(due_date);
        }
        if (status !== undefined && status !== 0) {
            updates.push('status = ?');
            params.push(mapMilestoneStatusFromEnum(status));
        }

        if (updates.length === 0) {
            return callback(createGrpcError(
                grpc.status.INVALID_ARGUMENT,
                'No fields to update'
            ));
        }

        updates.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(milestone_id);

        db.run(
            `UPDATE milestones SET ${updates.join(', ')} WHERE id = ?`,
            params,
            function(err) {
                if (err) {
                    return callback(createGrpcError(
                        grpc.status.INTERNAL,
                        err.message
                    ));
                }

                if (this.changes === 0) {
                    return callback(createGrpcError(
                        grpc.status.NOT_FOUND,
                        'Milestone not found'
                    ));
                }

                // Return updated milestone
                db.get('SELECT * FROM milestones WHERE id = ?', [milestone_id], (getErr, row) => {
                    if (getErr) {
                        return callback(createGrpcError(
                            grpc.status.INTERNAL,
                            getErr.message
                        ));
                    }

                    callback(null, {
                        id: row.id,
                        title: row.title,
                        description: row.description || '',
                        due_date: row.due_date,
                        status: mapMilestoneStatusToEnum(row.status),
                        created_at: {
                            seconds: Math.floor(new Date(row.created_at).getTime() / 1000),
                            nanos: 0
                        },
                        updated_at: {
                            seconds: Math.floor(new Date(row.updated_at).getTime() / 1000),
                            nanos: 0
                        }
                    });
                });
            }
        );
    },

    DeleteMilestone: (call, callback) => {
        const { session_token, milestone_id } = call.request;
        const user = validateSession(session_token);

        if (!user) {
            return callback(createGrpcError(
                grpc.status.UNAUTHENTICATED,
                'Invalid session'
            ));
        }

        db.run('DELETE FROM milestones WHERE id = ?', [milestone_id], function(err) {
            if (err) {
                return callback(createGrpcError(
                    grpc.status.INTERNAL,
                    err.message
                ));
            }

            if (this.changes === 0) {
                return callback(createGrpcError(
                    grpc.status.NOT_FOUND,
                    'Milestone not found'
                ));
            }

            callback(null, {});
        });
    }
};

// =============================================================================
// Server Setup and Startup
// =============================================================================

function main() {
    const server = new grpc.Server();

    // Add all services
    server.addService(mantisProto.AuthService.service, authService);
    server.addService(mantisProto.IssueService.service, issueService);
    server.addService(mantisProto.CommentService.service, commentService);
    server.addService(mantisProto.LabelService.service, labelService);
    server.addService(mantisProto.MilestoneService.service, milestoneService);

    const port = process.env.GRPC_PORT || 50051;
    const bindAddress = `0.0.0.0:${port}`;

    server.bindAsync(bindAddress, grpc.ServerCredentials.createInsecure(), (err, port) => {
        if (err) {
            console.error('Failed to bind server:', err);
            return;
        }

        console.log(`gRPC server running on port ${port}`);
        console.log('Available services:');
        console.log('- AuthService: Register, Login, Logout, GetProfile');
        console.log('- IssueService: GetIssues, CreateIssue, GetIssue, UpdateIssue, DeleteIssue');
        console.log('- CommentService: GetComments, CreateComment, UpdateComment, DeleteComment');
        console.log('- LabelService: GetLabels, CreateLabel, UpdateLabel, DeleteLabel');
        console.log('- MilestoneService: GetMilestones, CreateMilestone, UpdateMilestone, DeleteMilestone');

        server.start();
    });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});

if (require.main === module) {
    main();
}

module.exports = {
    authService,
    issueService,
    commentService,
    labelService,
    milestoneService
};
