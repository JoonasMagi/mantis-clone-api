const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('./auth');

// Register endpoint
router.post('/register', [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be 6 or more characters').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, password } = req.body;
        const token = await auth.register(email, password);
        res.json({ token });
    } catch (err) {
        if (err.message === 'User already exists') {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

// Login endpoint
router.post('/login', [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, password } = req.body;
        const token = await auth.login(email, password);
        res.json({ token });
    } catch (err) {
        if (err.message === 'User not found' || err.message === 'Invalid password') {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

// Protected test route
router.get('/me', require('./middleware').auth, (req, res) => {
    res.json({
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
    });
});

module.exports = router;