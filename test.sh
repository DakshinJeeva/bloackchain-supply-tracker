#!/bin/bash

set -e

echo "🚀 Starting FULL Supply Chain Test..."

cd ~/Projects/blockchain/fabric-samples/test-network

# =========================
# COMMON
# =========================
export ORDERER_CA=$PWD/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

# =========================
# ORG1 - PRODUCTION
# =========================
echo "🏭 Org1: Production Phase"

export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_ADDRESS=localhost:7051
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_TLS_ENABLED=true

# ---- Create Batch
echo "📦 Creating Batch..."

peer chaincode invoke \
-o localhost:7050 \
--tls --cafile "$ORDERER_CA" \
-C mychannel -n batchcc \
--peerAddresses localhost:7051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
--peerAddresses localhost:9051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt \
--peerAddresses localhost:11051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt \
-c '{"function":"CreateBatch","Args":["BATCH500","Milk","FarmA","2026-04-26T10:00","photo1"]}' \
--waitForEvent

sleep 2

# ---- Drying
echo "🔥 Drying..."

peer chaincode invoke \
-o localhost:7050 --tls --cafile "$ORDERER_CA" \
-C mychannel -n batchcc \
--peerAddresses localhost:7051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
--peerAddresses localhost:9051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt \
--peerAddresses localhost:11051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt \
-c '{"function":"AddDrying","Args":["BATCH500","45C","2h","2026-04-26T12:00"]}' \
--waitForEvent

sleep 2

# ---- Mixing
echo "🧪 Mixing..."

peer chaincode invoke \
-o localhost:7050 --tls --cafile "$ORDERER_CA" \
-C mychannel -n batchcc \
--peerAddresses localhost:7051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
--peerAddresses localhost:9051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt \
--peerAddresses localhost:11051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt \
-c '{"function":"AddMixing","Args":["BATCH500","60C","Sugar","2026-04-26T14:00"]}' \
--waitForEvent

sleep 2

# ---- Product
echo "🏁 Product Ready..."

peer chaincode invoke \
-o localhost:7050 --tls --cafile "$ORDERER_CA" \
-C mychannel -n batchcc \
--peerAddresses localhost:7051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
--peerAddresses localhost:9051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt \
--peerAddresses localhost:11051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt \
-c '{"function":"AddProduct","Args":["BATCH500","finalPhoto","2026-04-26T16:00"]}' \
--waitForEvent

sleep 2

# =========================
# ORG2 - TRANSPORT
# =========================
echo "🚚 Org2: Transportation Phase"

export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_ADDRESS=localhost:9051
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt

# ---- Create Transport
echo "📦 Creating Transport..."

peer chaincode invoke \
-o localhost:7050 --tls --cafile "$ORDERER_CA" \
-C mychannel -n batchcc \
--peerAddresses localhost:7051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
--peerAddresses localhost:9051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt \
--peerAddresses localhost:11051 \
--tlsRootCertFiles $PWD/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt \
-c '{"function":"CreateTransport","Args":["TRANS500","[\"BATCH500\"]","2026-04-26T18:00","WarehouseA"]}' \
--waitForEvent

sleep 2

# ---- Tracking
echo "📡 Tracking..."

for i in 1 2 3
do
  TEMP=$((24 + $i))
  SPEED=$((55 + $i))

  peer chaincode invoke \
  -o localhost:7050 --tls --cafile "$ORDERER_CA" \
  -C mychannel -n batchcc \
  --peerAddresses localhost:7051 \
  --tlsRootCertFiles $PWD/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
  --peerAddresses localhost:9051 \
  --tlsRootCertFiles $PWD/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt \
  --peerAddresses localhost:11051 \
  --tlsRootCertFiles $PWD/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt \
  -c "{\"function\":\"TrackCargo\",\"Args\":[\"TRANS500\",\"${TEMP}C\",\"${SPEED}kmh\",\"Location$i\",\"[\\\"BATCH500\\\"]\"]}" \
  --waitForEvent

  sleep 2
done

# =========================
# ORG3 - CONSUMER VIEW
# =========================
echo "🔍 Org3: Consumer View"

export CORE_PEER_LOCALMSPID="Org3MSP"
export CORE_PEER_ADDRESS=localhost:11051
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org3.example.com/users/Admin@org3.example.com/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt

echo "📊 FULL TRACEABILITY RESULT:"

peer chaincode query \
-C mychannel \
-n batchcc \
-c '{"Args":["GetFullBatchDetails","BATCH500"]}'

echo ""
echo "🎉 FULL TEST COMPLETED SUCCESSFULLY!"