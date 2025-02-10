const jwt = require('jsonwebtoken');
const Store = require('./store');

// Basic authentication middleware
const auth = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

// Check if user is admin
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

// Check if user owns the resource or is admin
const isOwnerOrAdmin = (resourceType) => async (req, res, next) => {
    const resourceId = req.params.id || req.params.issueId;
    const resource = Store[`get${resourceType}`](resourceId);

    if (!resource) {
        return res.status(404).json({ message: `${resourceType} not found` });
    }

    if (req.user.role === 'admin' || resource.userId === req.user.id) {
        req.resource = resource;
        next();
    } else {
        res.status(403).json({ message: 'Not authorized to perform this action' });
    }
};

module.exports = {
    auth,
    isAdmin,
    isOwnerOrAdmin
};