#!/bin/bash

echo "🔄 Restarting Hyperledger Fabric Network..."

SCRIPT_DIR=~/Projects/blockchain

# Stop first
bash $SCRIPT_DIR/stop.sh

# Start again
bash $SCRIPT_DIR/start.sh

echo "✅ Restart complete!"