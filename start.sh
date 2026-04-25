#!/bin/bash

set -e

echo "🚀 Starting Hyperledger Fabric Network..."

# Go to test-network
cd ~/Projects/blockchain/fabric-samples/test-network

echo "🧹 Cleaning old network..."
./network.sh down || true
docker volume prune -f

echo "🐳 Starting network (Org1 + Org2)..."
./network.sh up createChannel -c mychannel -ca

echo "➕ Adding Org3..."
cd addOrg3
./addOrg3.sh up -c mychannel -ca

echo "✅ Network started successfully!"
echo "👉 Org1, Org2, Org3 are up on channel 'mychannel'"