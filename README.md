## A modern, RESTful issue tracking system with support for labels, comments, and milestones.

### Features

Issue Management: Create, update, and track issues with priority levels and status<br>
Label System: Organize issues with customizable labels and colors<br>
Commenting System: Collaborate through threaded comments on issues<br>
Milestone Tracking: Group issues into milestones with due dates<br>
RESTful API: Well-documented OpenAPI/Swagger specification<br>
Authentication: Secure JWT-based authentication<br>
Error Handling: Comprehensive error handling and validation<br>

## Installation

### Clone the repository:<br>
https://github.com/JoonasMagi/mantis-Clone-backend-api

### Install dependencies:<br>
npm install

### Edit the .env file with your configuration:<br>
PORT=3000<br>
JWT_SECRET=your_jwt_secret_here

### Start the server:<br>
npm start

### Authentication<br>
The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header. Authorization: Bearer your_jwt_token

### Base URL<br>
http://localhost:3000/api-docs/ # Swagger UI

## Core Endpoints<br>

### Issues<br>

GET /issues - List all issues (with filtering)
POST /issues - Create a new issue
GET /issues/{issueId} - Get issue details
PATCH /issues/{issueId} - Update an issue
DELETE /issues/{issueId} - Delete an issue

### Comments

GET /issues/{issueId}/comments - List comments for an issue
POST /issues/{issueId}/comments - Add a comment to an issue

### Labels

GET /labels - List all labels
POST /labels - Create a new label

### Milestones

GET /milestones - List all milestones
POST /milestones - Create a new milestone

### Error Handling
The API uses conventional HTTP response codes:
2xx - Success
4xx - Client errors
5xx - Server errors
