#!/bin/bash

set -e

echo "🚀 Starting Transport Test..."

cd ~/Projects/blockchain/fabric-samples/test-network

# =========================
# ORG2 SETUP
# =========================
echo "🔧 Setting Org2 environment..."

export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_ADDRESS=localhost:9051
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
export CORE_PEER_TLS_ENABLED=true

export ORDERER_CA=$PWD/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

# =========================
# CREATE TRANSPORT
# =========================
echo "📦 Creating Transport..."

peer chaincode invoke \
-o localhost:7050 \
--ordererTLSHostnameOverride orderer.example.com \
--tls \
--cafile "$ORDERER_CA" \
-C mychannel \
-n batchcc \
--peerAddresses localhost:7051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
--peerAddresses localhost:9051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt \
--peerAddresses localhost:11051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt \
-c '{"function":"CreateTransport","Args":["TRANS1","[\"BATCH300\"]","2026-04-26T10:00","WarehouseA"]}' \
--waitForEvent

sleep 2

# =========================
# TRACKING LOOP
# =========================
echo "📡 Tracking Cargo..."

peer chaincode invoke \
-o localhost:7050 \
--tls \
--cafile "$ORDERER_CA" \
-C mychannel \
-n batchcc \
--peerAddresses localhost:7051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
--peerAddresses localhost:9051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt \
--peerAddresses localhost:11051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt \
-c '{"function":"TrackCargo","Args":["TRANS1","25C","60kmh","Highway","[\"BATCH300\"]"]}' \
--waitForEvent

sleep 2

peer chaincode invoke \
-o localhost:7050 \
--tls \
--cafile "$ORDERER_CA" \
-C mychannel \
-n batchcc \
--peerAddresses localhost:7051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
--peerAddresses localhost:9051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt \
--peerAddresses localhost:11051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt \
-c '{"function":"TrackCargo","Args":["TRANS1","26C","58kmh","City","[\"BATCH300\"]"]}' \
--waitForEvent

sleep 2

peer chaincode invoke \
-o localhost:7050 \
--tls \
--cafile "$ORDERER_CA" \
-C mychannel \
-n batchcc \
--peerAddresses localhost:7051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
--peerAddresses localhost:9051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt \
--peerAddresses localhost:11051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt \
-c '{"function":"TrackCargo","Args":["TRANS1","24C","62kmh","NearStore","[\"BATCH300\"]"]}' \
--waitForEvent

sleep 2

# =========================
# SWITCH TO ORG3
# =========================
echo "🔍 Switching to Org3 for query..."

export CORE_PEER_LOCALMSPID="Org3MSP"
export CORE_PEER_ADDRESS=localhost:11051
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org3.example.com/users/Admin@org3.example.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt
export CORE_PEER_TLS_ENABLED=true

# =========================
# QUERY RESULT
# =========================
echo "📊 Final Transport Data:"

peer chaincode query \
-C mychannel \
-n batchcc \
-c '{"Args":["ReadTransport","TRANS1"]}'

echo ""
echo "✅ Test Completed Successfully!"