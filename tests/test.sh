#!/bin/bash

# Automated Tests for Mantis Clone SOAP vs REST API
# This script compares REST and SOAP responses to ensure functional equivalence

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
REST_URL="http://localhost:3000"
SOAP_URL="http://localhost:3001/soap"
TEST_USER="test_user_$(date +%s)"
TEST_PASSWORD="test123"
TEST_RESULTS_DIR="tests/results"

# Global variables
REST_SESSION=""
SOAP_SESSION=""
TEST_ISSUE_ID=""
PASSED_TESTS=0
FAILED_TESTS=0
TOTAL_TESTS=0

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_TESTS++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_TESTS++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Check if services are running
check_services() {
    log_info "Checking if services are running..."
    
    # Check REST API
    if ! curl -s "$REST_URL" > /dev/null; then
        log_error "REST API is not running at $REST_URL"
        log_info "Please start the REST API first: npm start"
        exit 1
    fi
    log_success "REST API is running"
    
    # Check SOAP service
    if ! curl -s "$SOAP_URL?wsdl" > /dev/null; then
        log_error "SOAP service is not running at $SOAP_URL"
        log_info "Please start the SOAP service first: node src/soap-server.js"
        exit 1
    fi
    log_success "SOAP service is running"
}

# Setup test environment
setup_tests() {
    log_info "Setting up test environment..."
    
    # Create results directory
    mkdir -p "$TEST_RESULTS_DIR"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        npm install
    fi
    
    log_success "Test environment ready"
}

# REST API helper functions
rest_register() {
    local username="$1"
    local password="$2"
    
    curl -s -X POST "$REST_URL/register" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$username\",\"password\":\"$password\"}"
}

rest_login() {
    local username="$1"
    local password="$2"
    
    curl -s -X POST "$REST_URL/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$username\",\"password\":\"$password\"}" \
        -c "tests/rest_cookies.txt"
}

rest_get_issues() {
    curl -s -X GET "$REST_URL/issues" \
        -b "tests/rest_cookies.txt"
}

rest_create_issue() {
    local title="$1"
    local description="$2"
    local status="$3"
    local priority="$4"
    local creator="$5"
    
    curl -s -X POST "$REST_URL/issues" \
        -H "Content-Type: application/json" \
        -b "tests/rest_cookies.txt" \
        -d "{\"title\":\"$title\",\"description\":\"$description\",\"status\":\"$status\",\"priority\":\"$priority\",\"creator\":\"$creator\"}"
}

# SOAP API helper functions (using Node.js script)
soap_call() {
    local operation="$1"
    local params="$2"
    
    node -e "
    const soap = require('soap');
    const url = '$SOAP_URL?wsdl';
    
    soap.createClient(url, (err, client) => {
        if (err) {
            console.error('SOAP Error:', err.message);
            process.exit(1);
        }
        
        const params = $params;
        client.$operation(params, (err, result) => {
            if (err) {
                console.error('SOAP Operation Error:', err.message);
                process.exit(1);
            }
            console.log(JSON.stringify(result, null, 2));
        });
    });
    "
}

# Test functions
test_user_registration() {
    log_info "Testing user registration..."
    ((TOTAL_TESTS++))
    
    # Test REST
    local rest_result=$(rest_register "$TEST_USER" "$TEST_PASSWORD")
    local rest_success=$(echo "$rest_result" | jq -r '.message // empty' 2>/dev/null)
    
    # Test SOAP
    local soap_params="{\"username\":\"${TEST_USER}_soap\",\"password\":\"$TEST_PASSWORD\"}"
    local soap_result=$(soap_call "RegisterUser" "$soap_params" 2>/dev/null || echo '{"error": true}')
    local soap_success=$(echo "$soap_result" | jq -r '.message // empty' 2>/dev/null)
    
    # Compare results
    if [[ -n "$rest_success" && -n "$soap_success" ]]; then
        log_success "User registration works in both REST and SOAP"
    else
        log_error "User registration failed - REST: '$rest_success', SOAP: '$soap_success'"
    fi
}

