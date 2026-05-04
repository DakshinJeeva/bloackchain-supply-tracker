'use strict';
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const fs = require('fs');

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json());

// ─── Session ───────────────────────────────────────────────────────────────────
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }, // 1 day
}));

// ─── Passport ──────────────────────────────────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());

// ─── User Store (flat JSON file) ───────────────────────────────────────────────
const USERS_PATH = path.join(__dirname, 'users.json');

function readUsers() {
    try {
        return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8')).users || [];
    } catch {
        return [];
    }
}

function writeUsers(users) {
    fs.writeFileSync(USERS_PATH, JSON.stringify({ users }, null, 2));
}

function findUserByGoogleId(googleId) {
    return readUsers().find(u => u.googleId === googleId) || null;
}

function findUserByEmail(email) {
    return readUsers().find(u => u.email === email) || null;
}

function createUser({ googleId, email, name, picture, org }) {
    const users = readUsers();
    const newUser = { id: `user_${Date.now()}`, googleId, email, name, picture, org };
    users.push(newUser);
    writeUsers(users);
    return newUser;
}

function updateUserOrg(userId, org) {
    const users = readUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
        users[idx].org = org;
        writeUsers(users);
        return users[idx];
    }
    return null;
}

// ─── Google OAuth Strategy ────────────────────────────────────────────────────
passport.use(new GoogleStrategy(
    {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/auth/google/callback',
    },
    (_accessToken, _refreshToken, profile, done) => {
        const email = profile.emails?.[0]?.value;
        const picture = profile.photos?.[0]?.value;

        let user = findUserByGoogleId(profile.id);
        if (!user) {
            // New Google user — create without org; they'll pick it on signup page
            user = {
                id: `user_${Date.now()}`,
                googleId: profile.id,
                email,
                name: profile.displayName,
                picture,
                org: null,       // not assigned yet
                isNew: true,
            };
        }
        return done(null, user);
    }
));

passport.serializeUser((user, done) => done(null, user.id || user.googleId));
passport.deserializeUser((id, done) => {
    const users = readUsers();
    const user = users.find(u => u.id === id || u.googleId === id);
    done(null, user || null);
});

// ─── JWT helpers ──────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';

function signToken(user) {
    return jwt.sign({ id: user.id, email: user.email, org: user.org }, JWT_SECRET, { expiresIn: '8h' });
}

function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

// ─── Auth Middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const token = authHeader.split(' ')[1];
    try {
        req.user = verifyToken(token);
        next();
    } catch {
        return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
}

function requireOrg(...allowedOrgs) {
    return [requireAuth, (req, res, next) => {
        if (!allowedOrgs.includes(req.user.org)) {
            return res.status(403).json({
                success: false,
                error: `Access denied. This endpoint requires one of: ${allowedOrgs.join(', ')}. Your org: ${req.user.org}`,
            });
        }
        next();
    }];
}

// ══════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════════════

