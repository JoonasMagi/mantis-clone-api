const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// In-memory user store
const users = new Map();

// Add a test admin user
const adminId = uuidv4();
users.set('admin@test.com', {
    id: adminId,
    email: 'admin@test.com',
    password: bcrypt.hashSync('admin123', 10),
    role: 'admin'
});

const auth = {
    // Register new user
    async register(email, password) {
        if (users.has(email)) {
            throw new Error('User already exists');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = uuidv4();

        const user = {
            id: userId,
            email,
            password: hashedPassword,
            role: 'user'
        };

        users.set(email, user);
        return this.generateToken(user);
    },

    // Login user
    async login(email, password) {
        const user = users.get(email);
        if (!user) {
            throw new Error('User not found');
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            throw new Error('Invalid password');
        }

        return this.generateToken(user);
    },

    // Generate JWT token
    generateToken(user) {
        const payload = {
            id: user.id,
            email: user.email,
            role: user.role
        };

        return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
    },

    // Get user by email
    getUser(email) {
        return users.get(email);
    }
};

module.exports = auth;