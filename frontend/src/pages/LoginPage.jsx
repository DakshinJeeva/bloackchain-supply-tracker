import { useState, useEffect, useCallback } from 'react';
import { useAuth, API } from '../context/AuthContext';

const ORG_INFO = {
  Org1: {
    label: 'Org 1 — Production',
    icon: '🏭',
    color: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    desc: 'Create & manage batches, add drying, mixing, and product stages.',
    capabilities: ['Create Batch', 'Add Drying', 'Add Mixing', 'Add Product', 'Read Batch'],
  },
  Org2: {
    label: 'Org 2 — Logistics',
    icon: '🚚',
    color: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
    desc: 'Create transports, track cargo in real-time, complete deliveries.',
    capabilities: ['Create Transport', 'Track Cargo', 'Complete Transport', 'Read Transport'],
  },
  Org3: {
    label: 'Org 3 — Consumer',
    icon: '🔍',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    desc: 'Full traceability — see the entire supply chain history for any batch.',
    capabilities: ['Full Batch Traceability'],
  },
};

export default function LoginPage({ onLogin }) {
  const { login } = useAuth();
  const [step, setStep] = useState('login');       // 'login' | 'org' | 'pending'
  const [tempToken, setTempToken] = useState(null);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [googleProfile, setGoogleProfile] = useState(null);
  const [pendingUserId, setPendingUserId] = useState(null);
  const [pendingMeta, setPendingMeta] = useState(null); // { isFirstMember, mspId }

  // Detect if we're back from OAuth on the signup step
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stepParam = params.get('step');
    const t = params.get('t');
    const err = params.get('error');

    if (err) {
      setError('Google sign-in failed. Please try again.');
    }

    if (stepParam === 'org' && t) {
      setTempToken(t);
      setStep('org');
      // Decode the JWT payload (not verifying, just reading)
      try {
        const payload = JSON.parse(atob(t.split('.')[1]));
        setGoogleProfile(payload);
      } catch {
        setGoogleProfile(null);
      }
    }
  }, []);

  const handleGoogleSignIn = () => {
    window.location.href = `${API}/auth/google`;
  };

  const handleRegister = async () => {
    if (!selectedOrg) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, org: selectedOrg }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      if (data.approved) {
        // Already approved (shouldn't happen with new flow, but just in case)
        login(data.token);
        onLogin();
      } else if (data.isFirstMember) {
        // First member of org → must enroll CA cert first
        setPendingUserId(data.userId);
        setPendingMeta({ isFirstMember: true, mspId: data.mspId });
        setStep('pending');
      } else {
        // Subsequent member → wait for admin approval
        setPendingUserId(data.userId);
        setPendingMeta({ isFirstMember: false });
        setStep('pending');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'pending') {
    return (
      <PendingApprovalScreen
        userId={pendingUserId}
        profile={googleProfile}
        org={selectedOrg}
        meta={pendingMeta}
        onApproved={(token) => { login(token); onLogin(); }}
      />
    );
  }

  if (step === 'org') {
    return <OrgSelectionStep
      profile={googleProfile}
      selected={selectedOrg}
      onSelect={setSelectedOrg}
      onConfirm={handleRegister}
      loading={loading}
      error={error}
    />;
  }

  return (
    <div className="auth-page">
      {/* Animated background */}
      <div className="auth-bg">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
        <div className="auth-grid" />
      </div>

      <div className="auth-container">
        {/* Brand */}
        <div className="auth-brand">
          <div className="auth-brand-icon">🔗</div>
          <div className="auth-brand-name">Chain<span>Trace</span></div>
          <div className="auth-brand-sub">Supply Chain on Blockchain</div>
        </div>

        {/* Card */}
        <div className="auth-card">
          <div className="auth-card-header">
            <h1 className="auth-title">Welcome</h1>
            <p className="auth-subtitle">Sign in with your Google account to access the ChainTrace platform. You'll be assigned to an organisation on first sign-in.</p>
          </div>

          {error && (
            <div className="auth-error">
              <span>⚠️</span> {error}
            </div>
          )}

          <button
            id="google-signin-btn"
            className="google-btn"
            onClick={handleGoogleSignIn}
          >
            <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
              <path d="M47.532 24.552c0-1.636-.132-3.225-.388-4.768H24.48v9.02h12.984c-.56 3.017-2.26 5.576-4.816 7.29v6.065h7.794c4.56-4.2 7.09-10.39 7.09-17.607z" fill="#4285F4"/>
              <path d="M24.48 48c6.516 0 11.988-2.163 15.984-5.84l-7.794-6.065c-2.16 1.449-4.92 2.304-8.19 2.304-6.3 0-11.637-4.253-13.545-9.972H2.902v6.26C6.88 42.767 15.12 48 24.48 48z" fill="#34A853"/>
              <path d="M10.935 28.427A14.434 14.434 0 019.418 24c0-1.546.267-3.05.75-4.427v-6.26H2.902A23.978 23.978 0 000 24c0 3.878.93 7.542 2.902 10.687l8.033-6.26z" fill="#FBBC05"/>
              <path d="M24.48 9.557c3.55 0 6.73 1.222 9.237 3.62l6.93-6.93C36.46 2.378 30.996 0 24.48 0 15.12 0 6.88 5.233 2.902 13.313l8.033 6.26c1.908-5.718 7.245-10.016 13.545-10.016z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="auth-divider"><span>Organisations on this platform</span></div>

          {/* Org cards preview */}
          <div className="auth-org-preview">
            {Object.entries(ORG_INFO).map(([key, info]) => (
              <div key={key} className="auth-org-chip" style={{ '--org-color': info.color }}>
                <span className="auth-org-chip-icon">{info.icon}</span>
                <span>{info.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="auth-footer">
          Powered by Hyperledger Fabric · Channel: <code>mychannel</code>
        </p>
      </div>
    </div>
  );
}

// ─── Pending Approval Screen ──────────────────────────────────────────────────
function PendingApprovalScreen({ userId, profile, org, meta, onApproved }) {
  const [dots, setDots] = useState('');
  const [caLoading, setCaLoading] = useState(false);
  const [caError, setCaError] = useState(null);
  const [caSuccess, setCaSuccess] = useState(false);

  const isFirstAdmin = meta?.isFirstMember === true;

  // Poll every 5 seconds (only for regular pending members)
  useEffect(() => {
    if (!userId || isFirstAdmin) return;
    const poll = async () => {
      try {
        const res = await fetch(`${API}/auth/status?userId=${userId}`);
        const data = await res.json();
        if (data.success && data.approved) {
          onApproved(data.token);
        }
      } catch { /* keep polling */ }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [userId, isFirstAdmin, onApproved]);

  // Animated dots
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
    return () => clearInterval(t);
  }, []);

  const handleEnrollCA = async () => {
    setCaLoading(true);
    setCaError(null);
    try {
      // We need a temp token to call the enroll-ca endpoint.
      // Since the admin is 'ca_pending', they need to get a JWT first via a special status check.
      const statusRes = await fetch(`${API}/auth/status?userId=${userId}`);
      const statusData = await statusRes.json();

      // The admin is ca_pending so approved===false, but we can still get a temp token
      // by calling enroll-ca directly with a special unauthenticated path using userId
      const res = await fetch(`${API}/auth/admin/enroll-ca-by-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setCaSuccess(true);
      setTimeout(() => onApproved(data.token), 1200);
    } catch (e) {
      setCaError(e.message);
    } finally {
      setCaLoading(false);
    }
  };

  const orgInfo = ORG_INFO[org] || {};

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
        <div className="auth-grid" />
      </div>

      <div className="auth-container">
        <div className="auth-brand">
          <div className="auth-brand-icon">🔗</div>
          <div className="auth-brand-name">Chain<span>Trace</span></div>
        </div>

        <div className="auth-card" style={{ textAlign: 'center', padding: '40px 32px' }}>
          {/* Icon */}
          <div style={{
            width: 88, height: 88, borderRadius: '50%',
            background: `linear-gradient(135deg, ${orgInfo.color || '#6366f1'}22, ${orgInfo.color || '#6366f1'}44)`,
            border: `2px solid ${orgInfo.color || '#6366f1'}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 40, margin: '0 auto 24px',
            animation: 'pulse 2s ease-in-out infinite',
          }}>
            {isFirstAdmin ? '🏛️' : '🔐'}
          </div>

          {/* ─── FIRST ADMIN: Enroll CA Certificate ─── */}
          {isFirstAdmin ? (<>
            <h1 className="auth-title" style={{ fontSize: 22, marginBottom: 12 }}>
              Initialize Org CA Certificate
            </h1>
            <p className="auth-subtitle" style={{ marginBottom: 20, lineHeight: 1.6 }}>
              You are the <strong style={{ color: orgInfo.color || '#6366f1' }}>first admin</strong> of{' '}
              <strong style={{ color: orgInfo.color || '#6366f1' }}>{orgInfo.label || org}</strong>.<br />
              Before you can log in or approve members, you must enroll the <strong>Fabric CA admin certificate</strong> for your org.
              This certificate is used to sign all future member certificates.
            </p>

            {profile && (
              <div className="auth-user-pill" style={{ justifyContent: 'center', marginBottom: 24 }}>
                <div className="auth-user-pill-avatar">
                  {profile.picture
                    ? <img src={profile.picture} alt={profile.name} referrerPolicy="no-referrer" />
                    : <span>{profile.name?.[0] || '?'}</span>}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{profile.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{profile.email}</div>
                </div>
              </div>
            )}

            {/* Steps */}
            <div style={{
              background: 'rgba(255,255,255,.03)',
              border: '1px solid var(--border)',
              borderRadius: 12, padding: '16px 20px',
              marginBottom: 20, textAlign: 'left',
            }}>
              {[
                { icon: '1️⃣', text: `Enroll CA admin certificate for ${org}` },
                { icon: '2️⃣', text: 'Your account is activated as Org Admin' },
                { icon: '3️⃣', text: 'Use the CA cert to approve new member certificates' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 13, color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{s.icon}</span>
                  <span>{s.text}</span>
                </div>
              ))}
            </div>

            {caError && (
              <div style={{
                background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)',
                borderRadius: 8, padding: '10px 16px', marginBottom: 16,
                fontSize: 13, color: '#ef4444',
              }}>⚠️ {caError}</div>
            )}

            {caSuccess ? (
              <div style={{
                background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.3)',
                borderRadius: 8, padding: '12px 20px', fontSize: 14, color: '#10b981',
              }}>✅ CA certificate enrolled! Logging you in…</div>
            ) : (
              <button
                id="enroll-ca-btn"
                onClick={handleEnrollCA}
                disabled={caLoading}
                style={{
                  width: '100%', padding: '14px 0',
                  border: 'none', borderRadius: 12, cursor: 'pointer',
                  background: caLoading
                    ? 'rgba(99,102,241,.3)'
                    : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff', fontWeight: 700, fontSize: 15,
                  boxShadow: caLoading ? 'none' : '0 4px 20px rgba(99,102,241,.4)',
                  transition: 'all .2s',
                }}
              >
                {caLoading ? '⏳ Enrolling CA Certificate…' : '🔐 Enroll CA Admin Certificate'}
              </button>
            )}
          </>) : (<>
            {/* ─── REGULAR MEMBER: Waiting for admin ─── */}
            <h1 className="auth-title" style={{ fontSize: 22, marginBottom: 12 }}>
              Awaiting Certificate Generation
            </h1>

            <p className="auth-subtitle" style={{ marginBottom: 20, lineHeight: 1.6 }}>
              Your registration for{' '}
              <strong style={{ color: orgInfo.color || '#6366f1' }}>
                {orgInfo.label || org}
              </strong>{' '}
              has been submitted. The org admin will review your request and generate your Fabric certificate.
            </p>

            {profile && (
              <div className="auth-user-pill" style={{ justifyContent: 'center', marginBottom: 24 }}>
                <div className="auth-user-pill-avatar">
                  {profile.picture
                    ? <img src={profile.picture} alt={profile.name} referrerPolicy="no-referrer" />
                    : <span>{profile.name?.[0] || '?'}</span>}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{profile.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{profile.email}</div>
                </div>
              </div>
            )}

            {/* Polling indicator */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: 'rgba(255,255,255,.04)',
              border: '1px solid var(--border)',
              borderRadius: 40, padding: '10px 20px',
              fontSize: 13, color: 'var(--text-muted)',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#f59e0b', boxShadow: '0 0 8px #f59e0b',
                display: 'inline-block',
                animation: 'pulse 1.2s ease-in-out infinite',
              }} />
              Waiting for admin approval{dots}
            </div>

            <div style={{ marginTop: 28, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              This page will automatically redirect once your certificate is issued.<br />
              You can safely close this tab and come back later.
            </div>
          </>)}
        </div>

        <p className="auth-footer">
          Powered by Hyperledger Fabric · Channel: <code>mychannel</code>
        </p>
      </div>
    </div>
  );
}

// ─── Org Selection Step ────────────────────────────────────────────────────────
function OrgSelectionStep({ profile, selected, onSelect, onConfirm, loading, error }) {
  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
        <div className="auth-grid" />
      </div>

      <div className="auth-container auth-container-wide">
        <div className="auth-brand">
          <div className="auth-brand-icon">🔗</div>
          <div className="auth-brand-name">Chain<span>Trace</span></div>
        </div>

        {profile && (
          <div className="auth-user-pill">
            <div className="auth-user-pill-avatar">
              {profile.picture
                ? <img src={profile.picture} alt={profile.name} referrerPolicy="no-referrer" />
                : <span>{profile.name?.[0] || '?'}</span>}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{profile.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{profile.email}</div>
            </div>
          </div>
        )}

        <div className="org-step-header">
          <h1 className="auth-title" style={{ fontSize: 24 }}>Choose your Organisation</h1>
          <p className="auth-subtitle" style={{ marginTop: 8 }}>
            This is permanent — your Gmail will be locked to the selected org. Each org has different access rights on the blockchain.
          </p>
        </div>

        {error && (
          <div className="auth-error" style={{ marginBottom: 20 }}>
            <span>⚠️</span> {error}
          </div>
        )}

        <div className="org-cards-grid">
          {Object.entries(ORG_INFO).map(([key, info]) => (
            <div
              key={key}
              id={`org-card-${key.toLowerCase()}`}
              className={`org-card ${selected === key ? 'org-card-selected' : ''}`}
              style={{ '--org-color': info.color, '--org-gradient': info.gradient }}
              onClick={() => onSelect(key)}
            >
              <div className="org-card-header">
                <div className="org-card-icon">{info.icon}</div>
                <div className="org-card-name">{info.label}</div>
                {selected === key && <div className="org-card-check">✓</div>}
              </div>
              <p className="org-card-desc">{info.desc}</p>
              <div className="org-card-caps">
                {info.capabilities.map(c => (
                  <span key={c} className="org-cap-tag">{c}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          id="confirm-org-btn"
          className="confirm-btn"
          disabled={!selected || loading}
          onClick={onConfirm}
        >
          {loading ? '⏳ Registering…' : selected ? `Join as ${ORG_INFO[selected]?.label}` : 'Select an Organisation'}
        </button>
      </div>
    </div>
  );
}
