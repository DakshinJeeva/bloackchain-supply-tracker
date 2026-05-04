import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Handles the OAuth callback redirect from the backend.
 * The backend redirects to /auth/callback?token=<jwt>
 * This component picks it up, stores it, and sends to dashboard.
 */
export default function AuthCallback({ onDone }) {
  const { login } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      login(token);
      onDone('/dashboard');
    } else {
      onDone('/login?error=no_token');
    }
  }, [login, onDone]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
        <p style={{ color: 'var(--text-muted)' }}>Completing sign in…</p>
      </div>
    </div>
  );
}
