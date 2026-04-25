#!/bin/bash

echo "🛑 Stopping Hyperledger Fabric Network..."

cd ~/Projects/blockchain/fabric-samples/test-network

./network.sh down

echo "🧹 Removing unused Docker volumes..."
docker volume prune -f

echo "✅ Network stopped and cleaned!"