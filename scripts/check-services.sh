#!/bin/bash
# Check that required services are running before starting dev

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Checking required services..."
errors=0

# Check PostgreSQL
if pg_isready -h localhost -p 5432 -q 2>/dev/null; then
  echo -e "  ${GREEN}✓${NC} PostgreSQL is running"
else
  echo -e "  ${RED}✗${NC} PostgreSQL is NOT running"
  errors=$((errors + 1))
fi

# Check Redis
if redis-cli -h localhost -p 6379 ping 2>/dev/null | grep -q PONG; then
  echo -e "  ${GREEN}✓${NC} Redis is running"
else
  echo -e "  ${YELLOW}!${NC} Redis is not running (optional for dev)"
fi

# Check Meilisearch
if curl -s http://localhost:7700/health 2>/dev/null | grep -q available; then
  echo -e "  ${GREEN}✓${NC} Meilisearch is running"
else
  echo -e "  ${YELLOW}!${NC} Meilisearch is not running (search will be unavailable)"
fi

if [ $errors -gt 0 ]; then
  echo ""
  echo -e "${RED}Required services are not running!${NC}"
  echo -e "Run: ${YELLOW}docker compose up -d${NC}"
  echo ""
  exit 1
fi

echo -e "\n${GREEN}All required services are running.${NC}"
