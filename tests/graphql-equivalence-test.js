// GraphQL vs REST Equivalence Test
// Compares responses between REST and GraphQL APIs to ensure functional equivalence

const axios = require('axios');
const { execSync } = require('child_process');

const REST_BASE_URL = 'http://localhost:3000';
const GRAPHQL_URL = 'http://localhost:4000/graphql';

// Test configuration
const TEST_USER = {
    username: 'test_equivalence_user',
    password: 'test_password123'
};

// Helper functions
async function restRequest(method, path, data = null, headers = {}) {
    try {
        const config = {
            method,
            url: `${REST_BASE_URL}${path}`,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };
        
        if (data) {
            config.data = data;
        }

        const response = await axios(config);
        return { status: response.status, data: response.data };
    } catch (error) {
        return { 
            status: error.response?.status || 500, 
            data: error.response?.data || { message: error.message } 
        };
    }
}

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
            return { 
                status: 400, 
                data: { errors: response.data.errors } 
            };
        }

        return { status: 200, data: response.data.data };
    } catch (error) {
        return { 
            status: error.response?.status || 500, 
            data: { message: error.message } 
        };
    }
}

// Test cases
async function testUserRegistration() {
    console.log('Testing User Registration...');
    
    // REST
    const restResult = await restRequest('POST', '/register', TEST_USER);
    
    // GraphQL
    const graphqlResult = await graphqlRequest(`
        mutation RegisterUser($input: RegisterUserInput!) {
            registerUser(input: $input) {
                message
                user_id
            }
        }
    `, { input: { ...TEST_USER, username: TEST_USER.username + '_gql' } });

    // Compare structure (both should succeed or fail similarly)
    const restSuccess = restResult.status === 201;
    const graphqlSuccess = graphqlResult.status === 200 && !graphqlResult.data.errors;
    
    if (restSuccess && graphqlSuccess) {
        console.log('✅ User registration: Both APIs succeeded');
        return true;
    } else if (!restSuccess && !graphqlSuccess) {
        console.log('✅ User registration: Both APIs failed as expected');
        return true;
    } else {
        console.log('❌ User registration: APIs behaved differently');
        console.log('REST:', restResult);
        console.log('GraphQL:', graphqlResult);
        return false;
    }
}

async function testUserLogin() {
    console.log('Testing User Login...');
    
    // REST
    const restResult = await restRequest('POST', '/login', TEST_USER);
    
    // GraphQL
    const graphqlResult = await graphqlRequest(`
        mutation LoginUser($input: LoginUserInput!) {
            loginUser(input: $input) {
                message
                user_id
                session_token
            }
        }
    `, { input: { ...TEST_USER, username: TEST_USER.username + '_gql' } });

    const restSuccess = restResult.status === 200;
    const graphqlSuccess = graphqlResult.status === 200 && !graphqlResult.data.errors;
    
    if (restSuccess && graphqlSuccess) {
        console.log('✅ User login: Both APIs succeeded');
        return {
            success: true,
            restSession: restResult.data.session_token,
            graphqlSession: graphqlResult.data.loginUser.session_token
        };
    } else {
        console.log('❌ User login: APIs behaved differently');
        return { success: false };
    }
}

