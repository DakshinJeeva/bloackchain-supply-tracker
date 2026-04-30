#!/bin/bash
# Creates all named Docker volumes for persistent CA and ledger state.
# Run once before the first `start.sh` — volumes survive all subsequent
# `network.sh down` calls because they are declared external.

set -e

VOLUMES=(
    # CA keypair volumes (survive CA restarts — wallets remain valid)
    fabric_ca_org1
    fabric_ca_org2
    fabric_ca_orderer
    fabric_ca_org3

    # Peer/orderer ledger volumes (survive network restarts — batch data is preserved)
    fabric_ledger_orderer
    fabric_ledger_peer0_org1
    fabric_ledger_peer0_org2
    fabric_ledger_peer0_org3
)

echo "🗄️  Ensuring persistent volumes exist..."
for vol in "${VOLUMES[@]}"; do
    if docker volume inspect "$vol" &>/dev/null; then
        echo "  ✅ $vol (already exists)"
    else
        docker volume create "$vol"
        echo "  ✅ $vol (created)"
    fi
done
echo "Done. All volumes will survive network restarts."
