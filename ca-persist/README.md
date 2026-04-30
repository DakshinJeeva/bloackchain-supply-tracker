# CA Persistent State

This directory stores the Fabric CA keypairs and state so they survive `network.sh down`.

Contents (populated automatically by start.sh / restart.sh):
- org1/   — CA state for Org1
- org2/   — CA state for Org2
- org3/   — CA state for Org3
- orderer/ — CA state for Orderer org

DO NOT delete this directory if you want wallets to remain valid across restarts.
To force a full reset (new CA keys + fresh wallets), delete this directory then run start.sh.
