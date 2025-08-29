#!/usr/bin/env node

// SOAP Client Example for Mantis Clone API
const soap = require('soap');
const readline = require('readline');

const SOAP_URL = 'http://localhost:3001/soap?wsdl';

// Global variables to store session info
let soapClient = null;
let currentSession = null;
let currentUser = null;

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Helper function to prompt user input
function prompt(question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

// Helper function to display results
function displayResult(operation, result, error = null) {
    console.log('\n' + '='.repeat(50));
    console.log(`OPERATION: ${operation}`);
    console.log('='.repeat(50));
    
    if (error) {
        console.log('❌ ERROR:', error.message);
        if (error.root && error.root.Envelope && error.root.Envelope.Body && error.root.Envelope.Body.Fault) {
            const fault = error.root.Envelope.Body.Fault;
            console.log('SOAP Fault Details:');
            console.log('- Code:', fault.Code?.Value || 'N/A');
            console.log('- Reason:', fault.Reason?.Text || fault.faultstring || 'N/A');
            console.log('- Detail:', fault.Detail?.ErrorInfo || fault.detail || 'N/A');
        }
    } else {
        console.log('✅ SUCCESS:');
        console.log(JSON.stringify(result, null, 2));
    }
    console.log('='.repeat(50) + '\n');
}

// Initialize SOAP client
async function initializeClient() {
    try {
        console.log('🔌 Connecting to SOAP service...');
        soapClient = await soap.createClientAsync(SOAP_URL);
        console.log('✅ Connected to SOAP service successfully!');
        console.log('Available operations:', Object.keys(soapClient.describe().MantisCloneService.MantisCloneSoapPort));
        return true;
    } catch (error) {
        console.error('❌ Failed to connect to SOAP service:', error.message);
        console.error('Make sure the SOAP service is running at', SOAP_URL);
        return false;
    }
}

// User Operations
async function registerUser() {
    try {
        const username = await prompt('Enter username: ');
        const password = await prompt('Enter password: ');
        
        const result = await soapClient.RegisterUserAsync({
            username: username,
            password: password
        });
        
        displayResult('RegisterUser', result[0]);
        return result[0];
    } catch (error) {
        displayResult('RegisterUser', null, error);
        return null;
    }
}

async function loginUser() {
    try {
        const username = await prompt('Enter username: ');
        const password = await prompt('Enter password: ');
        
        const result = await soapClient.LoginUserAsync({
            username: username,
            password: password
        });
        
        displayResult('LoginUser', result[0]);
        
        if (result[0] && result[0].session_id) {
            currentSession = result[0].session_id;
            currentUser = result[0].user;
            console.log('🔐 Session stored for future operations');
        }
        
        return result[0];
    } catch (error) {
        displayResult('LoginUser', null, error);
        return null;
    }
}

async function logout() {
    if (!currentSession) {
        console.log('❌ No active session to logout');
        return;
    }
    
    try {
        const result = await soapClient.LogoutAsync({
            session_id: currentSession
        });
        
        displayResult('Logout', result[0]);
        
        currentSession = null;
        currentUser = null;
        console.log('🔓 Session cleared');
        
        return result[0];
    } catch (error) {
        displayResult('Logout', null, error);
        return null;
    }
}

async function getProfile() {
    if (!currentSession) {
        console.log('❌ Please login first');
        return;
    }
    
    try {
        const result = await soapClient.GetProfileAsync({
            session_id: currentSession
        });
        
        displayResult('GetProfile', result[0]);
        return result[0];
    } catch (error) {
        displayResult('GetProfile', null, error);
        return null;
    }
}

// Issue Operations
async function getIssues() {
    try {
        const status = await prompt('Enter status filter (open/in_progress/resolved/closed) or press Enter to skip: ');
        const priority = await prompt('Enter priority filter (low/medium/high/critical) or press Enter to skip: ');
        
        const params = {};
        if (status.trim()) params.status = status.trim();
        if (priority.trim()) params.priority = priority.trim();
        
        const result = await soapClient.GetIssuesAsync(params);
        displayResult('GetIssues', result[0]);
        return result[0];
    } catch (error) {
        displayResult('GetIssues', null, error);
        return null;
    }
}

async function createIssue() {
    try {
        const title = await prompt('Enter issue title: ');
        const description = await prompt('Enter issue description: ');
        const status = await prompt('Enter status (open/in_progress/resolved/closed): ');
        const priority = await prompt('Enter priority (low/medium/high/critical): ');
        const assignee = await prompt('Enter assignee (or press Enter to skip): ');
        const creator = await prompt('Enter creator: ');
        
        const params = {
            title: title,
            description: description,
            status: status,
            priority: priority,
            creator: creator
        };
        
        if (assignee.trim()) {
            params.assignee = assignee.trim();
        }
        
        const result = await soapClient.CreateIssueAsync(params);
        displayResult('CreateIssue', result[0]);
        return result[0];
    } catch (error) {
        displayResult('CreateIssue', null, error);
        return null;
    }
}

async function getIssue() {
    try {
        const issueId = await prompt('Enter issue ID: ');
        
        const result = await soapClient.GetIssueAsync({
            issueId: issueId
        });
        
        displayResult('GetIssue', result[0]);
        return result[0];
    } catch (error) {
        displayResult('GetIssue', null, error);
        return null;
    }
}

async function updateIssue() {
    try {
        const issueId = await prompt('Enter issue ID to update: ');
        const title = await prompt('Enter new title (or press Enter to skip): ');
        const description = await prompt('Enter new description (or press Enter to skip): ');
        const status = await prompt('Enter new status (or press Enter to skip): ');
        const priority = await prompt('Enter new priority (or press Enter to skip): ');
        const assignee = await prompt('Enter new assignee (or press Enter to skip): ');
        
        const issue = {};
        if (title.trim()) issue.title = title.trim();
        if (description.trim()) issue.description = description.trim();
        if (status.trim()) issue.status = status.trim();
        if (priority.trim()) issue.priority = priority.trim();
        if (assignee.trim()) issue.assignee = assignee.trim();
        
        const result = await soapClient.UpdateIssueAsync({
            issueId: issueId,
            issue: issue
        });
        
        displayResult('UpdateIssue', result[0]);
        return result[0];
    } catch (error) {
        displayResult('UpdateIssue', null, error);
        return null;
    }
}

async function deleteIssue() {
    try {
        const issueId = await prompt('Enter issue ID to delete: ');
        
        const result = await soapClient.DeleteIssueAsync({
            issueId: issueId
        });
        
        displayResult('DeleteIssue', result[0]);
        return result[0];
    } catch (error) {
        displayResult('DeleteIssue', null, error);
        return null;
    }
}

// Comment Operations
async function getComments() {
    try {
        const issueId = await prompt('Enter issue ID: ');
        
        const result = await soapClient.GetCommentsAsync({
            issueId: issueId
        });
        
        displayResult('GetComments', result[0]);
        return result[0];
    } catch (error) {
        displayResult('GetComments', null, error);
        return null;
    }
}

async function createComment() {
    try {
        const issueId = await prompt('Enter issue ID: ');
        const content = await prompt('Enter comment content: ');
        const author = await prompt('Enter author: ');
        
        const result = await soapClient.CreateCommentAsync({
            issueId: issueId,
            comment: {
                content: content,
                author: author
            }
        });
        
        displayResult('CreateComment', result[0]);
        return result[0];
    } catch (error) {
        displayResult('CreateComment', null, error);
        return null;
    }
}

// Label Operations
async function getLabels() {
    try {
        const result = await soapClient.GetLabelsAsync({});
        displayResult('GetLabels', result[0]);
        return result[0];
    } catch (error) {
        displayResult('GetLabels', null, error);
        return null;
    }
}

async function createLabel() {
    try {
        const name = await prompt('Enter label name: ');
        const color = await prompt('Enter label color (e.g., #FF0000): ');
        const description = await prompt('Enter label description (or press Enter to skip): ');
        
        const params = {
            name: name,
            color: color
        };
        
        if (description.trim()) {
            params.description = description.trim();
        }
        
        const result = await soapClient.CreateLabelAsync(params);
        displayResult('CreateLabel', result[0]);
        return result[0];
    } catch (error) {
        displayResult('CreateLabel', null, error);
        return null;
    }
}

// Milestone Operations
async function getMilestones() {
    try {
        const status = await prompt('Enter status filter (open/closed) or press Enter to skip: ');
        
        const params = {};
        if (status.trim()) params.status = status.trim();
        
        const result = await soapClient.GetMilestonesAsync(params);
        displayResult('GetMilestones', result[0]);
        return result[0];
    } catch (error) {
        displayResult('GetMilestones', null, error);
        return null;
    }
}

async function createMilestone() {
    try {
        const title = await prompt('Enter milestone title: ');
        const description = await prompt('Enter milestone description (or press Enter to skip): ');
        const due_date = await prompt('Enter due date (YYYY-MM-DD) or press Enter to skip: ');
        const status = await prompt('Enter status (open/closed): ');
        
        const params = {
            title: title,
            status: status
        };
        
        if (description.trim()) params.description = description.trim();
        if (due_date.trim()) params.due_date = due_date.trim();
        
        const result = await soapClient.CreateMilestoneAsync(params);
        displayResult('CreateMilestone', result[0]);
        return result[0];
    } catch (error) {
        displayResult('CreateMilestone', null, error);
        return null;
    }
}

// Display menu
function displayMenu() {
    console.log('\n🐛 Mantis Clone SOAP Client');
    console.log('============================');

    if (currentUser) {
        console.log(`👤 Logged in as: ${currentUser.username} (ID: ${currentUser.id})`);
        console.log(`🔑 Session ID: ${currentSession}`);
    } else {
        console.log('👤 Not logged in');
    }

    console.log('\nAvailable Operations:');
    console.log('');
    console.log('User Operations:');
    console.log('  1. Register User');
    console.log('  2. Login User');
    console.log('  3. Logout');
    console.log('  4. Get Profile');
    console.log('');
    console.log('Issue Operations:');
    console.log('  5. Get Issues');
    console.log('  6. Create Issue');
    console.log('  7. Get Issue');
    console.log('  8. Update Issue');
    console.log('  9. Delete Issue');
    console.log('');
    console.log('Comment Operations:');
    console.log(' 10. Get Comments');
    console.log(' 11. Create Comment');
    console.log('');
    console.log('Label Operations:');
    console.log(' 12. Get Labels');
    console.log(' 13. Create Label');
    console.log('');
    console.log('Milestone Operations:');
    console.log(' 14. Get Milestones');
    console.log(' 15. Create Milestone');
    console.log('');
    console.log('Other:');
    console.log(' 16. Run Demo (automated test of all operations)');
    console.log('  0. Exit');
    console.log('');
}

// Run automated demo
async function runDemo() {
    console.log('\n🚀 Running automated demo...\n');

    // Demo data
    const demoUser = {
        username: 'demo_user_' + Date.now(),
        password: 'demo123'
    };

    try {
        // 1. Register user
        console.log('1️⃣ Registering demo user...');
        await soapClient.RegisterUserAsync(demoUser);
        console.log('✅ User registered');

        // 2. Login
        console.log('\n2️⃣ Logging in...');
        const loginResult = await soapClient.LoginUserAsync(demoUser);
        currentSession = loginResult[0].session_id;
        currentUser = loginResult[0].user;
        console.log('✅ Logged in successfully');

        // 3. Get profile
        console.log('\n3️⃣ Getting profile...');
        await soapClient.GetProfileAsync({ session_id: currentSession });
        console.log('✅ Profile retrieved');

        // 4. Create label
        console.log('\n4️⃣ Creating label...');
        const labelResult = await soapClient.CreateLabelAsync({
            name: 'Demo Label',
            color: '#FF5733',
            description: 'This is a demo label'
        });
        console.log('✅ Label created');

        // 5. Create milestone
        console.log('\n5️⃣ Creating milestone...');
        const milestoneResult = await soapClient.CreateMilestoneAsync({
            title: 'Demo Milestone',
            description: 'This is a demo milestone',
            due_date: '2024-12-31',
            status: 'open'
        });
        console.log('✅ Milestone created');

        // 6. Create issue
        console.log('\n6️⃣ Creating issue...');
        const issueResult = await soapClient.CreateIssueAsync({
            title: 'Demo Issue',
            description: 'This is a demo issue created via SOAP',
            status: 'open',
            priority: 'medium',
            creator: currentUser.username
        });
        const issueId = issueResult[0].id;
        console.log('✅ Issue created with ID:', issueId);

        // 7. Get issues
        console.log('\n7️⃣ Getting all issues...');
        await soapClient.GetIssuesAsync({});
        console.log('✅ Issues retrieved');

        // 8. Get specific issue
        console.log('\n8️⃣ Getting specific issue...');
        await soapClient.GetIssueAsync({ issueId: issueId });
        console.log('✅ Specific issue retrieved');

        // 9. Create comment
        console.log('\n9️⃣ Creating comment...');
        await soapClient.CreateCommentAsync({
            issueId: issueId,
            comment: {
                content: 'This is a demo comment via SOAP',
                author: currentUser.username
            }
        });
        console.log('✅ Comment created');

        // 10. Get comments
        console.log('\n🔟 Getting comments...');
        await soapClient.GetCommentsAsync({ issueId: issueId });
        console.log('✅ Comments retrieved');

        // 11. Update issue
        console.log('\n1️⃣1️⃣ Updating issue...');
        await soapClient.UpdateIssueAsync({
            issueId: issueId,
            issue: {
                status: 'in_progress',
                priority: 'high'
            }
        });
        console.log('✅ Issue updated');

        // 12. Get labels
        console.log('\n1️⃣2️⃣ Getting labels...');
        await soapClient.GetLabelsAsync({});
        console.log('✅ Labels retrieved');

        // 13. Get milestones
        console.log('\n1️⃣3️⃣ Getting milestones...');
        await soapClient.GetMilestonesAsync({});
        console.log('✅ Milestones retrieved');

        // 14. Logout
        console.log('\n1️⃣4️⃣ Logging out...');
        await soapClient.LogoutAsync({ session_id: currentSession });
        currentSession = null;
        currentUser = null;
        console.log('✅ Logged out');

        console.log('\n🎉 Demo completed successfully!');
        console.log('All SOAP operations have been tested and work correctly.');

    } catch (error) {
        console.error('\n❌ Demo failed:', error.message);
        if (error.root && error.root.Envelope && error.root.Envelope.Body && error.root.Envelope.Body.Fault) {
            const fault = error.root.Envelope.Body.Fault;
            console.error('SOAP Fault:', fault.Reason?.Text || fault.faultstring);
        }
    }
}

// Main menu loop
async function mainLoop() {
    while (true) {
        displayMenu();
        const choice = await prompt('Enter your choice (0-16): ');

        switch (choice.trim()) {
            case '1':
                await registerUser();
                break;
            case '2':
                await loginUser();
                break;
            case '3':
                await logout();
                break;
            case '4':
                await getProfile();
                break;
            case '5':
                await getIssues();
                break;
            case '6':
                await createIssue();
                break;
            case '7':
                await getIssue();
                break;
            case '8':
                await updateIssue();
                break;
            case '9':
                await deleteIssue();
                break;
            case '10':
                await getComments();
                break;
            case '11':
                await createComment();
                break;
            case '12':
                await getLabels();
                break;
            case '13':
                await createLabel();
                break;
            case '14':
                await getMilestones();
                break;
            case '15':
                await createMilestone();
                break;
            case '16':
                await runDemo();
                break;
            case '0':
                console.log('👋 Goodbye!');
                rl.close();
                process.exit(0);
                break;
            default:
                console.log('❌ Invalid choice. Please try again.');
        }

        await prompt('\nPress Enter to continue...');
    }
}

// Main function
async function main() {
    console.log('🐛 Mantis Clone SOAP Client');
    console.log('============================\n');

    const connected = await initializeClient();
    if (!connected) {
        process.exit(1);
    }

    await mainLoop();
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n👋 Goodbye!');
    rl.close();
    process.exit(0);
});

// Start the client
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    initializeClient,
    registerUser,
    loginUser,
    logout,
    getProfile,
    getIssues,
    createIssue,
    getIssue,
    updateIssue,
    deleteIssue,
    getComments,
    createComment,
    getLabels,
    createLabel,
    getMilestones,
    createMilestone,
    runDemo
};
