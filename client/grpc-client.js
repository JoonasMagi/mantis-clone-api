#!/usr/bin/env node

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

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

// Create clients
const authClient = new mantisProto.AuthService('127.0.0.1:50051', grpc.credentials.createInsecure());
const issueClient = new mantisProto.IssueService('127.0.0.1:50051', grpc.credentials.createInsecure());
const commentClient = new mantisProto.CommentService('127.0.0.1:50051', grpc.credentials.createInsecure());
const labelClient = new mantisProto.LabelService('127.0.0.1:50051', grpc.credentials.createInsecure());
const milestoneClient = new mantisProto.MilestoneService('127.0.0.1:50051', grpc.credentials.createInsecure());

// Global session token
let sessionToken = null;

// Helper function to promisify gRPC calls
function promisifyCall(client, method, request) {
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

// Demo functions
async function demoAuth() {
    console.log('\n🔐 === Authentication Demo ===');
    
    try {
        // Register a new user
        console.log('📝 Registering user...');
        const registerResponse = await promisifyCall(authClient, 'Register', {
            username: 'grpc_demo_user',
            password: 'demo_password123'
        });
        console.log('✅ Register response:', registerResponse);
        
        // Login
        console.log('🔑 Logging in...');
        const loginResponse = await promisifyCall(authClient, 'Login', {
            username: 'grpc_demo_user',
            password: 'demo_password123'
        });
        console.log('✅ Login response:', loginResponse);
        sessionToken = loginResponse.session_token;
        
        // Get profile
        console.log('👤 Getting profile...');
        const profileResponse = await promisifyCall(authClient, 'GetProfile', {
            session_token: sessionToken
        });
        console.log('✅ Profile response:', profileResponse);
        
    } catch (error) {
        console.error('❌ Auth error:', error.message);
        // Try to login with existing user if registration fails
        if (error.message.includes('already')) {
            try {
                const loginResponse = await promisifyCall(authClient, 'Login', {
                    username: 'grpc_demo_user',
                    password: 'demo_password123'
                });
                sessionToken = loginResponse.session_token;
                console.log('✅ Logged in with existing user');
            } catch (loginError) {
                console.error('❌ Login failed:', loginError.message);
            }
        }
    }
}

async function demoLabels() {
    console.log('\n🏷️  === Labels Demo ===');
    
    try {
        // Create a label
        console.log('📝 Creating label...');
        const createResponse = await promisifyCall(labelClient, 'CreateLabel', {
            session_token: sessionToken,
            name: 'gRPC Demo',
            color: '#FF5733',
            description: 'Label created via gRPC demo'
        });
        console.log('✅ Create label response:', createResponse);
        const labelId = createResponse.id;
        
        // Get all labels
        console.log('📋 Getting all labels...');
        const labelsResponse = await promisifyCall(labelClient, 'GetLabels', {});
        console.log('✅ Labels response:', labelsResponse);
        
        // Update the label
        console.log('✏️  Updating label...');
        const updateResponse = await promisifyCall(labelClient, 'UpdateLabel', {
            session_token: sessionToken,
            label_id: labelId,
            name: 'gRPC Demo Updated',
            description: 'Updated via gRPC demo'
        });
        console.log('✅ Update label response:', updateResponse);
        
        return labelId;
        
    } catch (error) {
        console.error('❌ Labels error:', error.message);
        return null;
    }
}

async function demoMilestones() {
    console.log('\n🎯 === Milestones Demo ===');
    
    try {
        // Create a milestone
        console.log('📝 Creating milestone...');
        const createResponse = await promisifyCall(milestoneClient, 'CreateMilestone', {
            session_token: sessionToken,
            title: 'gRPC Demo Milestone',
            description: 'Milestone created via gRPC demo',
            due_date: '2024-12-31',
            status: 1 // OPEN
        });
        console.log('✅ Create milestone response:', createResponse);
        const milestoneId = createResponse.id;
        
        // Get all milestones
        console.log('📋 Getting all milestones...');
        const milestonesResponse = await promisifyCall(milestoneClient, 'GetMilestones', {});
        console.log('✅ Milestones response:', milestonesResponse);
        
        return milestoneId;
        
    } catch (error) {
        console.error('❌ Milestones error:', error.message);
        return null;
    }
}

async function demoIssues(labelId, milestoneId) {
    console.log('\n🐛 === Issues Demo ===');
    
    try {
        // Create an issue
        console.log('📝 Creating issue...');
        const createResponse = await promisifyCall(issueClient, 'CreateIssue', {
            session_token: sessionToken,
            title: 'gRPC Demo Issue',
            description: 'This is a test issue created via gRPC demo',
            status: 1, // OPEN
            priority: 2, // MEDIUM
            creator: 'grpc_demo_user',
            labels: labelId ? [{ id: labelId, name: 'gRPC Demo Updated', color: '#FF5733' }] : [],
            milestone: milestoneId ? { id: milestoneId, title: 'gRPC Demo Milestone' } : null
        });
        console.log('✅ Create issue response:', createResponse);
        const issueId = createResponse.id;
        
        // Get all issues
        console.log('📋 Getting all issues...');
        const issuesResponse = await promisifyCall(issueClient, 'GetIssues', {
            pagination: { page: 1, per_page: 10 }
        });
        console.log('✅ Issues response:', issuesResponse);
        
        // Get specific issue
        console.log('🔍 Getting specific issue...');
        const issueResponse = await promisifyCall(issueClient, 'GetIssue', {
            issue_id: issueId
        });
        console.log('✅ Issue response:', issueResponse);
        
        // Update the issue
        console.log('✏️  Updating issue...');
        const updateResponse = await promisifyCall(issueClient, 'UpdateIssue', {
            session_token: sessionToken,
            issue_id: issueId,
            title: 'gRPC Demo Issue - Updated',
            status: 2, // IN_PROGRESS
            priority: 3 // HIGH
        });
        console.log('✅ Update issue response:', updateResponse);
        
        return issueId;
        
    } catch (error) {
        console.error('❌ Issues error:', error.message);
        return null;
    }
}

async function demoComments(issueId) {
    console.log('\n💬 === Comments Demo ===');
    
    if (!issueId) {
        console.log('⚠️  No issue ID available, skipping comments demo');
        return;
    }
    
    try {
        // Create a comment
        console.log('📝 Creating comment...');
        const createResponse = await promisifyCall(commentClient, 'CreateComment', {
            session_token: sessionToken,
            issue_id: issueId,
            content: 'This is a test comment created via gRPC demo',
            author: 'grpc_demo_user'
        });
        console.log('✅ Create comment response:', createResponse);
        const commentId = createResponse.id;
        
        // Get all comments for the issue
        console.log('📋 Getting comments for issue...');
        const commentsResponse = await promisifyCall(commentClient, 'GetComments', {
            issue_id: issueId
        });
        console.log('✅ Comments response:', commentsResponse);
        
        // Update the comment
        console.log('✏️  Updating comment...');
        const updateResponse = await promisifyCall(commentClient, 'UpdateComment', {
            session_token: sessionToken,
            comment_id: commentId,
            content: 'This comment has been updated via gRPC demo'
        });
        console.log('✅ Update comment response:', updateResponse);
        
    } catch (error) {
        console.error('❌ Comments error:', error.message);
    }
}

async function demoLogout() {
    console.log('\n🚪 === Logout Demo ===');
    
    if (!sessionToken) {
        console.log('⚠️  No session token available');
        return;
    }
    
    try {
        const logoutResponse = await promisifyCall(authClient, 'Logout', {
            session_token: sessionToken
        });
        console.log('✅ Logout response:', logoutResponse);
        sessionToken = null;
        
    } catch (error) {
        console.error('❌ Logout error:', error.message);
    }
}

// Main demo function
async function runDemo() {
    console.log('🚀 Mantis Clone gRPC Client Demo');
    console.log('==================================');
    
    try {
        await demoAuth();
        
        if (!sessionToken) {
            console.error('❌ Failed to authenticate, stopping demo');
            return;
        }
        
        const labelId = await demoLabels();
        const milestoneId = await demoMilestones();
        const issueId = await demoIssues(labelId, milestoneId);
        await demoComments(issueId);
        await demoLogout();
        
        console.log('\n🎉 Demo completed successfully!');
        
    } catch (error) {
        console.error('❌ Demo failed:', error);
    } finally {
        // Close all clients
        authClient.close();
        issueClient.close();
        commentClient.close();
        labelClient.close();
        milestoneClient.close();
    }
}

// Run the demo if this file is executed directly
if (require.main === module) {
    runDemo().catch(console.error);
}

module.exports = {
    authClient,
    issueClient,
    commentClient,
    labelClient,
    milestoneClient,
    promisifyCall
};
