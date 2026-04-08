#!/bin/bash

# X402 Integration Test Script
# Tests the x402 payment endpoints

set -e

BASE_URL="http://localhost:3001"
API_URL="$BASE_URL/api/x402"

echo "🚀 X402 Integration Test"
echo "========================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "${BLUE}Test 1: Health Check${NC}"
response=$(curl -s "$BASE_URL/health")
if echo "$response" | grep -q "ok"; then
    echo -e "${GREEN}✓ Server is running${NC}"
else
    echo -e "${RED}✗ Server is not responding${NC}"
    exit 1
fi
echo ""

# Test 2: Request Resource (should return 402)
echo -e "${BLUE}Test 2: Request Resource (expect 402)${NC}"
response=$(curl -s -w "\n%{http_code}" "$API_URL/resource/test")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "402" ]; then
    echo -e "${GREEN}✓ Received 402 Payment Required${NC}"
    echo "Payment details:"
    echo "$body" | jq '.'
else
    echo -e "${RED}✗ Expected 402, got $http_code${NC}"
fi
echo ""

# Test 3: Estimate Cost
echo -e "${BLUE}Test 3: Estimate Payment Cost${NC}"
response=$(curl -s "$API_URL/estimate?amount=0.001")
if echo "$response" | grep -q "success"; then
    echo -e "${GREEN}✓ Cost estimation working${NC}"
    echo "$response" | jq '.'
else
    echo -e "${RED}✗ Cost estimation failed${NC}"
    echo "$response"
fi
echo ""

# Test 4: Payment History (requires auth)
echo -e "${BLUE}Test 4: Payment History (expect 401 without auth)${NC}"
response=$(curl -s -w "\n%{http_code}" "$API_URL/history")
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "401" ]; then
    echo -e "${GREEN}✓ Authentication required (as expected)${NC}"
else
    echo -e "${RED}✗ Expected 401, got $http_code${NC}"
fi
echo ""

# Test 5: Process Payment (requires auth)
echo -e "${BLUE}Test 5: Process Payment (expect 401 without auth)${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/pay" \
    -H "Content-Type: application/json" \
    -d '{
        "walletAddress": "GTEST",
        "resourceUrl": "/api/x402/resource/test",
        "amount": 0.001,
        "payTo": "GMERCHANT"
    }')
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "401" ]; then
    echo -e "${GREEN}✓ Authentication required (as expected)${NC}"
else
    echo -e "${RED}✗ Expected 401, got $http_code${NC}"
fi
echo ""

# Summary
echo "========================"
echo -e "${GREEN}✓ X402 Integration Tests Complete${NC}"
echo ""
echo "Next steps:"
echo "1. Configure environment variables in .env"
echo "2. Add authentication token for full testing"
echo "3. Test with real Stellar wallet addresses"
echo "4. Integrate with AI agents"
echo ""
echo "Documentation:"
echo "- Integration Guide: src/docs/X402_INTEGRATION.md"
echo "- Quick Start: X402_QUICK_START.md"
echo "- Examples: src/examples/x402Example.ts"
echo ""
echo "Resources:"
echo "- Stellar x402: https://stellar.org/x402"
echo "- Protocol Spec: https://x402.org"
echo "- Discord: #x402 channel"
