const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const Store = require('./store');
const { auth, isAdmin, isOwnerOrAdmin } = require('./middleware');

// Issue routes
router.get('/issues', auth, (req, res) => {
    const { status, priority, label } = req.query;
    let issues = Store.getAllIssues();

    if (status) {
        issues = issues.filter(issue => issue.status === status);
    }
    if (priority) {
        issues = issues.filter(issue => issue.priority === priority);
    }
    if (label) {
        issues = issues.filter(issue =>
            issue.labels && issue.labels.includes(label)
        );
    }

    res.json(issues);
});

router.post('/issues', [
    auth,
    [
        check('title').notEmpty(),
        check('priority').isIn(['low', 'medium', 'high', 'critical'])
    ]
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const issue = Store.createIssue({
        ...req.body,
        status: 'open'
    });
    res.status(201).json(issue);
});

router.put('/issues/:id', [auth, isOwnerOrAdmin('Issue')], (req, res) => {
    const updatedIssue = Store.updateIssue(req.params.id, req.body);
    res.json(updatedIssue);
});

router.delete('/issues/:id', [auth, isOwnerOrAdmin('Issue')], (req, res) => {
    Store.deleteIssue(req.params.id);
    res.status(204).send();
});

// Admin-only routes
router.post('/labels', [auth, isAdmin], [
    check('name').notEmpty(),
    check('color').matches(/^#[0-9a-fA-F]{6}$/)
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const label = Store.createLabel(req.body);
    res.status(201).json(label);
});

// Comment routes
router.get('/issues/:issueId/comments', auth, (req, res) => {
    const comments = Store.getIssueComments(req.params.issueId);
    res.json(comments);
});

// Create comment
router.post('/issues/:issueId/comments', [
    auth,
    check('content').notEmpty()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const comment = Store.createComment({
        ...req.body,
        issueId: req.params.issueId,
        userId: req.user.id
    });
    res.status(201).json(comment);
});

// Update comment
router.put('/issues/:issueId/comments/:id', [
    auth,
    isOwnerOrAdmin('Comment'),
    check('content').notEmpty()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const updatedComment = Store.updateComment(req.params.id, {
        content: req.body.content
    });
    res.json(updatedComment);
});

// Delete comment
router.delete('/issues/:issueId/comments/:id', [
    auth,
    isOwnerOrAdmin('Comment')
], (req, res) => {
    Store.deleteComment(req.params.id);
    res.status(204).send();
});

// Label routes
router.get('/labels', auth, (req, res) => {
    const labels = Store.getAllLabels();
    res.json(labels);
});

router.post('/labels', [
    auth,
    [
        check('name').notEmpty(),
        check('color').matches(/^#[0-9a-fA-F]{6}$/)
    ]
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const label = Store.createLabel(req.body);
    res.status(201).json(label);
});

module.exports = router;