#!/bin/bash
# Creates the named Docker volumes for persistent CA state.
# Run once before the first `start.sh` — volumes survive all subsequent
# `network.sh down` calls because they are declared external.

set -e

VOLUMES=(
    fabric_ca_org1
    fabric_ca_org2
    fabric_ca_orderer
    fabric_ca_org3
)

echo "🗄️  Ensuring persistent CA volumes exist..."
for vol in "${VOLUMES[@]}"; do
    if docker volume inspect "$vol" &>/dev/null; then
        echo "  ✅ $vol (already exists)"
    else
        docker volume create "$vol"
        echo "  ✅ $vol (created)"
    fi
done
echo "Done. CA volumes will survive network restarts."