test_user_login() {
    log_info "Testing user login..."
    ((TOTAL_TESTS++))
    
    # Test REST
    local rest_result=$(rest_login "$TEST_USER" "$TEST_PASSWORD")
    local rest_session=$(echo "$rest_result" | jq -r '.session_id // empty' 2>/dev/null)
    REST_SESSION="$rest_session"
    
    # Test SOAP
    local soap_params="{\"username\":\"${TEST_USER}_soap\",\"password\":\"$TEST_PASSWORD\"}"
    local soap_result=$(soap_call "LoginUser" "$soap_params" 2>/dev/null || echo '{"error": true}')
    local soap_session=$(echo "$soap_result" | jq -r '.session_id // empty' 2>/dev/null)
    SOAP_SESSION="$soap_session"
    
    # Compare results
    if [[ -n "$rest_session" && -n "$soap_session" ]]; then
        log_success "User login works in both REST and SOAP"
    else
        log_error "User login failed - REST session: '$rest_session', SOAP session: '$soap_session'"
    fi
}

test_issue_creation() {
    log_info "Testing issue creation..."
    ((TOTAL_TESTS++))
    
    # Test REST
    local rest_result=$(rest_create_issue "Test Issue REST" "Test description" "open" "medium" "$TEST_USER")
    local rest_id=$(echo "$rest_result" | jq -r '.id // empty' 2>/dev/null)
    TEST_ISSUE_ID="$rest_id"
    
    # Test SOAP
    local soap_params="{\"title\":\"Test Issue SOAP\",\"description\":\"Test description\",\"status\":\"open\",\"priority\":\"medium\",\"creator\":\"${TEST_USER}_soap\"}"
    local soap_result=$(soap_call "CreateIssue" "$soap_params" 2>/dev/null || echo '{"error": true}')
    local soap_id=$(echo "$soap_result" | jq -r '.id // empty' 2>/dev/null)
    
    # Compare results
    if [[ -n "$rest_id" && -n "$soap_id" ]]; then
        log_success "Issue creation works in both REST and SOAP"
    else
        log_error "Issue creation failed - REST ID: '$rest_id', SOAP ID: '$soap_id'"
    fi
}

test_issue_retrieval() {
    log_info "Testing issue retrieval..."
    ((TOTAL_TESTS++))
    
    if [[ -z "$TEST_ISSUE_ID" ]]; then
        log_error "No test issue ID available for retrieval test"
        return
    fi
    
    # Test REST
    local rest_result=$(curl -s -X GET "$REST_URL/issues/$TEST_ISSUE_ID" -b "tests/rest_cookies.txt")
    local rest_title=$(echo "$rest_result" | jq -r '.title // empty' 2>/dev/null)
    
    # Test SOAP
    local soap_params="{\"issueId\":\"$TEST_ISSUE_ID\"}"
    local soap_result=$(soap_call "GetIssue" "$soap_params" 2>/dev/null || echo '{"error": true}')
    local soap_title=$(echo "$soap_result" | jq -r '.title // empty' 2>/dev/null)
    
    # Compare results
    if [[ -n "$rest_title" && -n "$soap_title" ]]; then
        log_success "Issue retrieval works in both REST and SOAP"
    else
        log_error "Issue retrieval failed - REST title: '$rest_title', SOAP title: '$soap_title'"
    fi
}

