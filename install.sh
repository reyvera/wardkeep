#!/bin/bash
# ============================================================================
# Wardkeep — Self-Hosted Installation Script
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/reymundovera/wardkeep/main/install.sh | bash
#
# Or manually:
#   bash install.sh
# ============================================================================

set -e

INSTALL_DIR="${WARDKEEP_DIR:-$HOME/wardkeep}"
REPO_URL="https://raw.githubusercontent.com/reymundovera/wardkeep/main"

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║         Wardkeep Installer           ║"
echo "  ║       Guard your ground.             ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "Error: docker is required but not installed."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Error: docker compose (v2) is required."; exit 1; }

# Create install directory
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

echo "Installing to: $INSTALL_DIR"
echo ""

# Download compose file
echo "→ Downloading docker-compose.prod.yml..."
curl -fsSL "$REPO_URL/docker-compose.prod.yml" -o docker-compose.yml

# Generate .env if it doesn't exist
if [ ! -f .env ]; then
  echo "→ Generating .env with secure defaults..."
  GENERATED_KEY=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | od -An -tx1 | tr -d ' \n')
  GENERATED_PG_PASS=$(openssl rand -hex 16 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')

  cat > .env << EOF
# Wardkeep Configuration
# Generated on $(date -u +"%Y-%m-%dT%H:%M:%SZ")

# SECURITY: Change these in production
ENCRYPTION_KEY=$GENERATED_KEY
POSTGRES_PASSWORD=$GENERATED_PG_PASS

# Database
POSTGRES_USER=postgres
POSTGRES_DB=wardkeep

# Ports (change if conflicts)
WEB_PORT=3000
API_PORT=4000
POSTGRES_PORT=5432

# AI Mode: LOCAL (requires Ollama), HYBRID, or CLOUD (requires API key)
AI_PRIVACY_MODE=CLOUD

# Session timeout in minutes
SESSION_TIMEOUT=30
EOF
  echo "  ✓ Generated .env with random ENCRYPTION_KEY and POSTGRES_PASSWORD"
else
  echo "  ✓ .env already exists, keeping existing configuration"
fi

echo ""
echo "→ Pulling images..."
docker compose pull

echo ""
echo "→ Starting Wardkeep..."
docker compose up -d

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  ✓ Wardkeep is running!"
echo ""
echo "  Web UI:      http://localhost:${WEB_PORT:-3000}"
echo "  API Health:  http://localhost:${API_PORT:-4000}/api/health"
echo ""
echo "  Next steps:"
echo "    1. Open the Web UI and create your account"
echo "    2. Go to Settings to configure AI provider"
echo "    3. Add bank connections or create manual accounts"
echo ""
echo "  Commands:"
echo "    Stop:     cd $INSTALL_DIR && docker compose down"
echo "    Start:    cd $INSTALL_DIR && docker compose up -d"
echo "    Update:   cd $INSTALL_DIR && docker compose pull && docker compose up -d"
echo "    Logs:     cd $INSTALL_DIR && docker compose logs -f"
echo "    Backup:   cd $INSTALL_DIR && docker compose exec postgres pg_dump -U postgres wardkeep > backup.sql"
echo ""
echo "  For local AI (requires 8GB+ RAM):"
echo "    docker compose --profile ai up -d"
echo "    docker compose exec ollama ollama pull llama3:8b"
echo "    Then set AI_PRIVACY_MODE=LOCAL in .env and restart"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
