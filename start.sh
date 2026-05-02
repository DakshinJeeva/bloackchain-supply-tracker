#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_NET="$SCRIPT_DIR/fabric-samples/test-network"

echo "🚀 Starting Hyperledger Fabric Network..."

cd "$TEST_NET"

echo ""
echo "🧹 Cleaning Fabric network..."

# Stop network (ignore errors)
./network.sh down || true

# 🔥 Remove ONLY Fabric containers
echo "🗑️ Removing Fabric containers..."
docker ps -a --format "{{.ID}} {{.Names}}" | grep -E "peer|orderer|ca_" | awk '{print $1}' | xargs -r docker rm -f

# 🔥 Remove ONLY Fabric volumes (ledger data)
echo "🗑️ Removing Fabric volumes..."
docker volume ls --format "{{.Name}}" | grep fabric_ | xargs -r docker volume rm

echo ""
echo "🐳 Starting fresh network..."

# ✅ Best practice: do everything in one command
./network.sh up createChannel -c mychannel -ca

echo ""
echo "➕ Adding Org3..."
cd "$TEST_NET/addOrg3"
./addOrg3.sh up -c mychannel -ca

echo ""
echo "📦 Deploying chaincode..."
bash "$SCRIPT_DIR/deploycc.sh"

echo ""
echo "✅ Network started successfully!"