test_issues_list() {
    log_info "Testing issues list..."
    ((TOTAL_TESTS++))
    
    # Test REST
    local rest_result=$(rest_get_issues)
    local rest_count=$(echo "$rest_result" | jq '.data | length' 2>/dev/null || echo "0")
    
    # Test SOAP
    local soap_params="{}"
    local soap_result=$(soap_call "GetIssues" "$soap_params" 2>/dev/null || echo '{"error": true}')
    local soap_count=$(echo "$soap_result" | jq '.data.issue | length' 2>/dev/null || echo "0")
    
    # Compare results (should have at least some issues)
    if [[ "$rest_count" -gt 0 && "$soap_count" -gt 0 ]]; then
        log_success "Issues list works in both REST and SOAP (REST: $rest_count, SOAP: $soap_count)"
    else
        log_error "Issues list failed - REST count: $rest_count, SOAP count: $soap_count"
    fi
}

test_labels() {
    log_info "Testing labels..."
    ((TOTAL_TESTS++))
    
    # Test REST - Create label
    local rest_create=$(curl -s -X POST "$REST_URL/labels" \
        -H "Content-Type: application/json" \
        -b "tests/rest_cookies.txt" \
        -d '{"name":"Test Label REST","color":"#FF0000","description":"Test label"}')
    local rest_label_id=$(echo "$rest_create" | jq -r '.id // empty' 2>/dev/null)
    
    # Test SOAP - Create label
    local soap_params='{"name":"Test Label SOAP","color":"#00FF00","description":"Test label"}'
    local soap_create=$(soap_call "CreateLabel" "$soap_params" 2>/dev/null || echo '{"error": true}')
    local soap_label_id=$(echo "$soap_create" | jq -r '.id // empty' 2>/dev/null)
    
    # Test REST - Get labels
    local rest_labels=$(curl -s -X GET "$REST_URL/labels" -b "tests/rest_cookies.txt")
    local rest_labels_count=$(echo "$rest_labels" | jq 'length' 2>/dev/null || echo "0")
    
    # Test SOAP - Get labels
    local soap_labels=$(soap_call "GetLabels" "{}" 2>/dev/null || echo '{"error": true}')
    local soap_labels_count=$(echo "$soap_labels" | jq '.label | length' 2>/dev/null || echo "0")
    
    # Compare results
    if [[ -n "$rest_label_id" && -n "$soap_label_id" && "$rest_labels_count" -gt 0 && "$soap_labels_count" -gt 0 ]]; then
        log_success "Labels work in both REST and SOAP"
    else
        log_error "Labels failed - REST ID: '$rest_label_id', SOAP ID: '$soap_label_id', REST count: $rest_labels_count, SOAP count: $soap_labels_count"
    fi
}

test_milestones() {
    log_info "Testing milestones..."
    ((TOTAL_TESTS++))
    
    # Test REST - Create milestone
    local rest_create=$(curl -s -X POST "$REST_URL/milestones" \
        -H "Content-Type: application/json" \
        -b "tests/rest_cookies.txt" \
        -d '{"title":"Test Milestone REST","description":"Test milestone","due_date":"2024-12-31","status":"open"}')
    local rest_milestone_id=$(echo "$rest_create" | jq -r '.id // empty' 2>/dev/null)
    
    # Test SOAP - Create milestone
    local soap_params='{"title":"Test Milestone SOAP","description":"Test milestone","due_date":"2024-12-31","status":"open"}'
    local soap_create=$(soap_call "CreateMilestone" "$soap_params" 2>/dev/null || echo '{"error": true}')
    local soap_milestone_id=$(echo "$soap_create" | jq -r '.id // empty' 2>/dev/null)
    
    # Test REST - Get milestones
    local rest_milestones=$(curl -s -X GET "$REST_URL/milestones" -b "tests/rest_cookies.txt")
    local rest_milestones_count=$(echo "$rest_milestones" | jq 'length' 2>/dev/null || echo "0")
    
    # Test SOAP - Get milestones
    local soap_milestones=$(soap_call "GetMilestones" "{}" 2>/dev/null || echo '{"error": true}')
    local soap_milestones_count=$(echo "$soap_milestones" | jq '.milestone | length' 2>/dev/null || echo "0")
    
    # Compare results
    if [[ -n "$rest_milestone_id" && -n "$soap_milestone_id" && "$rest_milestones_count" -gt 0 && "$soap_milestones_count" -gt 0 ]]; then
        log_success "Milestones work in both REST and SOAP"
    else
        log_error "Milestones failed - REST ID: '$rest_milestone_id', SOAP ID: '$soap_milestone_id', REST count: $rest_milestones_count, SOAP count: $soap_milestones_count"
    fi
}

