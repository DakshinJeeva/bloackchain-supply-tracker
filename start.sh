#!/bin/bash
# ============================================================
# start.sh — Hyperledger Fabric Network with Full Persistence
# ============================================================
# Two modes:
#
#   FRESH (first run, ledger volumes empty):
#     → createChannel + addOrg3 + deploycc
#
#   RESUME (ledger volumes have existing data):
#     → Just restart containers — channel, chaincode, and batch
#       data already exist in persistent volumes. No re-join.
#
# CA keypairs:    fabric_ca_org{1,2,3}, fabric_ca_orderer
# Ledger data:    fabric_ledger_peer0_org{1,2,3}, fabric_ledger_orderer
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_NET="$SCRIPT_DIR/fabric-samples/test-network"

# Detect whether mychannel ledger already exists in the peer volume
has_ledger_data() {
    docker run --rm -v fabric_ledger_peer0_org1:/data busybox \
        test -d /data/ledgersData/chains/chains/mychannel 2>/dev/null
}

echo "🚀 Starting Hyperledger Fabric Network..."

# ─── Step 1: Ensure all persistent volumes exist ──────────────────────────────
bash "$SCRIPT_DIR/setup-volumes.sh"

# ─── Step 2: Detect mode BEFORE teardown ──────────────────────────────────────
if has_ledger_data; then
    RESUME_MODE=true
    echo "📚 Existing ledger detected — will RESUME (batch data preserved)."
else
    RESUME_MODE=false
    echo "🆕 No ledger found — will start FRESH."
fi

# ─── Step 3: Tear down running containers (volumes stay intact) ───────────────
echo ""
echo "🧹 Tearing down old containers..."
cd "$TEST_NET"
./network.sh down || true

# ─── Step 4: Start network ────────────────────────────────────────────────────
echo ""
if [ "$RESUME_MODE" = true ]; then
    # RESUME: start peers/orderer only — channel already exists in ledger
    echo "🐳 Resuming network (channel + chaincode already in ledger)..."
    ./network.sh up -ca

    # Start Org3 peer directly (already a channel member — no re-join needed)
    echo "➕ Starting Org3 peer..."
    cd "$TEST_NET/addOrg3"
    DOCKER_SOCK="${DOCKER_SOCK:-/var/run/docker.sock}" \
    docker compose \
        -f compose/compose-org3.yaml \
        -f compose/docker/docker-compose-org3.yaml \
        -f compose/compose-ledger-org3-persist.yaml \
        up -d

    echo ""
    echo "✅ Network resumed!"
    echo "👉 All batch data and channel state restored from persistent volumes."
    echo "👉 Chaincode containers will restart automatically on first transaction."

else
    # FRESH: create channel, add Org3, deploy chaincode
    echo "🐳 Starting fresh network (Org1 + Org2 + channel)..."
    ./network.sh up createChannel -c mychannel -ca

    echo ""
    echo "➕ Adding Org3..."
    cd "$TEST_NET/addOrg3"
    ./addOrg3.sh up -c mychannel -ca

    echo ""
    echo "📦 Deploying chaincode..."
    bash "$SCRIPT_DIR/deploycc.sh"

    echo ""
    echo "✅ Network started fresh!"
    echo "👉 Org1, Org2, Org3 are up on channel 'mychannel'."
fi

echo "🔐 CA keypairs and ledger data are in persistent Docker volumes."