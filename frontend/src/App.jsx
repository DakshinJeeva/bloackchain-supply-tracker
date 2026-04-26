import { useState } from 'react';
import DashboardPage from './pages/DashboardPage.jsx';
import BatchPage from './pages/BatchPage.jsx';
import TransportPage from './pages/TransportPage.jsx';
import TracePage from './pages/TracePage.jsx';
import './index.css';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠', section: 'main' },
  { id: 'batch', label: 'Batch Management', icon: '🏭', section: 'production', badge: 'Org1' },
  { id: 'transport', label: 'Transport', icon: '🚚', section: 'logistics', badge: 'Org2' },
  { id: 'trace', label: 'Full Traceability', icon: '🔍', section: 'consumer', badge: 'Org3' },
];

const SECTIONS = [
  { key: 'main', label: 'Overview' },
  { key: 'production', label: 'Production' },
  { key: 'logistics', label: 'Logistics' },
  { key: 'consumer', label: 'Consumer' },
];

export default function App() {
  const [page, setPage] = useState('dashboard');

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage />;
      case 'batch': return <BatchPage />;
      case 'transport': return <TransportPage />;
      case 'trace': return <TracePage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="app-layout">
      <div className="bg-mesh" />

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">🔗</div>
          <div className="logo-text">Chain<span>Trace</span></div>
          <div className="logo-sub">Supply Chain Tracker</div>
        </div>

        {SECTIONS.map(sec => {
          const items = NAV.filter(n => n.section === sec.key);
          if (!items.length) return null;
          return (
            <div className="sidebar-section" key={sec.key}>
              <div className="sidebar-section-label">{sec.label}</div>
              {items.map(n => (
                <div
                  key={n.id}
                  className={`sidebar-item ${page === n.id ? 'active' : ''}`}
                  onClick={() => setPage(n.id)}
                >
                  <span className="sidebar-item-icon">{n.icon}</span>
                  <span>{n.label}</span>
                  {n.badge && <span className="sidebar-badge">{n.badge}</span>}
                </div>
              ))}
            </div>
          );
        })}

        {/* Footer */}
        <div style={{ marginTop: 'auto', padding: '20px 24px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
          <div style={{ marginBottom: 4 }}>🧱 Hyperledger Fabric</div>
          <div>Channel: <span style={{ color: 'var(--accent-blue)', fontFamily: 'monospace' }}>mychannel</span></div>
          <div>Chaincode: <span style={{ color: 'var(--accent-cyan)', fontFamily: 'monospace' }}>batchcc</span></div>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        {renderPage()}
      </main>
    </div>
  );
}