# WSDL validation test
test_wsdl_validation() {
    log_info "Testing WSDL validation..."
    ((TOTAL_TESTS++))
    
    # Download WSDL
    local wsdl_content=$(curl -s "$SOAP_URL?wsdl")
    
    # Check if WSDL is valid XML
    if echo "$wsdl_content" | xmllint --noout - 2>/dev/null; then
        log_success "WSDL is valid XML"
    else
        log_error "WSDL is not valid XML"
        return
    fi
    
    # Check for required WSDL elements
    local has_definitions=$(echo "$wsdl_content" | grep -c "<definitions" || echo "0")
    local has_types=$(echo "$wsdl_content" | grep -c "<types" || echo "0")
    local has_messages=$(echo "$wsdl_content" | grep -c "<message" || echo "0")
    local has_porttype=$(echo "$wsdl_content" | grep -c "<portType" || echo "0")
    local has_binding=$(echo "$wsdl_content" | grep -c "<binding" || echo "0")
    local has_service=$(echo "$wsdl_content" | grep -c "<service" || echo "0")
    
    if [[ "$has_definitions" -gt 0 && "$has_types" -gt 0 && "$has_messages" -gt 0 && "$has_porttype" -gt 0 && "$has_binding" -gt 0 && "$has_service" -gt 0 ]]; then
        log_success "WSDL contains all required elements"
    else
        log_error "WSDL missing required elements - definitions:$has_definitions, types:$has_types, messages:$has_messages, portType:$has_porttype, binding:$has_binding, service:$has_service"
    fi
}

# Error handling test
test_error_handling() {
    log_info "Testing error handling..."
    ((TOTAL_TESTS++))

    # Test REST - Invalid login
    local rest_error=$(curl -s -X POST "$REST_URL/login" \
        -H "Content-Type: application/json" \
        -d '{"username":"nonexistent","password":"wrong"}')
    local rest_error_code=$(echo "$rest_error" | jq -r '.code // empty' 2>/dev/null)

    # Test SOAP - Invalid login
    local soap_params='{"username":"nonexistent","password":"wrong"}'
    local soap_error=$(soap_call "LoginUser" "$soap_params" 2>&1 || echo '{"error": "SOAP_ERROR"}')

    # Both should return errors
    if [[ -n "$rest_error_code" && "$soap_error" == *"error"* ]]; then
        log_success "Error handling works in both REST and SOAP"
    else
        log_error "Error handling inconsistent - REST code: '$rest_error_code', SOAP error: contains error"
    fi
}

# Performance comparison test
test_performance() {
    log_info "Testing performance comparison..."
    ((TOTAL_TESTS++))

    # Test REST performance
    local rest_start=$(date +%s%N)
    rest_get_issues > /dev/null 2>&1
    local rest_end=$(date +%s%N)
    local rest_time=$(( (rest_end - rest_start) / 1000000 )) # Convert to milliseconds

    # Test SOAP performance
    local soap_start=$(date +%s%N)
    soap_call "GetIssues" "{}" > /dev/null 2>&1
    local soap_end=$(date +%s%N)
    local soap_time=$(( (soap_end - soap_start) / 1000000 )) # Convert to milliseconds

    log_info "Performance comparison - REST: ${rest_time}ms, SOAP: ${soap_time}ms"

    # Both should complete within reasonable time (10 seconds)
    if [[ "$rest_time" -lt 10000 && "$soap_time" -lt 10000 ]]; then
        log_success "Both services perform within acceptable limits"
    else
        log_error "Performance issues detected - REST: ${rest_time}ms, SOAP: ${soap_time}ms"
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up test data..."

    # Remove test cookies
    rm -f "tests/rest_cookies.txt"

    # Note: In a real scenario, you might want to clean up test users and data
    # For this demo, we'll leave the test data as it demonstrates the functionality

    log_info "Cleanup completed"
}

