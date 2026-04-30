#!/bin/bash
# ============================================================
# stop.sh — Stop Hyperledger Fabric Network
# Backs up CA keypairs before tearing down so wallets remain valid.
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_NET="$SCRIPT_DIR/fabric-samples/test-network"
CA_PERSIST="$SCRIPT_DIR/ca-persist"

echo "🛑 Stopping Hyperledger Fabric Network..."

# Save CA state BEFORE network.sh down deletes the CA files
echo ""
bash "$CA_PERSIST/backup.sh"

# Tear down the network
echo ""
echo "🧹 Tearing down network..."
cd "$TEST_NET"
./network.sh down

echo ""
echo "✅ Network stopped. CA keypairs saved to ca-persist/"
echo "   Run ./start.sh to restart — wallet identities will remain valid."