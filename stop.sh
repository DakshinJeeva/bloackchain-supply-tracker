#!/bin/bash
# Stops the network. CA keypairs are safe in persistent Docker volumes
# and will be reused on the next `start.sh` run.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_NET="$SCRIPT_DIR/fabric-samples/test-network"

echo "🛑 Stopping Hyperledger Fabric Network..."
cd "$TEST_NET"
./network.sh down

echo ""
echo "✅ Network stopped."
echo "   CA keypairs are preserved in Docker volumes — run ./start.sh to restart."