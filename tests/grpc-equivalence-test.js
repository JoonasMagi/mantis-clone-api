#!/usr/bin/env node

/**
 * Mantis Clone - REST vs gRPC Functional Equivalence Tests
 * This script compares REST and gRPC responses to ensure functional equivalence
 */

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const axios = require('axios');

// Configuration
const REST_PORT = process.env.REST_PORT || 3000;
const GRPC_PORT = process.env.GRPC_PORT || 50051;
const REST_BASE_URL = `http://localhost:${REST_PORT}`;

// Test user credentials
const TEST_USER = `test_user_${Date.now()}`;
const TEST_PASSWORD = 'test_password123';

// Load gRPC proto
const PROTO_PATH = path.join(__dirname, '../proto/mantis.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});

const mantisProto = grpc.loadPackageDefinition(packageDefinition).mantis;

// Create gRPC clients
const authClient = new mantisProto.AuthService(`localhost:${GRPC_PORT}`, grpc.credentials.createInsecure());
const issueClient = new mantisProto.IssueService(`localhost:${GRPC_PORT}`, grpc.credentials.createInsecure());
const labelClient = new mantisProto.LabelService(`localhost:${GRPC_PORT}`, grpc.credentials.createInsecure());
const milestoneClient = new mantisProto.MilestoneService(`localhost:${GRPC_PORT}`, grpc.credentials.createInsecure());
const commentClient = new mantisProto.CommentService(`localhost:${GRPC_PORT}`, grpc.credentials.createInsecure());

// Test results tracking
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

// Session storage
let restCookies = '';
let grpcSessionToken = '';

// Helper functions
function log(message, type = 'info') {
    const colors = {
        info: '\x1b[36m',    // Cyan
        success: '\x1b[32m', // Green
        error: '\x1b[31m',   // Red
        warning: '\x1b[33m'  // Yellow
    };
    const reset = '\x1b[0m';
    console.log(`${colors[type]}${message}${reset}`);
}

function promisifyGrpc(client, method, request) {
    return new Promise((resolve, reject) => {
        client[method](request, (error, response) => {
            if (error) {
                reject(error);
            } else {
                resolve(response);
            }
        });
    });
}

async function testEquivalence(testName, restCall, grpcCall, validator) {
    testsRun++;
    log(`\n🧪 Testing: ${testName}`);
    
    try {
        const [restResult, grpcResult] = await Promise.all([
            restCall().catch(err => ({ error: err.response?.status || err.message })),
            grpcCall().catch(err => ({ error: err.code || err.message }))
        ]);
        
        const isEquivalent = validator(restResult, grpcResult);
        
        if (isEquivalent) {
            testsPassed++;
            log(`✅ ${testName}: PASSED`, 'success');
        } else {
            testsFailed++;
            log(`❌ ${testName}: FAILED`, 'error');
            log(`   REST: ${JSON.stringify(restResult, null, 2)}`, 'error');
            log(`   gRPC: ${JSON.stringify(grpcResult, null, 2)}`, 'error');
        }
        
        return isEquivalent;
    } catch (error) {
        testsFailed++;
        log(`❌ ${testName}: ERROR - ${error.message}`, 'error');
        return false;
    }
}

// Test functions
async function testUserRegistration() {
    return await testEquivalence(
        'User Registration',
        async () => {
            const response = await axios.post(`${REST_BASE_URL}/register`, {
                username: TEST_USER,
                password: TEST_PASSWORD
            });
            return { status: response.status, data: response.data };
        },
        async () => {
            const response = await promisifyGrpc(authClient, 'Register', {
                username: TEST_USER,
                password: TEST_PASSWORD
            });
            return { status: 'success', data: response };
        },
        (rest, grpc) => {
            // Both should succeed (201/success) or both should fail with "already exists"
            const restSuccess = rest.status === 201;
            const grpcSuccess = grpc.status === 'success';
            const restConflict = rest.error === 409;
            const grpcConflict = grpc.error && grpc.error.toString().includes('ALREADY_EXISTS');
            
            return (restSuccess && grpcSuccess) || (restConflict && grpcConflict);
        }
    );
}

async function testUserLogin() {
    return await testEquivalence(
        'User Login',
        async () => {
            const response = await axios.post(`${REST_BASE_URL}/login`, {
                username: TEST_USER,
                password: TEST_PASSWORD
            });
            // Store cookies for future requests
            restCookies = response.headers['set-cookie']?.join('; ') || '';
            return { status: response.status, data: response.data };
        },
        async () => {
            const response = await promisifyGrpc(authClient, 'Login', {
                username: TEST_USER,
                password: TEST_PASSWORD
            });
            // Store session token for future requests
            grpcSessionToken = response.session_token;
            return { status: 'success', data: response };
        },
        (rest, grpc) => {
            const restSuccess = rest.status === 200 && rest.data?.user;
            const grpcSuccess = grpc.status === 'success' && grpc.data?.user && grpc.data?.session_token;
            return restSuccess && grpcSuccess;
        }
    );
}

async function testLabelCreation() {
    const labelData = {
        name: 'Test Label',
        color: '#FF5733',
        description: 'Test label description'
    };
    
    return await testEquivalence(
        'Label Creation',
        async () => {
            const response = await axios.post(`${REST_BASE_URL}/labels`, labelData, {
                headers: { Cookie: restCookies }
            });
            return { status: response.status, data: response.data };
        },
        async () => {
            const response = await promisifyGrpc(labelClient, 'CreateLabel', {
                session_token: grpcSessionToken,
                ...labelData
            });
            return { status: 'success', data: response };
        },
        (rest, grpc) => {
            const restSuccess = rest.status === 201 && rest.data?.name === labelData.name;
            const grpcSuccess = grpc.status === 'success' && grpc.data?.name === labelData.name;
            return restSuccess && grpcSuccess;
        }
    );
}

async function testGetLabels() {
    return await testEquivalence(
        'Get Labels',
        async () => {
            const response = await axios.get(`${REST_BASE_URL}/labels`);
            return { status: response.status, data: response.data };
        },
        async () => {
            const response = await promisifyGrpc(labelClient, 'GetLabels', {});
            return { status: 'success', data: response };
        },
        (rest, grpc) => {
            const restSuccess = rest.status === 200 && Array.isArray(rest.data);
            const grpcSuccess = grpc.status === 'success' && Array.isArray(grpc.data?.labels);
            return restSuccess && grpcSuccess;
        }
    );
}

async function testIssueCreation() {
    const issueData = {
        title: 'Test Issue',
        description: 'Test issue description',
        status: 'open',
        priority: 'medium',
        creator: TEST_USER
    };
    
    return await testEquivalence(
        'Issue Creation',
        async () => {
            const response = await axios.post(`${REST_BASE_URL}/issues`, issueData, {
                headers: { Cookie: restCookies }
            });
            return { status: response.status, data: response.data };
        },
        async () => {
            const response = await promisifyGrpc(issueClient, 'CreateIssue', {
                session_token: grpcSessionToken,
                title: issueData.title,
                description: issueData.description,
                status: 1, // OPEN
                priority: 2, // MEDIUM
                creator: issueData.creator
            });
            return { status: 'success', data: response };
        },
        (rest, grpc) => {
            const restSuccess = rest.status === 201 && rest.data?.title === issueData.title;
            const grpcSuccess = grpc.status === 'success' && grpc.data?.title === issueData.title;
            return restSuccess && grpcSuccess;
        }
    );
}

async function testGetIssues() {
    return await testEquivalence(
        'Get Issues',
        async () => {
            const response = await axios.get(`${REST_BASE_URL}/issues`);
            return { status: response.status, data: response.data };
        },
        async () => {
            const response = await promisifyGrpc(issueClient, 'GetIssues', {
                pagination: { page: 1, per_page: 20 }
            });
            return { status: 'success', data: response };
        },
        (rest, grpc) => {
            const restSuccess = rest.status === 200 && rest.data?.data && rest.data?.pagination;
            const grpcSuccess = grpc.status === 'success' && grpc.data?.data && grpc.data?.pagination;
            return restSuccess && grpcSuccess;
        }
    );
}

async function checkServerAvailability() {
    log('🔍 Checking server availability...');
    
    try {
        // Check REST server
        await axios.get(REST_BASE_URL);
        log('✅ REST server is available', 'success');
    } catch (error) {
        log('❌ REST server is not available', 'error');
        throw new Error('REST server not available');
    }
    
    try {
        // Check gRPC server
        await new Promise((resolve, reject) => {
            const client = new grpc.Client(`localhost:${GRPC_PORT}`, grpc.credentials.createInsecure());
            client.waitForReady(Date.now() + 5000, (err) => {
                client.close();
                if (err) reject(err);
                else resolve();
            });
        });
        log('✅ gRPC server is available', 'success');
    } catch (error) {
        log('❌ gRPC server is not available', 'error');
        throw new Error('gRPC server not available');
    }
}

async function runTests() {
    log('🚀 Starting REST vs gRPC Equivalence Tests\n', 'info');
    
    try {
        await checkServerAvailability();
        
        // Run authentication tests
        await testUserRegistration();
        await testUserLogin();
        
        // Run API functionality tests
        await testLabelCreation();
        await testGetLabels();
        await testIssueCreation();
        await testGetIssues();
        
        // Print results
        log('\n📊 Test Results:', 'info');
        log('================', 'info');
        log(`✅ Passed: ${testsPassed}`, 'success');
        log(`❌ Failed: ${testsFailed}`, 'error');
        log(`📈 Total:  ${testsRun}`, 'info');
        
        if (testsFailed === 0) {
            log('\n🎉 All tests passed! REST and gRPC APIs are functionally equivalent.', 'success');
            process.exit(0);
        } else {
            log('\n💥 Some tests failed. Please check the implementation.', 'error');
            process.exit(1);
        }
        
    } catch (error) {
        log(`💥 Test execution failed: ${error.message}`, 'error');
        process.exit(1);
    } finally {
        // Close gRPC clients
        authClient.close();
        issueClient.close();
        labelClient.close();
        milestoneClient.close();
        commentClient.close();
    }
}

// Add axios to the gRPC package.json dependencies
const fs = require('fs');
const packagePath = path.join(__dirname, '../grpc-package.json');
if (fs.existsSync(packagePath)) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    if (!pkg.dependencies.axios) {
        pkg.dependencies.axios = '^1.5.0';
        fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
        log('📦 Added axios dependency to grpc-package.json', 'info');
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { runTests };
