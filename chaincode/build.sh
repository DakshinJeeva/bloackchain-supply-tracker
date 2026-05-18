#!/bin/bash
#
# Custom build script for Hyperledger Fabric Node.js chaincode.
# The peer runs this instead of the default:
#   cp -R /chaincode/input/src/. /chaincode/output && npm install --production
#
# This avoids lockfile-version incompatibility with older npm versions
# inside fabric-nodeenv Docker images.
#
set -e

echo "🔨 Custom chaincode build script starting..."

# Copy source files to output directory
cp -R /chaincode/input/src/. /chaincode/output

cd /chaincode/output

# Remove existing node_modules and lockfile to avoid version conflicts
rm -rf node_modules
rm -f package-lock.json

echo "📦 Installing dependencies with npm install..."
npm install --production

echo "✅ Chaincode build complete."
