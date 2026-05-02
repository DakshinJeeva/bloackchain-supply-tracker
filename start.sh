#!/bin/bash
# ============================================================
# start.sh — Hyperledger Fabric Network with Persistent CA
# ============================================================
# CA state is stored in named Docker volumes (fabric_ca_org*).
# These are declared external so `network.sh down --volumes`
# never removes them — the CA keypair survives every restart.
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_NET="$SCRIPT_DIR/fabric-samples/test-network"

echo "🚀 Starting Hyperledger Fabric Network..."

# Ensure persistent CA volumes exist (no-op if already created)
bash "$SCRIPT_DIR/setup-volumes.sh"

echo ""
echo "🧹 Tearing down old network..."
cd "$TEST_NET"
./network.sh down || true

echo ""
echo "🐳 Bringing up network (Org1 + Org2 + channel)..."
./network.sh up createChannel -c mychannel -ca

echo ""
echo "➕ Adding Org3..."
cd "$TEST_NET/addOrg3"
./addOrg3.sh up -c mychannel -ca

echo ""
echo "✅ Network started!"
echo "👉 Org1, Org2, Org3 are up on channel 'mychannel'"
echo "🔐 CA keypairs are in persistent Docker volumes — wallets survive restarts."


echo ""
echo "📦 Deploying chaincode..."
"$SCRIPT_DIR/deploycc.sh"

echo ""
echo "🚀 Chaincode deployment completed!"