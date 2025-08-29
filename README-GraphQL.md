# Mantis Clone GraphQL API

A comprehensive GraphQL API that provides **exactly the same functionality** as the existing REST API. Built with Apollo Server, Express.js, and SQLite, this implementation demonstrates functional equivalence between REST and GraphQL architectures.

## 🎯 Project Overview

This GraphQL API is a complete reimplementation of the Mantis Clone REST API, providing:

- **Functional Equivalence**: Every REST endpoint has a corresponding GraphQL query or mutation
- **Same Business Logic**: Identical authentication, validation, and data processing
- **Shared Database**: Uses the same SQLite database as the REST API
- **Type Safety**: Comprehensive GraphQL schema with proper type definitions
- **Error Handling**: Consistent error responses matching REST behavior

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- SQLite3

### One-Command Startup

```bash
# Make the script executable (Linux/macOS)
chmod +x scripts/run-graphql.sh

# Start the GraphQL server
./scripts/run-graphql.sh
```

**Alternative: Docker**

```bash
# Build and run with Docker
docker build -f Dockerfile.graphql -t mantis-graphql .
docker run -p 4000:4000 mantis-graphql
```

### Manual Setup

```bash
# Install dependencies
npm install apollo-server-express@3.12.0 graphql@16.6.0 sqlite3@5.1.6 uuid@9.0.0 bcrypt@5.1.0 cors@2.8.5 dotenv@16.0.3

# Start the server
node src/graphql-server.js
```

## 📊 API Access

- **GraphQL Endpoint**: http://localhost:4000/graphql
- **GraphQL Playground**: http://localhost:4000/graphql (interactive query interface)
- **Schema Introspection**: Available via GraphQL Playground

## 🔧 GraphQL Schema Overview

### Core Types

```graphql
type User {
  id: Int!
  username: String!
  created_at: DateTime!
  updated_at: DateTime
}

type Issue {
  id: ID!
  title: String!
  description: String
  status: IssueStatus!
  priority: IssuePriority!
  assignee: String
  creator: String!
  created_at: DateTime!
  updated_at: DateTime
}

type Label {
  id: ID!
  name: String!
  color: String!
  description: String
}

type Comment {
  id: ID!
  issue_id: ID!
  content: String!
  author: String!
  created_at: DateTime!
  updated_at: DateTime
}

type Milestone {
  id: ID!
  title: String!
  description: String
  due_date: String
  status: MilestoneStatus!
  created_at: DateTime
  updated_at: DateTime
}
```

### Enums

```graphql
enum IssueStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
}

enum IssuePriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum MilestoneStatus {
  OPEN
  CLOSED
}
```

## 📝 API Usage Examples

### Authentication

```graphql
# Register a new user
mutation {
  registerUser(input: {
    username: "newuser"
    password: "securepassword"
  }) {
    message
    user_id
  }
}

# Login
mutation {
  loginUser(input: {
    username: "newuser"
    password: "securepassword"
  }) {
    message
    user_id
    session_token
  }
}

# Get user profile
query {
  profile(session_token: "your-session-token") {
    id
    username
    created_at
  }
}
```

### Issues Management

```graphql
# Create an issue
mutation {
  createIssue(
    input: {
      title: "Bug in login system"
      description: "Users cannot log in with special characters"
      status: OPEN
      priority: HIGH
      creator: "developer1"
    }
    session_token: "your-session-token"
  ) {
    id
    title
    status
    priority
    created_at
  }
}

# Get issues with filtering and pagination
query {
  issues(
    filters: {
      status: OPEN
      priority: HIGH
    }
    pagination: {
      page: 1
      per_page: 10
    }
  ) {
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

# Update an issue
mutation {
  updateIssue(
    id: "issue-uuid"
    input: {
      status: RESOLVED
      priority: MEDIUM
    }
    session_token: "your-session-token"
  ) {
    id
    title
    status
    priority
    updated_at
  }
}
```

### Labels and Comments

