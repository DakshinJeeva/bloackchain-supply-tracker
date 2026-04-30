#!/bin/bash
# ============================================================
# start.sh — Hyperledger Fabric Network with Persistent CA
# ============================================================
# Strategy:
#   1. Backup current CA state (keypairs, certs, db) to ca-persist/
#   2. Tear down old network (network.sh down deletes CA files)
#   3. Restore saved CA state into bind-mount dirs BEFORE CAs start
#   4. Bring network up — CAs find existing keys and reuse them
#   5. Existing wallet identities remain valid (no re-enrollment needed)
#
# First run: no backup → fresh CA generated → backed up for future use.
# Subsequent runs: CA keypair preserved; wallets stay valid forever.
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_NET="$SCRIPT_DIR/fabric-samples/test-network"
CA_PERSIST="$SCRIPT_DIR/ca-persist"

has_backup() {
    [ -f "$CA_PERSIST/org1/ca-cert.pem" ]
}

echo "🚀 Starting Hyperledger Fabric Network..."

# ─── Step 1: Backup existing CA state ─────────────────────────────────────────
# If a backup already exists we'll use that. If not (first run), the network
# will generate fresh keys and we'll back them up at the end (Step 6).
if has_backup; then
    echo "📦 Existing CA backup found — will restore after teardown."
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^ca_org1$"; then
    echo "📦 Network is running — saving CA state before teardown..."
    bash "$CA_PERSIST/backup.sh"
fi

# ─── Step 2: Tear down old network ────────────────────────────────────────────
echo ""
echo "🧹 Tearing down old network..."
cd "$TEST_NET"
./network.sh down || true
# Note: do NOT run `docker volume prune` — that may affect other Docker projects.

# ─── Step 3: Restore saved CA keypairs BEFORE CAs start ───────────────────────
# fabric-ca-server checks: if ca-cert.pem + msp/keystore/*_sk already exist,
# it reuses the existing keypair instead of generating a new one.
echo ""
bash "$CA_PERSIST/restore.sh"

# ─── Step 4: Bring network up ─────────────────────────────────────────────────
echo ""
echo "🐳 Bringing up network (Org1 + Org2 + channel)..."
cd "$TEST_NET"
./network.sh up createChannel -c mychannel -ca

# ─── Step 5: Add Org3 ─────────────────────────────────────────────────────────
echo ""
echo "➕ Adding Org3..."
cd "$TEST_NET/addOrg3"
./addOrg3.sh up -c mychannel -ca

# ─── Step 6: Backup freshly generated state (first-run only) ──────────────────
if ! has_backup || [ ! -f "$CA_PERSIST/org3/ca-cert.pem" ]; then
    echo ""
    echo "📦 First run — saving generated CA state..."
    bash "$CA_PERSIST/backup.sh"
fi

echo ""
echo "✅ Network started successfully!"
echo "👉 Org1, Org2, Org3 are up on channel 'mychannel'"
if has_backup; then
    echo "🔐 CA keypairs are persistent — wallet identities survive restarts."
fi