#!/bin/bash

# Complete System Setup Script - Bash Version
# Connects PostgreSQL + OpenFGA with role-based access control

set -e  # Exit on error

echo "========================================="
echo "MCP Resource Manager - Complete Setup"
echo "========================================="
echo ""

# Configuration
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="mcp_resources"
DB_USER="postgres"
DB_PASSWORD="postgres"
OPENFGA_HOST="localhost:8080"
STORE_ID="01KEPX4H744E7RA0WNQDS6DWA7"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

echo_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

echo_error() {
    echo -e "${RED}✗ $1${NC}"
}

echo_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check if Docker is running
echo_info "Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo_error "Docker is not running!"
    echo_info "Please start Docker first"
    exit 1
fi
echo_success "Docker is running"

# Check if PostgreSQL container is running
echo_info "Checking PostgreSQL container..."
if ! docker ps | grep -q mcp-postgres; then
    echo_warning "PostgreSQL container 'mcp-postgres' is not running!"
    echo_info "Attempting to start it..."
    docker-compose up -d postgres
    sleep 3
    if ! docker ps | grep -q mcp-postgres; then
        echo_error "Failed to start PostgreSQL container"
        exit 1
    fi
fi
echo_success "PostgreSQL container is running"

# Check if OpenFGA container is running
echo_info "Checking OpenFGA container..."
if ! docker ps | grep -q mcp-openfga; then
    echo_warning "OpenFGA container 'mcp-openfga' is not running!"
    echo_info "Attempting to start it..."
    docker-compose up -d openfga
    sleep 3
    if ! docker ps | grep -q mcp-openfga; then
        echo_error "Failed to start OpenFGA container"
        exit 1
    fi
fi
echo_success "OpenFGA container is running"

# Test database connection
echo_info "Testing database connection..."
if docker exec mcp-postgres psql -U $DB_USER -d $DB_NAME -c "SELECT 1" > /dev/null 2>&1; then
    echo_success "Database connection successful"
else
    echo_error "Failed to connect to database"
    exit 1
fi

# Check if required tables exist
echo_info "Checking database schema..."
TABLES=$(docker exec mcp-postgres psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
if [ "$TABLES" -gt 0 ]; then
    echo_success "Database schema exists ($TABLES tables)"
else
    echo_warning "Database schema not found. Please run migrations."
fi

# Test OpenFGA connection
echo_info "Testing OpenFGA connection..."
if curl -s http://$OPENFGA_HOST/healthz > /dev/null 2>&1; then
    echo_success "OpenFGA connection successful"
else
    echo_error "Failed to connect to OpenFGA"
    exit 1
fi

echo ""
echo_success "========================================="
echo_success "All systems operational!"
echo_success "========================================="
echo ""
echo_info "Next steps:"
echo "  1. Install dependencies: npm install"
echo "  2. Build the project: npm run build"
echo "  3. Start the server: npm run dev"
echo ""
echo_info "Server will be available at: http://localhost:3002"
echo_info "Default credentials:"
echo "  - Owner: tharsan@example.com / changeme123"
echo "  - Admin: admin@example.com / changeme123"
echo ""
