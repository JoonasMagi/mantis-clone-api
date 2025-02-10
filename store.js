const { v4: uuidv4 } = require('uuid');

// In-memory storage
const store = {
    issues: new Map(),
    comments: new Map(),
    labels: new Map(),
    milestones: new Map(),
    users: new Map()
};

// Helper functions for CRUD operations
const Store = {
    // Issues
    createIssue(issueData) {
        const id = uuidv4();
        const issue = {
            id,
            ...issueData,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        store.issues.set(id, issue);
        return issue;
    },

    getIssue(id) {
        return store.issues.get(id);
    },

    getAllIssues() {
        return Array.from(store.issues.values());
    },

    updateIssue(id, data) {
        const issue = store.issues.get(id);
        if (!issue) return null;

        const updatedIssue = {
            ...issue,
            ...data,
            updatedAt: new Date()
        };
        store.issues.set(id, updatedIssue);
        return updatedIssue;
    },

    deleteIssue(id) {
        return store.issues.delete(id);
    },

    // Comments
    createComment(commentData) {
        const id = uuidv4();
        const comment = {
            id,
            ...commentData,
            createdAt: new Date()
        };
        store.comments.set(id, comment);
        return comment;
    },

    getIssueComments(issueId) {
        return Array.from(store.comments.values())
            .filter(comment => comment.issueId === issueId);
    },

    // Labels
    createLabel(labelData) {
        const id = uuidv4();
        const label = { id, ...labelData };
        store.labels.set(id, label);
        return label;
    },

    getAllLabels() {
        return Array.from(store.labels.values());
    },

    // Milestones
    createMilestone(milestoneData) {
        const id = uuidv4();
        const milestone = {
            id,
            ...milestoneData,
            createdAt: new Date()
        };
        store.milestones.set(id, milestone);
        return milestone;
    },

    getAllMilestones() {
        return Array.from(store.milestones.values());
    }
};

module.exports = Store;