```graphql
# Create a label
mutation {
  createLabel(
    input: {
      name: "bug"
      color: "#ff0000"
      description: "Something is broken"
    }
    session_token: "your-session-token"
  ) {
    id
    name
    color
    description
  }
}

# Add a comment to an issue
mutation {
  createComment(
    issue_id: "issue-uuid"
    input: {
      content: "I can reproduce this issue"
      author: "tester1"
    }
    session_token: "your-session-token"
  ) {
    id
    content
    author
    created_at
  }
}

# Get comments for an issue
query {
  comments(issue_id: "issue-uuid") {
    id
    content
    author
    created_at
  }
}
```

## 🧪 Testing

### Run All Tests

```bash
# Make test script executable
chmod +x tests/test-graphql.sh

# Run comprehensive test suite
./tests/test-graphql.sh
```

### Manual Testing

```bash
# Test GraphQL client examples
node client/graphql-client.js

# Run equivalence tests (compares REST vs GraphQL)
node tests/graphql-equivalence-test.js
```

### Test Coverage

The test suite verifies:

- ✅ GraphQL SDL validates successfully
- ✅ GraphQL introspection works
- ✅ All REST endpoints have GraphQL equivalents  
- ✅ Service starts with one command
- ✅ All example queries/mutations work correctly
- ✅ Automated tests pass
- ✅ GraphQL responses match SDL types
- ✅ Error handling works correctly

## 🔄 REST to GraphQL Mapping

| REST Endpoint | HTTP Method | GraphQL Operation | Type |
|---------------|-------------|-------------------|------|
| `/register` | POST | `registerUser` | Mutation |
| `/login` | POST | `loginUser` | Mutation |
| `/logout` | POST | `logoutUser` | Mutation |
| `/profile` | GET | `profile` | Query |
| `/issues` | GET | `issues` | Query |
| `/issues` | POST | `createIssue` | Mutation |
| `/issues/:id` | GET | `issue` | Query |
| `/issues/:id` | PUT | `updateIssue` | Mutation |
| `/issues/:id` | DELETE | `deleteIssue` | Mutation |
| `/labels` | GET | `labels` | Query |
| `/labels` | POST | `createLabel` | Mutation |
| `/issues/:id/comments` | GET | `comments` | Query |
| `/issues/:id/comments` | POST | `createComment` | Mutation |
| `/milestones` | GET | `milestones` | Query |
| `/milestones` | POST | `createMilestone` | Mutation |

## 🏗️ Project Structure

```
/project-root
├── schema/
│   └── schema.graphql          # GraphQL Schema Definition Language
├── src/
│   └── graphql-server.js       # Main GraphQL server implementation
├── scripts/
│   └── run-graphql.sh          # One-command startup script
├── client/
│   └── graphql-client.js       # Example GraphQL client
├── tests/
│   ├── test-graphql.sh         # Automated test runner
│   └── graphql-equivalence-test.js  # REST vs GraphQL comparison tests
├── Dockerfile.graphql          # Docker configuration
├── graphql-package.json        # GraphQL-specific dependencies
└── README-GraphQL.md           # This documentation
```

## 🔐 Authentication

The GraphQL API uses the same session-based authentication as the REST API:

1. Register or login to get a session token
2. Include the session token in subsequent requests
3. Session tokens are validated for protected operations
4. Logout to invalidate the session token

## ⚡ Performance & Features

- **Type Safety**: Full GraphQL type system with validation
- **Introspection**: Schema exploration via GraphQL Playground
- **Flexible Queries**: Request only the fields you need
- **Single Endpoint**: All operations through `/graphql`
- **Error Handling**: Structured error responses
- **Pagination**: Built-in pagination for list queries
- **Filtering**: Query-level filtering for issues

## 🐛 Error Handling

GraphQL errors are returned in the standard GraphQL error format:

```json
{
  "errors": [
    {
      "message": "Invalid session",
      "locations": [{"line": 2, "column": 3}],
      "path": ["createIssue"]
    }
  ]
}
```

## 🤝 Contributing

This GraphQL implementation maintains functional equivalence with the REST API. When making changes:

1. Ensure GraphQL schema matches data models
2. Maintain consistent error handling
3. Update tests for new functionality
4. Verify equivalence with REST API

## 📄 License

MIT License - Same as the original REST API implementation.