// Start Google OAuth
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth callback
app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed` }),
    (req, res) => {
        const profile = req.user;
        const existingUser = findUserByGoogleId(profile.googleId);

        if (existingUser && existingUser.org) {
            // Already registered — issue JWT and redirect to dashboard
            const token = signToken(existingUser);
            return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
        }

        // New user or unassigned org — redirect to org selection
        const tempToken = jwt.sign(
            { googleId: profile.googleId, email: profile.email, name: profile.name, picture: profile.picture },
            JWT_SECRET,
            { expiresIn: '15m' }
        );
        return res.redirect(`${process.env.FRONTEND_URL}/signup?step=org&t=${tempToken}`);
    }
);

// Complete registration: assign org
app.post('/auth/register', async (req, res) => {
    try {
        const { tempToken, org } = req.body;
        if (!['Org1', 'Org2', 'Org3'].includes(org)) {
            return res.status(400).json({ success: false, error: 'Invalid org. Must be Org1, Org2, or Org3.' });
        }

        let decoded;
        try {
            decoded = verifyToken(tempToken);
        } catch {
            return res.status(401).json({ success: false, error: 'Temp token expired. Please sign in again.' });
        }

        const { googleId, email, name, picture } = decoded;

        // Prevent duplicate email across orgs
        const existing = findUserByGoogleId(googleId);
        if (existing) {
            if (existing.org) {
                return res.status(409).json({ success: false, error: `Already registered as ${existing.org}.` });
            }
            // Update org for unfinished registration
            existing.org = org;
            const users = readUsers().filter(u => u.googleId !== googleId);
            users.push(existing);
            writeUsers(users);
            const token = signToken(existing);
            return res.json({ success: true, token, user: existing });
        }

        const newUser = createUser({ googleId, email, name, picture, org });
        const token = signToken(newUser);
        res.json({ success: true, token, user: newUser });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Get current user info from JWT
app.get('/auth/me', requireAuth, (req, res) => {
    const users = readUsers();
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, picture: user.picture, org: user.org } });
});

// Logout (client just discards token; this endpoint is informational)
app.post('/auth/logout', (_req, res) => {
    res.json({ success: true });
});

// ─── Org MSP map ──────────────────────────────────────────────────────────────
const CHANNEL_NAME = 'mychannel';
const CHAINCODE_NAME = 'batchcc';

const ORG_TO_MSP = {
    Org1: 'Org1MSP',
    Org2: 'Org2MSP',
    Org3: 'Org3MSP',
};

// ─── Load connection profile ──────────────────────────────────────────────────
function getConnectionProfile(mspId) {
    const orgMap = {
        Org1MSP: 'org1.example.com',
        Org2MSP: 'org2.example.com',
        Org3MSP: 'org3.example.com',
    };
    const orgDomain = orgMap[mspId] || 'org1.example.com';
    const ccpPath = path.resolve(
        __dirname, '..', 'fabric-samples', 'test-network',
        'organizations', 'peerOrganizations', orgDomain,
        `connection-${orgDomain.split('.')[0]}.json`
    );
    return JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
}

async function buildWallet(walletPath) {
    return await Wallets.newFileSystemWallet(walletPath);
}

async function enrollAdmin(mspId) {
    const orgMap = {
        Org1MSP: { ca: 'ca.org1.example.com', user: 'admin', pw: 'adminpw' },
        Org2MSP: { ca: 'ca.org2.example.com', user: 'admin', pw: 'adminpw' },
        Org3MSP: { ca: 'ca.org3.example.com', user: 'admin', pw: 'adminpw' },
    };
    const { ca: caName, user, pw } = orgMap[mspId];
    const ccp = getConnectionProfile(mspId);
    const caInfo = ccp.certificateAuthorities[caName];
    const caClient = new FabricCAServices(caInfo.url, { trustedRoots: caInfo.tlsCACerts.pem, verify: false }, caInfo.caName);

    const walletPath = path.join(__dirname, 'wallet', mspId);
    const wallet = await buildWallet(walletPath);

    if (!await wallet.get(user)) {
        const enrollment = await caClient.enroll({ enrollmentID: user, enrollmentSecret: pw });
        await wallet.put(user, {
            credentials: { certificate: enrollment.certificate, privateKey: enrollment.key.toBytes() },
            mspId,
            type: 'X.509',
        });
        console.log(`✅ Admin enrolled for ${mspId}`);
    }
    return wallet;
}

async function getContract(mspId) {
    const wallet = await enrollAdmin(mspId);
    const ccp = getConnectionProfile(mspId);
    const gateway = new Gateway();
    await gateway.connect(ccp, { wallet, identity: 'admin', discovery: { enabled: true, asLocalhost: true } });
    const network = await gateway.getNetwork(CHANNEL_NAME);
    const contract = network.getContract(CHAINCODE_NAME);
    return { contract, gateway };
}

async function invoke(mspId, fn, args) {
    const { contract, gateway } = await getContract(mspId);
    try {
        const result = await contract.submitTransaction(fn, ...args);
        return result ? JSON.parse(result.toString()) : {};
    } finally {
        gateway.disconnect();
    }
}

async function query(mspId, fn, args) {
    const { contract, gateway } = await getContract(mspId);
    try {
        const result = await contract.evaluateTransaction(fn, ...args);
        return result ? JSON.parse(result.toString()) : {};
    } finally {
        gateway.disconnect();
    }
}

// ══════════════════════════════════════════════════════════════
//  BATCH ROUTES (Org1 only)
// ══════════════════════════════════════════════════════════════

app.post('/batch', requireOrg('Org1'), async (req, res) => {
    try {
        const { batchId, type, location, dateTime, photo } = req.body;
        const result = await invoke('Org1MSP', 'CreateBatch', [batchId, type, location, dateTime, photo || '']);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/batch/:id/drying', requireOrg('Org1'), async (req, res) => {
    try {
        const { temperature, duration, dateTime } = req.body;
        const result = await invoke('Org1MSP', 'AddDrying', [req.params.id, temperature, duration, dateTime]);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/batch/:id/mixing', requireOrg('Org1'), async (req, res) => {
    try {
        const { temperature, ingredients, dateTime } = req.body;
        const result = await invoke('Org1MSP', 'AddMixing', [req.params.id, temperature, ingredients, dateTime]);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/batch/:id/product', requireOrg('Org1'), async (req, res) => {
    try {
        const { photo, dateTime } = req.body;
        const result = await invoke('Org1MSP', 'AddProduct', [req.params.id, photo || '', dateTime]);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/batch/:id', requireOrg('Org1'), async (req, res) => {
    try {
        const result = await query('Org1MSP', 'ReadBatch', [req.params.id]);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ══════════════════════════════════════════════════════════════
//  TRANSPORT ROUTES (Org2 only)
// ══════════════════════════════════════════════════════════════

app.post('/transport', requireOrg('Org2'), async (req, res) => {
    try {
        const { transportId, batchIds, startTime, location } = req.body;
        const result = await invoke('Org2MSP', 'CreateTransport', [transportId, JSON.stringify(batchIds), startTime, location]);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/transport/:id/track', requireOrg('Org2'), async (req, res) => {
    try {
        const { temperature, speed, location, batchIds } = req.body;
        const result = await invoke('Org2MSP', 'TrackCargo', [req.params.id, temperature, speed, location, JSON.stringify(batchIds)]);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/transport/:id/complete', requireOrg('Org2'), async (req, res) => {
    try {
        const { endLocation } = req.body;
        const result = await invoke('Org2MSP', 'CompleteTransport', [req.params.id, endLocation]);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/transport/:id', requireOrg('Org2'), async (req, res) => {
    try {
        const result = await query('Org2MSP', 'ReadTransport', [req.params.id]);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ══════════════════════════════════════════════════════════════
//  CONSUMER ROUTE (Org3 only)
// ══════════════════════════════════════════════════════════════

app.get('/trace/:id', requireOrg('Org3'), async (req, res) => {
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
