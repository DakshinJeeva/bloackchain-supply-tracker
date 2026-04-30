#!/bin/bash
# Restores CA persistent state from ca-persist back into fabric-samples.
# Called AFTER network.sh down deletes CA files, BEFORE network.sh up starts CAs.
#
# The fabric-ca-server will find the existing ca-cert.pem + keystore and
# reuse the keypair instead of generating a new one.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_NET="$(realpath "$SCRIPT_DIR/../fabric-samples/test-network")"
PERSIST_DIR="$(realpath "$SCRIPT_DIR")"

CA_FILES=(
    "ca-cert.pem"
    "tls-cert.pem"
    "IssuerPublicKey"
    "IssuerRevocationPublicKey"
    "fabric-ca-server.db"
)

restore_org() {
    local src="$1"   # source in ca-persist
    local dest="$2"  # destination fabric-ca dir

    if [ ! -f "$src/ca-cert.pem" ]; then
        echo "  ⏭️  No backup for $(basename "$dest") — skipping (first run)"
        return 1
    fi

    mkdir -p "$dest/msp/keystore"

    # Core state files (world-readable)
    for f in "${CA_FILES[@]}"; do
        [ -f "$src/$f" ] && cp -f "$src/$f" "$dest/$f"
    done

    # Restore private key files via Docker busybox (writes root-owned files back)
    if [ -d "$src/msp/keystore" ] && [ -n "$(ls -A "$src/msp/keystore" 2>/dev/null)" ]; then
        docker run --rm \
            -v "$src/msp/keystore:/src_keystore:ro" \
            -v "$dest/msp/keystore:/dest_keystore" \
            busybox sh -c 'cp -f /src_keystore/* /dest_keystore/ && chmod 600 /dest_keystore/*_sk 2>/dev/null; chmod 644 /dest_keystore/Issuer* 2>/dev/null; true' 2>/dev/null || {
            echo "  ⚠️  Docker keystore restore failed — trying sudo..."
            sudo cp -f "$src/msp/keystore/"* "$dest/msp/keystore/" 2>/dev/null || true
        }
    fi

    echo "  ✅ Restored: $(basename "$src") → $dest"
    return 0
}

has_backup() {
    [ -f "$PERSIST_DIR/org1/ca-cert.pem" ]
}

if ! has_backup; then
    echo "ℹ️  No CA backup found — first run, fresh keys will be generated."
    exit 0
fi

echo "🔐 Restoring persistent CA keypairs..."
restore_org "$PERSIST_DIR/org1"    "$TEST_NET/organizations/fabric-ca/org1"
restore_org "$PERSIST_DIR/org2"    "$TEST_NET/organizations/fabric-ca/org2"
restore_org "$PERSIST_DIR/orderer" "$TEST_NET/organizations/fabric-ca/ordererOrg"
restore_org "$PERSIST_DIR/org3"    "$TEST_NET/addOrg3/fabric-ca/org3" || true

echo "✅ CA state restored. CAs will start with preserved keypairs."
