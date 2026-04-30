#!/bin/bash
# Backs up the CA persistent state (keypairs, certs, db) from fabric-samples
# into the ca-persist directory. Run BEFORE network.sh down.
#
# Uses Docker busybox to read root-owned private key files from the bind-mount dirs.

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

backup_org() {
    local src="$1"   # absolute path to source fabric-ca dir
    local dest="$2"  # absolute path in ca-persist

    if [ ! -f "$src/ca-cert.pem" ]; then
        echo "  ⚠️  $src not initialized yet — skipping"
        return
    fi

    mkdir -p "$dest/msp/keystore"

    # Core state files (world-readable, no sudo needed)
    for f in "${CA_FILES[@]}"; do
        if [ -f "$src/$f" ]; then
            cp -f "$src/$f" "$dest/$f"
        fi
    done

    # Private key files are root:root 600 — use Docker busybox to copy them
    # This avoids needing sudo while reliably reading root-owned files.
    docker run --rm \
        -v "$src/msp/keystore:/src_keystore:ro" \
        -v "$dest/msp/keystore:/dest_keystore" \
        busybox sh -c 'cp -f /src_keystore/* /dest_keystore/ && chmod 644 /dest_keystore/*' 2>/dev/null || {
        echo "  ⚠️  Could not copy keystore via Docker — trying sudo..."
        sudo cp -rf "$src/msp/keystore/"* "$dest/msp/keystore/" 2>/dev/null || true
        sudo chmod 644 "$dest/msp/keystore/"* 2>/dev/null || true
    }

    echo "  ✅ Backed up: $src → $dest"
}

echo "📦 Backing up CA state..."
backup_org "$TEST_NET/organizations/fabric-ca/org1"       "$PERSIST_DIR/org1"
backup_org "$TEST_NET/organizations/fabric-ca/org2"       "$PERSIST_DIR/org2"
backup_org "$TEST_NET/organizations/fabric-ca/ordererOrg" "$PERSIST_DIR/orderer"
backup_org "$TEST_NET/addOrg3/fabric-ca/org3"             "$PERSIST_DIR/org3"
echo "✅ CA state backup complete."