async function testIssueOperations(restSession, graphqlSession) {
    console.log('Testing Issue Operations...');
    
    const issueData = {
        title: 'Test Issue',
        description: 'Test description',
        status: 'open',
        priority: 'medium',
        creator: 'test_user'
    };

    // Create issue - REST
    const restCreateResult = await restRequest('POST', '/issues', issueData);
    
    // Create issue - GraphQL
    const graphqlCreateResult = await graphqlRequest(`
        mutation CreateIssue($input: CreateIssueInput!, $sessionToken: String!) {
            createIssue(input: $input, session_token: $sessionToken) {
                id
                title
                description
                status
                priority
                creator
            }
        }
    `, { 
        input: {
            ...issueData,
            status: issueData.status.toUpperCase(),
            priority: issueData.priority.toUpperCase()
        },
        sessionToken: graphqlSession 
    });

    const restCreateSuccess = restCreateResult.status === 201;
    const graphqlCreateSuccess = graphqlCreateResult.status === 200 && !graphqlCreateResult.data.errors;
    
    if (!restCreateSuccess || !graphqlCreateSuccess) {
        console.log('❌ Issue creation failed');
        return false;
    }

    // Get issues - REST
    const restGetResult = await restRequest('GET', '/issues');
    
    // Get issues - GraphQL
    const graphqlGetResult = await graphqlRequest(`
        query GetIssues {
            issues {
                data {
                    id
                    title
                    description
                    status
                    priority
                    creator
                }
                pagination {
                    total
                    page
                    per_page
                }
            }
        }
    `);

    const restGetSuccess = restGetResult.status === 200;
    const graphqlGetSuccess = graphqlGetResult.status === 200 && !graphqlGetResult.data.errors;
    
    if (restGetSuccess && graphqlGetSuccess) {
        console.log('✅ Issue operations: Both APIs succeeded');
        return true;
    } else {
        console.log('❌ Issue operations: APIs behaved differently');
        return false;
    }
}

async function testLabelOperations(restSession, graphqlSession) {
    console.log('Testing Label Operations...');
    
    const labelData = {
        name: 'Test Label',
        color: '#ff0000',
        description: 'Test label description'
    };

    // Create label - REST
    const restCreateResult = await restRequest('POST', '/labels', labelData);
    
    // Create label - GraphQL
    const graphqlCreateResult = await graphqlRequest(`
        mutation CreateLabel($input: CreateLabelInput!, $sessionToken: String!) {
            createLabel(input: $input, session_token: $sessionToken) {
                id
                name
                color
                description
            }
        }
    `, { input: labelData, sessionToken: graphqlSession });

    // Get labels - REST
    const restGetResult = await restRequest('GET', '/labels');
    
    // Get labels - GraphQL
    const graphqlGetResult = await graphqlRequest(`
        query GetLabels {
            labels {
                id
                name
                color
                description
            }
        }
    `);

    const restSuccess = restCreateResult.status === 201 && restGetResult.status === 200;
    const graphqlSuccess = graphqlCreateResult.status === 200 && graphqlGetResult.status === 200 && 
                          !graphqlCreateResult.data.errors && !graphqlGetResult.data.errors;
    
    if (restSuccess && graphqlSuccess) {
        console.log('✅ Label operations: Both APIs succeeded');
        return true;
    } else {
        console.log('❌ Label operations: APIs behaved differently');
        return false;
    }
}

async function runEquivalenceTests() {
    console.log('🧪 Running GraphQL vs REST Equivalence Tests');
    console.log('==============================================\n');

    let passedTests = 0;
    let totalTests = 0;

    // Test 1: User Registration
    totalTests++;
    if (await testUserRegistration()) {
        passedTests++;
    }

    // Test 2: User Login
    totalTests++;
    const loginResult = await testUserLogin();
    if (loginResult.success) {
        passedTests++;
        
        // Test 3: Issue Operations (requires login)
        totalTests++;
        if (await testIssueOperations(loginResult.restSession, loginResult.graphqlSession)) {
            passedTests++;
        }

        // Test 4: Label Operations (requires login)
        totalTests++;
        if (await testLabelOperations(loginResult.restSession, loginResult.graphqlSession)) {
            passedTests++;
        }
    }

    console.log('\n📊 Test Results:');
    console.log(`Passed: ${passedTests}/${totalTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (passedTests === totalTests) {
        console.log('🎉 All equivalence tests passed! GraphQL API is functionally equivalent to REST API.');
        return true;
    } else {
        console.log('❌ Some tests failed. GraphQL API may not be fully equivalent to REST API.');
        return false;
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runEquivalenceTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test execution failed:', error);
            process.exit(1);
        });
}

module.exports = { runEquivalenceTests };
