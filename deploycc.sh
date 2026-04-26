#!/bin/bash

set -e

CHANNEL_NAME="mychannel"
CC_NAME="batchcc"
CC_VERSION="1.0"
CC_SEQUENCE="1"
CC_SRC_PATH=../../chaincode
CC_LABEL="batchcc_1.0"

FABRIC_PATH=~/Projects/blockchain/fabric-samples/test-network

cd $FABRIC_PATH

# echo "🚀 Deploying chaincode using network.sh (Org1 & Org2)..."

./network.sh deployCC \
  -ccn $CC_NAME \
  -ccp $CC_SRC_PATH \
  -ccl javascript \
  -ccv $CC_VERSION \
  -ccs $CC_SEQUENCE

echo "➕ Installing on Org3..."

# =========================
# ORG3 ENV
# =========================
export CORE_PEER_LOCALMSPID="Org3MSP"
export CORE_PEER_ADDRESS=localhost:11051
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org3.example.com/users/Admin@org3.example.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt
export CORE_PEER_TLS_ENABLED=true

# =========================
# PACKAGE (again for Org3)
# =========================
peer lifecycle chaincode package ${CC_NAME}.tar.gz \
  --path $CC_SRC_PATH \
  --lang node \
  --label $CC_LABEL

peer lifecycle chaincode install ${CC_NAME}.tar.gz

echo "🔍 Getting Package ID from Org3..."

PACKAGE_ID=$(peer lifecycle chaincode queryinstalled \
--peerAddresses localhost:11051 \
--tlsRootCertFiles $CORE_PEER_TLS_ROOTCERT_FILE \
| grep ${CC_LABEL} | awk '{print $3}' | sed 's/,//')

echo "📦 Package ID: $PACKAGE_ID"

# =========================
# ORDERER CA
# =========================
export ORDERER_CA=$PWD/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

echo "✅ Approving for Org3..."

peer lifecycle chaincode approveformyorg \
-o localhost:7050 \
--ordererTLSHostnameOverride orderer.example.com \
--tls \
--cafile $ORDERER_CA \
--channelID $CHANNEL_NAME \
--name $CC_NAME \
--version $CC_VERSION \
--package-id $PACKAGE_ID \
--sequence $CC_SEQUENCE

echo "🎉 Chaincode deployed on Org1, Org2 (via script) and Org3 (manual extension)"