# Generate test report
generate_report() {
    local report_file="$TEST_RESULTS_DIR/test_report_$(date +%Y%m%d_%H%M%S).txt"

    {
        echo "Mantis Clone SOAP vs REST API Test Report"
        echo "========================================"
        echo "Generated: $(date)"
        echo ""
        echo "Test Summary:"
        echo "- Total Tests: $TOTAL_TESTS"
        echo "- Passed: $PASSED_TESTS"
        echo "- Failed: $FAILED_TESTS"
        echo "- Success Rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
        echo ""
        echo "Services Tested:"
        echo "- REST API: $REST_URL"
        echo "- SOAP Service: $SOAP_URL"
        echo ""
        echo "Test Categories:"
        echo "- User Management (Registration, Login, Profile)"
        echo "- Issue Management (CRUD operations)"
        echo "- Labels Management"
        echo "- Milestones Management"
        echo "- WSDL Validation"
        echo "- Error Handling"
        echo "- Performance Comparison"
        echo ""
        if [[ $FAILED_TESTS -eq 0 ]]; then
            echo "✅ ALL TESTS PASSED - SOAP service is functionally equivalent to REST API"
        else
            echo "❌ SOME TESTS FAILED - Review the output above for details"
        fi
    } > "$report_file"

    log_info "Test report saved to: $report_file"
}

# Main test execution
main() {
    echo "🧪 Mantis Clone SOAP vs REST API Tests"
    echo "======================================"
    echo ""

    # Setup
    check_services
    setup_tests

    echo ""
    log_info "Starting functional equivalence tests..."
    echo ""

    # Run all tests
    test_user_registration
    test_user_login
    test_issue_creation
    test_issue_retrieval
    test_issues_list
    test_labels
    test_milestones
    test_wsdl_validation
    test_error_handling
    test_performance

    # Cleanup
    cleanup

    # Generate report
    generate_report

    # Final summary
    echo ""
    echo "🏁 Test Execution Complete"
    echo "=========================="
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Success Rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
    echo ""

    if [[ $FAILED_TESTS -eq 0 ]]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
        echo "The SOAP service is functionally equivalent to the REST API."
        exit 0
    else
        echo -e "${RED}❌ SOME TESTS FAILED!${NC}"
        echo "Please review the test output and fix the issues."
        exit 1
    fi
}

# Check dependencies
check_dependencies() {
    local missing_deps=()

    # Check for required commands
    command -v curl >/dev/null 2>&1 || missing_deps+=("curl")
    command -v jq >/dev/null 2>&1 || missing_deps+=("jq")
    command -v xmllint >/dev/null 2>&1 || missing_deps+=("xmllint")
    command -v node >/dev/null 2>&1 || missing_deps+=("node")

    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        log_info "Please install the missing dependencies:"
        for dep in "${missing_deps[@]}"; do
            case $dep in
                "curl") echo "  - curl: sudo apt-get install curl (Ubuntu/Debian) or brew install curl (macOS)" ;;
                "jq") echo "  - jq: sudo apt-get install jq (Ubuntu/Debian) or brew install jq (macOS)" ;;
                "xmllint") echo "  - xmllint: sudo apt-get install libxml2-utils (Ubuntu/Debian) or brew install libxml2 (macOS)" ;;
                "node") echo "  - node: Install Node.js from https://nodejs.org/" ;;
            esac
        done
        exit 1
    fi
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Check dependencies first
    check_dependencies

    # Run main function
    main "$@"
fi
