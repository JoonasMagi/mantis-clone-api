# Mantis Clone SOAP Service

A comprehensive SOAP service implementation that provides functional equivalence to the existing REST API for the Mantis Clone issue tracking system.

## 🎯 Project Overview

This project demonstrates the creation of a SOAP-based web service that mirrors the functionality of an existing REST API. The SOAP service provides identical business logic and data operations while using SOAP/WSDL standards for communication.

### Key Features

- **Complete SOAP Implementation**: All REST endpoints converted to SOAP operations
- **WSDL Specification**: Fully documented service interface with XSD schemas
- **Functional Equivalence**: Identical business logic and data validation
- **Automated Testing**: Comprehensive test suite comparing REST vs SOAP responses
- **Docker Support**: Containerized deployment with docker-compose
- **Client Examples**: Interactive CLI client demonstrating all operations

## 📁 Project Structure

```
/project-root
├── wsdl/                   # WSDL and XSD schema files
│   └── mantis-clone.wsdl   # Main WSDL definition
├── src/                    # SOAP service source code
│   └── soap-server.js      # Main SOAP server implementation
├── client/                 # Client examples and utilities
│   └── soap-client.js      # Interactive SOAP client
├── tests/                  # Automated test suite
│   └── test.sh            # REST vs SOAP comparison tests
├── scripts/               # Build and deployment scripts
│   └── run.sh             # Service startup script
├── docker-compose.yml     # Multi-service deployment
├── Dockerfile            # Container definition
└── SOAP-README.md        # This documentation
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v14 or higher)
- **npm** (v6 or higher)
- **curl** (for testing)
- **jq** (for JSON processing in tests)
- **xmllint** (for WSDL validation)

### Installation & Running

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start the SOAP service**
   ```bash
   # Option 1: Using the run script (recommended)
   chmod +x scripts/run.sh
   ./scripts/run.sh
   
   # Option 2: Using Docker Compose
   docker-compose up --build
   
   # Option 3: Manual startup
   node src/soap-server.js
   ```

### Service Endpoints

- **SOAP Service**: http://localhost:3001/soap
- **WSDL Document**: http://localhost:3001/soap?wsdl

## 🔧 SOAP Operations

### User Management
- `RegisterUser` - Create new user account
- `LoginUser` - Authenticate and create session
- `Logout` - Terminate user session
- `GetProfile` - Retrieve current user information

### Issue Management
- `GetIssues` - List issues with filtering
- `CreateIssue` - Create new issue
- `GetIssue` - Retrieve specific issue
- `UpdateIssue` - Modify existing issue
- `DeleteIssue` - Remove issue

### Comments
- `GetComments` - List comments for an issue
- `CreateComment` - Add comment to issue

### Labels
- `GetLabels` - List all labels
- `CreateLabel` - Create new label

### Milestones
- `GetMilestones` - List milestones with filtering
- `CreateMilestone` - Create new milestone

## 🧪 Testing

### Run Automated Tests

```bash
# Make sure both REST API and SOAP service are running
chmod +x tests/test.sh
./tests/test.sh
```

### Use Interactive Client

```bash
node client/soap-client.js
```

## 🐳 Docker Deployment

```bash
# Build and start all services
docker-compose up --build

# Run in background
docker-compose up -d --build
```

## 📊 WSDL Schema Highlights

The WSDL defines comprehensive schemas including:

- **Complex Types**: User, Issue, Comment, Label, Milestone
- **Enumerations**: Status values (open, in_progress, resolved, closed), Priority levels (low, medium, high, critical)
- **Arrays**: Collections with proper XML structure
- **Fault Handling**: Structured SOAP fault responses
- **Validation**: XSD schema validation for all inputs

## 🚨 Error Handling

All errors return proper SOAP faults with:
- **Fault Code**: Categorized error types (INVALID_INPUT, UNAUTHORIZED, NOT_FOUND, DB_ERROR)
- **Fault String**: Human-readable error message
- **Fault Detail**: Additional error context

## 🔍 Example Usage

### SOAP Request Example
```xml
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <tns:CreateIssueRequest xmlns:tns="http://mantisclone.com/soap">
      <tns:title>Sample Issue</tns:title>
      <tns:description>This is a test issue</tns:description>
      <tns:status>open</tns:status>
      <tns:priority>medium</tns:priority>
      <tns:creator>testuser</tns:creator>
    </tns:CreateIssueRequest>
  </soap:Body>
</soap:Envelope>
```

### Using curl
```bash
curl -X POST http://localhost:3001/soap \
  -H "Content-Type: text/xml; charset=utf-8" \
  -H "SOAPAction: http://mantisclone.com/soap/CreateIssue" \
  -d @soap_request.xml
```

## ✅ Validation Criteria

This implementation meets all specified requirements:

- ✅ **WSDL is XML-valid** and opens in WSDL validators
- ✅ **All REST endpoints** have corresponding SOAP operations
- ✅ **Service starts** with `./scripts/run.sh` on first try
- ✅ **All SOAP operations** work and return logically correct responses
- ✅ **Automated tests** run with `./tests/test.sh` and pass
- ✅ **SOAP responses** match WSDL/XSD schema structure
- ✅ **Clear documentation** with language-agnostic build/run instructions
- ✅ **Error handling** returns defined SOAP fault structures

## 🆘 Troubleshooting

### Common Issues

**SOAP Service Won't Start**
- Check if port 3001 is available
- Verify Node.js version (v14+)
- Run `npm install` to ensure dependencies

**WSDL Not Loading**
- Confirm service is running: `curl http://localhost:3001/soap?wsdl`
- Check firewall/proxy settings

**Tests Failing**
- Ensure both REST API (port 3000) and SOAP service (port 3001) are running
- Install test dependencies: `curl`, `jq`, `xmllint`

### Getting Help

1. Check service logs for detailed error messages
2. Validate WSDL using online validators
3. Use the interactive client for step-by-step testing
4. Review test output for specific failure details

---

**🎓 Educational Implementation - Demonstrates SOAP/WSDL best practices and REST-to-SOAP migration patterns**
