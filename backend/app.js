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

function createUser({ googleId, email, name, picture, org, certStatus, isAdmin }) {
    const users = readUsers();
    const newUser = {
        id: `user_${Date.now()}`,
        googleId, email, name, picture, org,
        certStatus: certStatus || 'pending',
        isAdmin: isAdmin || false,
        registeredAt: new Date().toISOString(),
    };
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

// ─── Check if there's already an approved admin for an org ────────────────────
function isOrgAdmin(user) {
    return user && user.isAdmin === true && user.certStatus === 'approved';
}

function getOrgAdmins(org) {
    return readUsers().filter(u => u.org === org && u.isAdmin === true && u.certStatus === 'approved');
}

// ─── CA config helper ─────────────────────────────────────────────────────────
const CA_CONFIG = {
    Org1MSP: { caName: 'ca.org1.example.com', domain: 'org1.example.com', adminEnrollId: 'admin', adminEnrollSecret: 'adminpw' },
    Org2MSP: { caName: 'ca.org2.example.com', domain: 'org2.example.com', adminEnrollId: 'admin', adminEnrollSecret: 'adminpw' },
    Org3MSP: { caName: 'ca.org3.example.com', domain: 'org3.example.com', adminEnrollId: 'admin', adminEnrollSecret: 'adminpw' },
};

function buildCAClient(mspId) {
    const { caName, domain } = CA_CONFIG[mspId];
    const ccpPath = path.resolve(
        __dirname, '..', 'fabric-samples', 'test-network',
        'organizations', 'peerOrganizations', domain,
        `connection-${domain.split('.')[0]}.json`
    );
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
    const caInfo = ccp.certificateAuthorities[caName];
    return new FabricCAServices(
        caInfo.url,
        { trustedRoots: caInfo.tlsCACerts.pem, verify: false },
        caInfo.caName
    );
}

async function getWallet(mspId) {
    return Wallets.newFileSystemWallet(path.join(__dirname, 'wallet', mspId));
}

// Step 1: Enroll the Fabric CA admin for an org (must be done before any user certs)
async function enrollOrgAdminCA(mspId) {
    if (!CA_CONFIG[mspId]) throw new Error(`Unknown MSP: ${mspId}`);
    const { adminEnrollId, adminEnrollSecret } = CA_CONFIG[mspId];
    const caClient = buildCAClient(mspId);
    const wallet = await getWallet(mspId);

    if (await wallet.get(adminEnrollId)) {
        console.log(`ℹ️  CA admin already enrolled for ${mspId}`);
        return { alreadyExisted: true };
    }

    const enrollment = await caClient.enroll({
        enrollmentID: adminEnrollId,
        enrollmentSecret: adminEnrollSecret,
    });
    await wallet.put(adminEnrollId, {
        credentials: {
            certificate: enrollment.certificate,
            privateKey: enrollment.key.toBytes(),
        },
        mspId,
        type: 'X.509',
    });
    console.log(`✅ CA admin certificate enrolled for ${mspId}`);
    return { alreadyExisted: false };
}

// Check if admin CA cert exists in the wallet
async function caAdminExists(mspId) {
    try {
        if (!CA_CONFIG[mspId]) return false;
        const { adminEnrollId } = CA_CONFIG[mspId];
        const wallet = await getWallet(mspId);
        return !!(await wallet.get(adminEnrollId));
    } catch {
        return false;
    }
}

// Step 2: Register + enroll a new user using the already-enrolled admin CA cert
async function registerUserWithCA(user) {
    const mspId = ORG_MSP_MAP[user.org];
    if (!mspId) throw new Error(`Unknown org: ${user.org}`);

    // Guard: admin CA cert must be enrolled first
    if (!await caAdminExists(mspId)) {
        throw new Error(
            `Admin CA certificate for ${user.org} has not been enrolled yet. ` +
            `The org admin must enroll the CA certificate before approving members.`
        );
    }

    const { adminEnrollId } = CA_CONFIG[mspId];
    const caClient = buildCAClient(mspId);
    const wallet = await getWallet(mspId);

    // Fabric identity label = sanitized email
    const fabricId = user.email.replace(/[^a-zA-Z0-9_.-]/g, '_');

    if (await wallet.get(fabricId)) {
        console.log(`ℹ️  Identity already exists in wallet: ${fabricId}`);
        return fabricId;
    }

    const adminIdentity = await wallet.get(adminEnrollId);
    const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
    const adminUserCtx = await provider.getUserContext(adminIdentity, adminEnrollId);

    // Register the new identity with the CA (using admin context)
    const secret = await caClient.register(
        { enrollmentID: fabricId, role: 'client' },
        adminUserCtx
    );

    // Enroll (get the signed certificate)
    const enrollment = await caClient.enroll({ enrollmentID: fabricId, enrollmentSecret: secret });
    await wallet.put(fabricId, {
        credentials: { certificate: enrollment.certificate, privateKey: enrollment.key.toBytes() },
        mspId,
        type: 'X.509',
    });

    console.log(`✅ Fabric identity created for ${user.email} in ${mspId} (signed by CA admin)`);
    return fabricId;
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

// Email validation helper — any well-formed email is valid (Google OAuth supports
// institutional domains like @kongu.edu, not just @gmail.com)
function isValidEmail(email) {
    return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function requireCarriedBy(req, res, next) {
    const { carriedBy } = req.body;
    if (!isValidEmail(carriedBy)) {
        return res.status(400).json({
            success: false,
            error: 'carriedBy must be a valid email address (e.g. colleague@example.com)',
        });
    }
    if (carriedBy.toLowerCase() === req.user.email.toLowerCase()) {
        return res.status(400).json({
            success: false,
            error: 'carriedBy must be a different user than the transaction initiator',
        });
    }
    next();
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

// ─── Org → MSP map (needed before registerUserWithCA) ─────────────────────────
const ORG_MSP_MAP = {
    Org1: 'Org1MSP',
    Org2: 'Org2MSP',
    Org3: 'Org3MSP',
};

// Complete registration: assign org and queue for admin approval
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

        // Prevent duplicate
        const existing = findUserByGoogleId(googleId);
        if (existing) {
            if (existing.org) {
                // If already approved, issue token; if pending, just return status
                if (existing.certStatus === 'approved') {
                    const token = signToken(existing);
                    return res.json({ success: true, approved: true, token, user: existing });
                }
                return res.json({ success: true, approved: false, userId: existing.id, message: 'Your registration is pending admin approval.' });
            }
            // Update org for unfinished registration
            existing.org = org;
            existing.certStatus = 'pending';
            const users = readUsers().filter(u => u.googleId !== googleId);
            users.push(existing);
            writeUsers(users);
            return res.json({ success: true, approved: false, userId: existing.id, message: 'Pending admin approval.' });
        }

        // Check if any approved member already exists for this org
        const orgApprovedUsers = readUsers().filter(u => u.org === org && u.certStatus === 'approved');
        const isFirstMember = orgApprovedUsers.length === 0;

        if (isFirstMember) {
            // First member becomes the org admin.
            // They are created with certStatus='ca_pending' — must enroll the
            // Fabric CA admin certificate before they can log in and manage members.
            const newUser = createUser({
                googleId, email, name, picture, org,
                certStatus: 'ca_pending',
                isAdmin: true,
            });
            return res.json({
                success: true,
                approved: false,
                isAdmin: true,
                isFirstMember: true,
                userId: newUser.id,
                mspId: ORG_MSP_MAP[org],
                message: 'You are the first member of this org. Please enroll the CA admin certificate to activate your account.',
            });
        }

        // Subsequent users → pending approval from org admin
        const newUser = createUser({ googleId, email, name, picture, org, certStatus: 'pending', isAdmin: false });
        res.json({ success: true, approved: false, userId: newUser.id, message: 'Your request is pending approval from your org admin.' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Poll registration status (new user polls this until approved)
app.get('/auth/status', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
        const users = readUsers();
        const user = users.find(u => u.id === userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        if (user.certStatus === 'approved') {
            const token = signToken(user);
            return res.json({ success: true, approved: true, token, user });
        }
        res.json({ success: true, approved: false, certStatus: user.certStatus });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Get pending users for admin's org
app.get('/auth/admin/pending', requireAuth, (req, res) => {
    try {
        const admin = readUsers().find(u => u.id === req.user.id);
        if (!admin || !admin.isAdmin) {
            return res.status(403).json({ success: false, error: 'Admin access required.' });
        }
        const pending = readUsers().filter(u => u.org === admin.org && u.certStatus === 'pending');
        res.json({
            success: true, pending: pending.map(u => ({
                id: u.id, name: u.name, email: u.email, picture: u.picture, registeredAt: u.registeredAt
            }))
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// First-admin: enroll CA cert by userId (unauthenticated — admin has no JWT yet at this point)
// Security: only works for users with certStatus='ca_pending' and isAdmin=true
app.post('/auth/admin/enroll-ca-by-id', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ success: false, error: 'userId required.' });

        const users = readUsers();
        const adminIdx = users.findIndex(u => u.id === userId);
        if (adminIdx === -1) return res.status(404).json({ success: false, error: 'User not found.' });

        const admin = users[adminIdx];
        if (!admin.isAdmin) {
            return res.status(403).json({ success: false, error: 'This user is not an org admin.' });
        }
        if (admin.certStatus !== 'ca_pending') {
            // Already enrolled — just issue a token
            if (admin.certStatus === 'approved') {
                const token = signToken(admin);
                return res.json({ success: true, alreadyExisted: true, token, user: admin, message: 'CA already enrolled.' });
            }
            return res.status(409).json({ success: false, error: `Cannot enroll CA: user status is '${admin.certStatus}'.` });
        }

        const mspId = ORG_MSP_MAP[admin.org];
        if (!mspId) return res.status(400).json({ success: false, error: `Unknown org: ${admin.org}` });

        const result = await enrollOrgAdminCA(mspId);

        // Activate admin account
        users[adminIdx].certStatus = 'approved';
        users[adminIdx].caEnrolledAt = new Date().toISOString();
        writeUsers(users);

        const updatedAdmin = readUsers().find(u => u.id === userId);
        const token = signToken(updatedAdmin);

        console.log(`✅ Org admin ${admin.email} enrolled CA cert for ${admin.org} (${mspId})`);
        res.json({
            success: true,
            alreadyExisted: result.alreadyExisted,
            message: `✅ CA admin certificate enrolled for ${admin.org}. Your account is now active.`,
            token,
            user: updatedAdmin,
        });
    } catch (e) {
        console.error('enroll-ca-by-id error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});


// Check CA admin certificate status for admin's org
app.get('/auth/admin/ca-status', requireAuth, async (req, res) => {
    try {
        const admin = readUsers().find(u => u.id === req.user.id);
        if (!admin || !admin.isAdmin) {
            return res.status(403).json({ success: false, error: 'Admin access required.' });
        }
        const mspId = ORG_MSP_MAP[admin.org];
        const exists = await caAdminExists(mspId);
        res.json({ success: true, caEnrolled: exists, mspId, org: admin.org });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Enroll CA admin certificate for admin's org (must be done before approving any users)
app.post('/auth/admin/enroll-ca', requireAuth, async (req, res) => {
    try {
        const users = readUsers();
        const adminIdx = users.findIndex(u => u.id === req.user.id);
        const admin = users[adminIdx];
        if (!admin || !admin.isAdmin) {
            return res.status(403).json({ success: false, error: 'Admin access required.' });
        }

        const mspId = ORG_MSP_MAP[admin.org];
        const result = await enrollOrgAdminCA(mspId);

        // Activate the admin user (they were 'ca_pending' until now)
        if (admin.certStatus === 'ca_pending') {
            users[adminIdx].certStatus = 'approved';
            users[adminIdx].caEnrolledAt = new Date().toISOString();
            writeUsers(users);
        }

        const updatedAdmin = readUsers().find(u => u.id === admin.id);
        const token = signToken(updatedAdmin);
        res.json({
            success: true,
            alreadyExisted: result.alreadyExisted,
            message: result.alreadyExisted
                ? `CA admin certificate was already enrolled for ${admin.org}.`
                : `✅ CA admin certificate successfully enrolled for ${admin.org}. You can now approve member certificates.`,
            token,
            user: updatedAdmin,
        });
    } catch (e) {
        console.error('CA enroll error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Admin approves a user: uses CA admin cert to generate user certificate
app.post('/auth/admin/approve/:userId', requireAuth, async (req, res) => {
    try {
        const admin = readUsers().find(u => u.id === req.user.id);
        if (!admin || !admin.isAdmin) {
            return res.status(403).json({ success: false, error: 'Admin access required.' });
        }

        // Guard: CA admin cert must exist before issuing user certs
        const mspId = ORG_MSP_MAP[admin.org];
        if (!await caAdminExists(mspId)) {
            return res.status(409).json({
                success: false,
                error: `CA admin certificate for ${admin.org} is not enrolled. Please enroll it first from the Admin panel.`,
            });
        }

        const users = readUsers();
        const targetIdx = users.findIndex(u => u.id === req.params.userId);
        if (targetIdx === -1) return res.status(404).json({ success: false, error: 'User not found.' });

        const target = users[targetIdx];
        if (target.org !== admin.org) {
            return res.status(403).json({ success: false, error: 'You can only approve users in your own org.' });
        }
        if (target.certStatus === 'approved') {
            return res.status(409).json({ success: false, error: 'User is already approved.' });
        }

        // Use admin CA cert to register + enroll user in Fabric CA
        const fabricId = await registerUserWithCA(target);

        users[targetIdx].certStatus = 'approved';
        users[targetIdx].fabricId = fabricId;
        users[targetIdx].approvedAt = new Date().toISOString();
        users[targetIdx].approvedBy = admin.email;
        writeUsers(users);

        console.log(`✅ Admin ${admin.email} signed certificate for ${target.email} in ${admin.org}`);
        res.json({ success: true, message: `Certificate generated and user approved.`, user: users[targetIdx] });
    } catch (e) {
        console.error('Approval error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Admin rejects a user
app.post('/auth/admin/reject/:userId', requireAuth, (req, res) => {
    try {
        const admin = readUsers().find(u => u.id === req.user.id);
        if (!admin || !admin.isAdmin) {
            return res.status(403).json({ success: false, error: 'Admin access required.' });
        }
        const users = readUsers();
        const targetIdx = users.findIndex(u => u.id === req.params.userId);
        if (targetIdx === -1) return res.status(404).json({ success: false, error: 'User not found.' });
        if (users[targetIdx].org !== admin.org) {
            return res.status(403).json({ success: false, error: 'You can only manage users in your own org.' });
        }
        users[targetIdx].certStatus = 'rejected';
        users[targetIdx].rejectedAt = new Date().toISOString();
        users[targetIdx].rejectedBy = admin.email;
        writeUsers(users);
        res.json({ success: true, message: 'User rejected.' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Get current user info from JWT
app.get('/auth/me', requireAuth, (req, res) => {
    const users = readUsers();
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, picture: user.picture, org: user.org, isAdmin: user.isAdmin || false, certStatus: user.certStatus || 'approved' } });
});

// Logout (client just discards token; this endpoint is informational)
app.post('/auth/logout', (_req, res) => {
    res.json({ success: true });
});

// ─── Channel & chaincode constants ────────────────────────────────────────────
const CHANNEL_NAME = 'mychannel';
const CHAINCODE_NAME = 'batchcc';

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

app.post('/batch', [...requireOrg('Org1'), requireCarriedBy], async (req, res) => {
    try {
        const { batchId, type, location, dateTime, photo, carriedBy } = req.body;
        const initiatedBy = req.user.email;
        const result = await invoke('Org1MSP', 'CreateBatch', [batchId, type, location, dateTime, photo || '', initiatedBy, carriedBy]);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/batch/:id/drying', [...requireOrg('Org1'), requireCarriedBy], async (req, res) => {
    try {
        const { temperature, duration, dateTime, carriedBy } = req.body;
        const initiatedBy = req.user.email;
        const result = await invoke('Org1MSP', 'AddDrying', [req.params.id, temperature, duration, dateTime, initiatedBy, carriedBy]);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/batch/:id/mixing', [...requireOrg('Org1'), requireCarriedBy], async (req, res) => {
    try {
        const { temperature, ingredients, dateTime, carriedBy } = req.body;
        const initiatedBy = req.user.email;
        const result = await invoke('Org1MSP', 'AddMixing', [req.params.id, temperature, ingredients, dateTime, initiatedBy, carriedBy]);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/batch/:id/product', [...requireOrg('Org1'), requireCarriedBy], async (req, res) => {
    try {
        const { photo, dateTime, carriedBy } = req.body;
        const initiatedBy = req.user.email;
        const result = await invoke('Org1MSP', 'AddProduct', [req.params.id, photo || '', dateTime, initiatedBy, carriedBy]);
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

app.post('/transport', [...requireOrg('Org2'), requireCarriedBy], async (req, res) => {
    try {
        const { transportId, batchIds, startTime, location, carriedBy } = req.body;
        const initiatedBy = req.user.email;
        const result = await invoke('Org2MSP', 'CreateTransport', [transportId, JSON.stringify(batchIds), startTime, location, initiatedBy, carriedBy]);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/transport/:id/track', [...requireOrg('Org2'), requireCarriedBy], async (req, res) => {
    try {
        const { temperature, speed, location, batchIds, carriedBy } = req.body;
        const initiatedBy = req.user.email;
        const result = await invoke('Org2MSP', 'TrackCargo', [req.params.id, temperature, speed, location, JSON.stringify(batchIds), initiatedBy, carriedBy]);
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/transport/:id/complete', [...requireOrg('Org2'), requireCarriedBy], async (req, res) => {
    try {
        const { endLocation, carriedBy } = req.body;
        const initiatedBy = req.user.email;
        const result = await invoke('Org2MSP', 'CompleteTransport', [req.params.id, endLocation, initiatedBy, carriedBy]);
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
