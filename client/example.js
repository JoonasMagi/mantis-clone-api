#!/usr/bin/env node

// Simple SOAP Client Example
// This demonstrates basic usage of each SOAP operation

const soap = require('soap');

const SOAP_URL = 'http://localhost:3001/soap?wsdl';

async function runExample() {
    try {
        console.log('🔌 Connecting to SOAP service...');
        const client = await soap.createClientAsync(SOAP_URL);
        console.log('✅ Connected successfully!\n');

        // 1. Register a user
        console.log('1️⃣ Registering user...');
        const uniqueUsername = 'example_user_' + Date.now();
        const registerResult = await client.RegisterUserAsync({
            username: uniqueUsername,
            password: 'example123'
        });
        console.log('✅ User registered:', registerResult[0].message);

        // 2. Login
        console.log('\n2️⃣ Logging in...');
        const loginResult = await client.LoginUserAsync({
            username: uniqueUsername,
            password: 'example123'
        });
        const sessionId = loginResult[0].session_id;
        console.log('✅ Logged in, session:', sessionId);

        // 3. Create an issue
        console.log('\n3️⃣ Creating issue...');
        const issueResult = await client.CreateIssueAsync({
            title: 'Example Issue',
            description: 'This is an example issue created via SOAP',
            status: 'open',
            priority: 'medium',
            creator: uniqueUsername
        });
        const issueId = issueResult[0].id;
        console.log('✅ Issue created with ID:', issueId);

        // 4. Get issues
        console.log('\n4️⃣ Getting issues...');
        const issuesResult = await client.GetIssuesAsync({});
        console.log('✅ Found', issuesResult[0].data.issue.length, 'issues');

        // 5. Get existing labels
        console.log('\n5️⃣ Getting labels...');
        const labelsResult = await client.GetLabelsAsync({});
        console.log('✅ Found', (labelsResult[0] && labelsResult[0].label) ? labelsResult[0].label.length : 0, 'labels');

        // 6. Create a milestone
        console.log('\n6️⃣ Creating milestone...');
        const milestoneResult = await client.CreateMilestoneAsync({
            title: 'Example Milestone',
            description: 'This is an example milestone',
            due_date: '2024-12-31',
            status: 'open'
        });
        console.log('✅ Milestone created:', milestoneResult[0].title);

        // 7. Add a comment
        console.log('\n7️⃣ Adding comment...');
        const commentResult = await client.CreateCommentAsync({
            issueId: issueId,
            comment: {
                content: 'This is an example comment via SOAP',
                author: uniqueUsername
            }
        });
        console.log('✅ Comment added:', commentResult[0].content);

        // 8. Get profile
        console.log('\n8️⃣ Getting profile...');
        const profileResult = await client.GetProfileAsync({
            session_id: sessionId
        });
        console.log('✅ Profile retrieved for user:', profileResult[0].user.username);

        // 9. Logout
        console.log('\n9️⃣ Logging out...');
        const logoutResult = await client.LogoutAsync({
            session_id: sessionId
        });
        console.log('✅ Logged out:', logoutResult[0].message);

        console.log('\n🎉 Example completed successfully!');
        console.log('All SOAP operations demonstrated and working correctly.');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.root && error.root.Envelope && error.root.Envelope.Body && error.root.Envelope.Body.Fault) {
            const fault = error.root.Envelope.Body.Fault;
            console.error('SOAP Fault:', fault.Reason?.Text || fault.faultstring);
        }
        process.exit(1);
    }
}

// Check if SOAP service is available
async function checkService() {
    try {
        const response = await fetch(SOAP_URL);
        return response.ok;
    } catch (error) {
        return false;
    }
}

async function main() {
    console.log('🐛 Mantis Clone SOAP Example');
    console.log('============================\n');

    // Check if service is running
    const serviceAvailable = await checkService();
    if (!serviceAvailable) {
        console.error('❌ SOAP service is not running at', SOAP_URL);
        console.log('Please start the SOAP service first:');
        console.log('  node src/soap-server.js');
        console.log('  or');
        console.log('  ./scripts/run.sh');
        process.exit(1);
    }

    await runExample();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { runExample };
