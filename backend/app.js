'use strict';

const express = require('express');
const cors = require('cors');
const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(cors());

const CHANNEL_NAME = 'mychannel';
const CHAINCODE_NAME = 'batchcc';
const MSP_ID = process.env.MSP_ID || 'Org1MSP';

// ─── Load connection profile ──────────────────────────────────────────────────
function getConnectionProfile(org) {
    const orgMap = {
        Org1MSP: 'org1.example.com',
        Org2MSP: 'org2.example.com',
        Org3MSP: 'org3.example.com',
    };
    const orgDomain = orgMap[org] || 'org1.example.com';
    const ccpPath = path.resolve(
        __dirname,
        '..',
        'fabric-samples',
        'test-network',
        'organizations',
        'peerOrganizations',
        orgDomain,
        `connection-${orgDomain.split('.')[0]}.json`
    );
    return JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
}

// ─── Build wallet ──────────────────────────────────────────────────────────────
async function buildWallet(walletPath) {
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    return wallet;
}

// ─── Enroll admin if not exists ────────────────────────────────────────────────
async function enrollAdmin(org) {
    const orgMap = {
        Org1MSP: { ca: 'ca.org1.example.com', user: 'admin', pw: 'adminpw', affiliation: 'org1.department1' },
        Org2MSP: { ca: 'ca.org2.example.com', user: 'admin', pw: 'adminpw', affiliation: 'org2.department1' },
        Org3MSP: { ca: 'ca.org3.example.com', user: 'admin', pw: 'adminpw', affiliation: 'org3.department1' },
    };
    const { ca: caName, user, pw } = orgMap[org];

    const ccp = getConnectionProfile(org);
    const caInfo = ccp.certificateAuthorities[caName];
    const caTLSCACerts = caInfo.tlsCACerts.pem;
    const caClient = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

    const walletPath = path.join(__dirname, 'wallet', org);
    const wallet = await buildWallet(walletPath);

    const identity = await wallet.get(user);
    if (identity) return wallet;

    const enrollment = await caClient.enroll({ enrollmentID: user, enrollmentSecret: pw });
    const x509Identity = {
        credentials: { certificate: enrollment.certificate, privateKey: enrollment.key.toBytes() },
        mspId: org,
        type: 'X.509',
    };
    await wallet.put(user, x509Identity);
    console.log(`✅ Admin enrolled for ${org}`);
    return wallet;
}

// ─── Get contract ──────────────────────────────────────────────────────────────
async function getContract(org) {
    const wallet = await enrollAdmin(org);
    const ccp = getConnectionProfile(org);
    const gateway = new Gateway();
    await gateway.connect(ccp, {
        wallet,
        identity: 'admin',
        discovery: { enabled: true, asLocalhost: true },
    });
    const network = await gateway.getNetwork(CHANNEL_NAME);
    const contract = network.getContract(CHAINCODE_NAME);
    return { contract, gateway };
}

// ─── Helper ────────────────────────────────────────────────────────────────────
async function invoke(org, fn, args) {
    const { contract, gateway } = await getContract(org);
    try {
        const result = await contract.submitTransaction(fn, ...args);
        return result ? JSON.parse(result.toString()) : {};
    } finally {
        gateway.disconnect();
    }
}

async function query(org, fn, args) {
    const { contract, gateway } = await getContract(org);
    try {
        const result = await contract.evaluateTransaction(fn, ...args);
        return result ? JSON.parse(result.toString()) : {};
    } finally {
        gateway.disconnect();
    }
}

// ══════════════════════════════════════════════════════════════
//  BATCH ROUTES (Org1 – Production)
// ══════════════════════════════════════════════════════════════

// POST /batch  — CreateBatch
app.post('/batch', async (req, res) => {
    try {
        const { batchId, type, location, dateTime, photo } = req.body;
        const result = await invoke('Org1MSP', 'CreateBatch', [batchId, type, location, dateTime, photo || '']);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /batch/:id/drying  — AddDrying
app.post('/batch/:id/drying', async (req, res) => {
    try {
        const { temperature, duration, dateTime } = req.body;
        const result = await invoke('Org1MSP', 'AddDrying', [req.params.id, temperature, duration, dateTime]);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /batch/:id/mixing  — AddMixing
app.post('/batch/:id/mixing', async (req, res) => {
    try {
        const { temperature, ingredients, dateTime } = req.body;
        const result = await invoke('Org1MSP', 'AddMixing', [req.params.id, temperature, ingredients, dateTime]);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /batch/:id/product  — AddProduct
app.post('/batch/:id/product', async (req, res) => {
    try {
        const { photo, dateTime } = req.body;
        const result = await invoke('Org1MSP', 'AddProduct', [req.params.id, photo || '', dateTime]);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /batch/:id  — ReadBatch
app.get('/batch/:id', async (req, res) => {
    try {
        const result = await query('Org1MSP', 'ReadBatch', [req.params.id]);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ══════════════════════════════════════════════════════════════
//  TRANSPORT ROUTES (Org2)
// ══════════════════════════════════════════════════════════════

// POST /transport  — CreateTransport
app.post('/transport', async (req, res) => {
    try {
        const { transportId, batchIds, startTime, location } = req.body;
        const result = await invoke('Org2MSP', 'CreateTransport', [
            transportId,
            JSON.stringify(batchIds),
            startTime,
            location,
        ]);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /transport/:id/track  — TrackCargo
app.post('/transport/:id/track', async (req, res) => {
    try {
        const { temperature, speed, location, batchIds } = req.body;
        const result = await invoke('Org2MSP', 'TrackCargo', [
            req.params.id,
            temperature,
            speed,
            location,
            JSON.stringify(batchIds),
        ]);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /transport/:id/complete  — CompleteTransport
app.post('/transport/:id/complete', async (req, res) => {
    try {
        const { endLocation } = req.body;
        const result = await invoke('Org2MSP', 'CompleteTransport', [req.params.id, endLocation]);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /transport/:id  — ReadTransport
app.get('/transport/:id', async (req, res) => {
    try {
        const result = await query('Org2MSP', 'ReadTransport', [req.params.id]);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ══════════════════════════════════════════════════════════════
//  CONSUMER ROUTE (Org3)
// ══════════════════════════════════════════════════════════════

// GET /trace/:id  — GetFullBatchDetails
app.get('/trace/:id', async (req, res) => {
    try {
        const result = await query('Org3MSP', 'GetFullBatchDetails', [req.params.id]);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ─── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Backend running at http://localhost:${PORT}`));
