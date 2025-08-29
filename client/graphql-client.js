// GraphQL Client Example for Mantis Clone API
// Demonstrates all GraphQL operations

const axios = require('axios');

const GRAPHQL_URL = 'http://localhost:4000/graphql';

// Helper function to make GraphQL requests
async function graphqlRequest(query, variables = {}) {
    try {
        const response = await axios.post(GRAPHQL_URL, {
            query,
            variables
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.data.errors) {
            console.error('GraphQL Errors:', response.data.errors);
            return null;
        }

        return response.data.data;
    } catch (error) {
        console.error('Request Error:', error.message);
        return null;
    }
}

// Example queries and mutations
async function runExamples() {
    console.log('🚀 GraphQL Client Examples for Mantis Clone API');
    console.log('================================================\n');

    let sessionToken = null;

    // 1. Register a new user
    console.log('1. Registering a new user...');
    const registerMutation = `
        mutation RegisterUser($input: RegisterUserInput!) {
            registerUser(input: $input) {
                message
                user_id
            }
        }
    `;

    const registerResult = await graphqlRequest(registerMutation, {
        input: {
            username: 'graphql_user',
            password: 'secure_password123'
        }
    });

    if (registerResult) {
        console.log('✅ User registered:', registerResult.registerUser);
    }

    // 2. Login user
    console.log('\n2. Logging in user...');
    const loginMutation = `
        mutation LoginUser($input: LoginUserInput!) {
            loginUser(input: $input) {
                message
                user_id
                session_token
            }
        }
    `;

    const loginResult = await graphqlRequest(loginMutation, {
        input: {
            username: 'graphql_user',
            password: 'secure_password123'
        }
    });

    if (loginResult) {
        console.log('✅ User logged in:', loginResult.loginUser);
        sessionToken = loginResult.loginUser.session_token;
    }

    if (!sessionToken) {
        console.error('❌ Could not obtain session token. Stopping examples.');
        return;
    }

    // 3. Get user profile
    console.log('\n3. Getting user profile...');
    const profileQuery = `
        query GetProfile($sessionToken: String!) {
            profile(session_token: $sessionToken) {
                id
                username
                created_at
            }
        }
    `;

    const profileResult = await graphqlRequest(profileQuery, {
        sessionToken
    });

    if (profileResult) {
        console.log('✅ User profile:', profileResult.profile);
    }

    // 4. Create a label
    console.log('\n4. Creating a label...');
    const createLabelMutation = `
        mutation CreateLabel($input: CreateLabelInput!, $sessionToken: String!) {
            createLabel(input: $input, session_token: $sessionToken) {
                id
                name
                color
                description
            }
        }
    `;

    const labelResult = await graphqlRequest(createLabelMutation, {
        input: {
            name: 'Bug',
            color: '#ff0000',
            description: 'Something is broken'
        },
        sessionToken
    });

    if (labelResult) {
        console.log('✅ Label created:', labelResult.createLabel);
    }

    // 5. Get all labels
    console.log('\n5. Getting all labels...');
    const labelsQuery = `
        query GetLabels($sessionToken: String) {
            labels(session_token: $sessionToken) {
                id
                name
                color
                description
            }
        }
    `;

    const labelsResult = await graphqlRequest(labelsQuery, { sessionToken });

    if (labelsResult) {
        console.log('✅ Labels:', labelsResult.labels);
    }

    // 6. Create a milestone
    console.log('\n6. Creating a milestone...');
    const createMilestoneMutation = `
        mutation CreateMilestone($input: CreateMilestoneInput!, $sessionToken: String!) {
            createMilestone(input: $input, session_token: $sessionToken) {
                id
                title
                description
                due_date
                status
            }
        }
    `;

    const milestoneResult = await graphqlRequest(createMilestoneMutation, {
        input: {
            title: 'Version 1.0',
            description: 'First major release',
            due_date: '2024-12-31',
            status: 'OPEN'
        },
        sessionToken
    });

    if (milestoneResult) {
        console.log('✅ Milestone created:', milestoneResult.createMilestone);
    }

    // 7. Create an issue
    console.log('\n7. Creating an issue...');
    const createIssueMutation = `
        mutation CreateIssue($input: CreateIssueInput!, $sessionToken: String!) {
            createIssue(input: $input, session_token: $sessionToken) {
                id
                title
                description
                status
                priority
                creator
                created_at
            }
        }
    `;

    const issueResult = await graphqlRequest(createIssueMutation, {
        input: {
            title: 'GraphQL API Implementation',
            description: 'Implement GraphQL API with same functionality as REST',
            status: 'IN_PROGRESS',
            priority: 'HIGH',
            creator: 'graphql_user'
        },
        sessionToken
    });

    let issueId = null;
    if (issueResult) {
        console.log('✅ Issue created:', issueResult.createIssue);
        issueId = issueResult.createIssue.id;
    }

    // 8. Get all issues with filtering
    console.log('\n8. Getting all issues...');
    const issuesQuery = `
        query GetIssues($filters: IssueFilters, $pagination: PaginationInput, $sessionToken: String) {
            issues(filters: $filters, pagination: $pagination, session_token: $sessionToken) {
                data {
                    id
                    title
                    status
                    priority
                    creator
                    created_at
                }
                pagination {
                    total
                    page
                    per_page
                }
            }
        }
    `;

    const issuesResult = await graphqlRequest(issuesQuery, {
        filters: {
            status: 'IN_PROGRESS'
        },
        pagination: {
            page: 1,
            per_page: 10
        },
        sessionToken
    });

    if (issuesResult) {
        console.log('✅ Issues:', issuesResult.issues);
    }

    // 9. Create a comment on the issue
    if (issueId) {
        console.log('\n9. Creating a comment...');
        const createCommentMutation = `
            mutation CreateComment($issueId: ID!, $input: CreateCommentInput!, $sessionToken: String!) {
                createComment(issue_id: $issueId, input: $input, session_token: $sessionToken) {
                    id
                    content
                    author
                    created_at
                }
            }
        `;

        const commentResult = await graphqlRequest(createCommentMutation, {
            issueId,
            input: {
                content: 'This is a test comment from GraphQL client',
                author: 'graphql_user'
            },
            sessionToken
        });

        if (commentResult) {
            console.log('✅ Comment created:', commentResult.createComment);
        }

        // 10. Get comments for the issue
        console.log('\n10. Getting comments for issue...');
        const commentsQuery = `
            query GetComments($issueId: ID!, $sessionToken: String) {
                comments(issue_id: $issueId, session_token: $sessionToken) {
                    id
                    content
                    author
                    created_at
                }
            }
        `;

        const commentsResult = await graphqlRequest(commentsQuery, {
            issueId,
            sessionToken
        });

        if (commentsResult) {
            console.log('✅ Comments:', commentsResult.comments);
        }

        // 11. Update the issue
        console.log('\n11. Updating issue...');
        const updateIssueMutation = `
            mutation UpdateIssue($id: ID!, $input: UpdateIssueInput!, $sessionToken: String!) {
                updateIssue(id: $id, input: $input, session_token: $sessionToken) {
                    id
                    title
                    status
                    priority
                    updated_at
                }
            }
        `;

        const updateResult = await graphqlRequest(updateIssueMutation, {
            id: issueId,
            input: {
                status: 'RESOLVED',
                priority: 'MEDIUM'
            },
            sessionToken
        });

        if (updateResult) {
            console.log('✅ Issue updated:', updateResult.updateIssue);
        }
    }

    // 12. Logout
    console.log('\n12. Logging out...');
    const logoutMutation = `
        mutation LogoutUser($sessionToken: String!) {
            logoutUser(session_token: $sessionToken) {
                message
            }
        }
    `;

    const logoutResult = await graphqlRequest(logoutMutation, {
        sessionToken
    });

    if (logoutResult) {
        console.log('✅ Logged out:', logoutResult.logoutUser);
    }

    console.log('\n🎉 All GraphQL examples completed successfully!');
}

// Run examples if this file is executed directly
if (require.main === module) {
    runExamples().catch(console.error);
}

module.exports = { graphqlRequest, runExamples };
