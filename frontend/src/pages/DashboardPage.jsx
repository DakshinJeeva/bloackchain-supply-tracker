export default function DashboardPage() {
    const features = [
        {
            icon: '🌿',
            color: 'var(--grad-green)',
            title: 'Collection',
            desc: 'Record raw material collection — batch ID, type, location, timestamp.'
        },
        {
            icon: '🔥',
            color: 'var(--grad-orange)',
            title: 'Drying',
            desc: 'Log temperature, duration, and date of the drying process.'
        },
        {
            icon: '🧪',
            color: 'var(--grad-purple)',
            title: 'Mixing',
            desc: 'Record mixing temperature and ingredients used.'
        },
        {
            icon: '📦',
            color: 'var(--grad-blue)',
            title: 'Product Ready',
            desc: 'Finalise the product with a photo reference and timestamp.'
        },
        {
            icon: '🚚',
            color: 'var(--grad-cyan)',
            title: 'Transport',
            desc: 'Create, track and complete cargo shipments with real-time logs.'
        },
        {
            icon: '🔍',
            color: 'linear-gradient(135deg,#c026d3,#e879f9)',
            title: 'Full Traceability',
            desc: 'Consumer-facing view showing the complete audit trail of any batch.'
        },
    ];

    const steps = [
        { org: 'Org1', label: 'Production', color: 'var(--accent-green)', icon: '🏭', steps: ['CreateBatch', 'AddDrying', 'AddMixing', 'AddProduct'] },
        { org: 'Org2', label: 'Transport', color: 'var(--accent-cyan)', icon: '🚚', steps: ['CreateTransport', 'TrackCargo', 'CompleteTransport'] },
        { org: 'Org3', label: 'Consumer', color: 'var(--accent-purple)', icon: '👁️', steps: ['GetFullBatchDetails'] },
    ];

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">🔗 <span>ChainTrace Dashboard</span></h1>
                <p className="page-subtitle">Hyperledger Fabric · Supply Chain Tracker · 3-org network on channel <span className="mono" style={{ color: 'var(--accent-blue)' }}>mychannel</span></p>
            </div>

            {/* Stats row */}
            <div className="stats-row">
                <div className="stat-card blue">
                    <div className="stat-icon">🧱</div>
                    <div className="stat-value">3</div>
                    <div className="stat-label">Organizations</div>
                </div>
                <div className="stat-card cyan">
                    <div className="stat-icon">📋</div>
                    <div className="stat-value">9</div>
                    <div className="stat-label">Chaincode Functions</div>
                </div>
                <div className="stat-card green">
                    <div className="stat-icon">🔗</div>
                    <div className="stat-value">1</div>
                    <div className="stat-label">Channel</div>
                </div>
                <div className="stat-card purple">
                    <div className="stat-icon">🏷️</div>
                    <div className="stat-value">4</div>
                    <div className="stat-label">Production Steps</div>
                </div>
            </div>

            {/* Org flow */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header">
                    <div className="card-icon" style={{ background: 'rgba(59,130,246,.15)' }}>🏛️</div>
                    <div>
                        <div className="card-title">Network Architecture</div>
                        <div className="card-subtitle">How the 3 organizations interact on the blockchain</div>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                    {steps.map((o, i) => (
                        <div key={o.org} style={{
                            background: 'rgba(255,255,255,.03)',
                            border: `1px solid ${o.color}30`,
                            borderRadius: 'var(--radius-md)',
                            padding: 20,
                            position: 'relative',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                                background: `${o.color}`,
                            }} />
                            <div style={{ fontSize: 28, marginBottom: 8 }}>{o.icon}</div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: o.color, marginBottom: 4 }}>{o.org}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{o.label}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {o.steps.map(fn => (
                                    <div key={fn} style={{
                                        background: 'rgba(0,0,0,.3)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 6,
                                        padding: '5px 10px',
                                        fontFamily: 'JetBrains Mono, monospace',
                                        fontSize: 11,
                                        color: 'var(--accent-cyan)',
                                    }}>{fn}()</div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Feature Cards */}
            <div style={{ marginBottom: 8 }}>
                <div className="card-title" style={{ marginBottom: 16, fontSize: 16 }}>🛠️ Features Available</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {features.map(f => (
                        <div key={f.title} className="card" style={{ padding: 22 }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 'var(--radius-sm)',
                                background: f.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 20, marginBottom: 14,
                                boxShadow: '0 4px 14px rgba(0,0,0,.3)'
                            }}>{f.icon}</div>
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>{f.title}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{f.desc}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Getting Started */}
            <div className="card" style={{ marginTop: 24, background: 'linear-gradient(135deg, rgba(59,130,246,.08), rgba(6,182,212,.06))', border: '1px solid rgba(59,130,246,.2)' }}>
                <div className="card-header">
                    <div className="card-icon" style={{ background: 'var(--grad-blue)' }}>🚀</div>
                    <div>
                        <div className="card-title">Getting Started</div>
                        <div className="card-subtitle">Follow these steps to trace a supply chain</div>
                    </div>
                </div>
                <ol style={{ paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                        'Use the Batch Management page to create a new batch (Org1 production role)',
                        'Complete the drying, mixing, and product steps for your batch',
                        'Switch to Transport and create a shipment, then add tracking logs',
                        'Mark the transport as delivered once the cargo arrives',
                        'Use Full Traceability to verify the complete end-to-end supply chain',
                    ].map((s, i) => (
                        <li key={i} style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6 }}>{s}</li>
                    ))}
                </ol>
            </div>
        </div>
    );
}
