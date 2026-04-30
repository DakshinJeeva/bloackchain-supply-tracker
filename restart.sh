#!/bin/bash
# ============================================================
# restart.sh — Restart Hyperledger Fabric Network
# CA keypairs are preserved via ca-persist/ backup/restore.
# Wallet identities remain valid after restart.
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔄 Restarting Hyperledger Fabric Network..."
echo "   (CA keypairs will be preserved — wallets remain valid)"
echo ""

# start.sh handles both the backup (before down) and restore (before up)
bash "$SCRIPT_DIR/start.sh"

echo ""
echo "✅ Restart complete! Wallet identities are still valid."