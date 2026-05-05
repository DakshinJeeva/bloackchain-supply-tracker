import { useState } from 'react';
import Alert from '../components/Alert.jsx';
import Spinner from '../components/Spinner.jsx';
import { createTransport, trackCargo, completeTransport, readTransport } from '../api.js';

function now() { return new Date().toISOString().slice(0, 16); }

export default function TransportPage() {
    const [tab, setTab] = useState('create');
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState(null);
    const [result, setResult] = useState(null);

    // Shared "carried by" field — required on every write transaction
    const [carriedBy, setCarriedBy] = useState('');
    const carriedByValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(carriedBy);

    // Create Transport
    const [ct, setCt] = useState({ transportId: '', batchIds: '', startTime: now(), location: '' });
    // Track Cargo
    const [tk, setTk] = useState({ transportId: '', temperature: '', speed: '', location: '', batchIds: '' });
    // Complete
    const [cp, setCp] = useState({ transportId: '', endLocation: '' });
    // Read
    const [rd, setRd] = useState({ transportId: '' });

    function showAlert(type, msg) { setAlert({ type, message: msg }); }

    async function handleCreate() {
        setLoading(true); setAlert(null);
        try {
            const batchIds = ct.batchIds.split(',').map(s => s.trim()).filter(Boolean);
            const data = await createTransport({ ...ct, batchIds, carriedBy });
            setResult(data);
            showAlert('success', `Transport "${ct.transportId}" created!`);
        } catch (e) { showAlert('error', e.message); }
        finally { setLoading(false); }
    }

    async function handleTrack() {
        setLoading(true); setAlert(null);
        try {
            const batchIds = tk.batchIds.split(',').map(s => s.trim()).filter(Boolean);
            const data = await trackCargo(tk.transportId, { ...tk, batchIds, carriedBy });
            setResult(data);
            showAlert('success', 'Tracking log appended to the ledger!');
        } catch (e) { showAlert('error', e.message); }
        finally { setLoading(false); }
    }

    async function handleComplete() {
        setLoading(true); setAlert(null);
        try {
            const data = await completeTransport(cp.transportId, { endLocation: cp.endLocation, carriedBy });
            setResult(data);
            showAlert('success', `Transport "${cp.transportId}" marked as DELIVERED!`);
        } catch (e) { showAlert('error', e.message); }
        finally { setLoading(false); }
    }

    async function handleRead() {
        setLoading(true); setAlert(null);
        try {
            const data = await readTransport(rd.transportId);
            setResult(data);
        } catch (e) { showAlert('error', e.message); }
        finally { setLoading(false); }
    }

    const TABS = [
        { id: 'create', label: '🚚 Create' },
        { id: 'track', label: '📡 Track Cargo' },
        { id: 'complete', label: '✅ Complete' },
        { id: 'read', label: '🔍 Query' },
    ];

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">🚚 <span>Transport Management</span></h1>
                <p className="page-subtitle">Create, track, complete, and query transport shipments (Org2)</p>
            </div>

            {/* Carried By — required for every write transaction */}
            <div className="card" style={{
                marginBottom: 20,
                background: carriedByValid
                    ? 'linear-gradient(135deg, rgba(16,185,129,.06), transparent)'
                    : 'linear-gradient(135deg, rgba(245,158,11,.06), transparent)',
                border: `1px solid ${carriedByValid ? 'rgba(16,185,129,.25)' : 'rgba(245,158,11,.25)'}`,
            }}>
                <div className="card-header" style={{ marginBottom: 12 }}>
                    <div className="card-icon" style={{ background: carriedByValid ? 'rgba(16,185,129,.15)' : 'rgba(245,158,11,.15)', fontSize: 18 }}>
                        {carriedByValid ? '✅' : '📧'}
                    </div>
                    <div>
                        <div className="card-title" style={{ fontSize: 14 }}>Carried By (Transaction Witness)</div>
                        <div className="card-subtitle">
                            Every blockchain write requires a second Gmail to co-sign accountability. Must differ from your own.
                        </div>
                    </div>
                </div>
                <input
                    id="carried-by-input-transport"
                    className="form-input"
                    placeholder="colleague@example.com (any Google account)"
                    type="email"
                    value={carriedBy}
                    onChange={e => setCarriedBy(e.target.value)}
                    style={{ borderColor: carriedByValid ? 'rgba(16,185,129,.4)' : '' }}
                />
            </div>

            <div className="tabs">
                {TABS.map(t => (
                    <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => { setTab(t.id); setResult(null); setAlert(null); }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {alert && <Alert {...alert} onClose={() => setAlert(null)} />}

            {/* Create Transport */}
            {tab === 'create' && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-icon" style={{ background: 'rgba(6,182,212,.15)' }}>🚚</div>
                        <div>
                            <div className="card-title">Create Transport</div>
                            <div className="card-subtitle">Initiate a new shipment for one or more batches</div>
                        </div>
                    </div>
                    <div className="form-grid form-grid-2">
                        <div className="form-group">
                            <label>Transport ID *</label>
                            <input className="form-input" placeholder="e.g. TRANS001" value={ct.transportId} onChange={e => setCt(p => ({ ...p, transportId: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>Batch IDs (comma-separated) *</label>
                            <input className="form-input" placeholder="BATCH001, BATCH002" value={ct.batchIds} onChange={e => setCt(p => ({ ...p, batchIds: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>Start Location *</label>
                            <input className="form-input" placeholder="e.g. WarehouseA, Factory" value={ct.location} onChange={e => setCt(p => ({ ...p, location: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>Start Time *</label>
                            <input className="form-input" type="datetime-local" value={ct.startTime} onChange={e => setCt(p => ({ ...p, startTime: e.target.value }))} />
                        </div>
                    </div>
                    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn btn-cyan" onClick={handleCreate} disabled={loading || !ct.transportId || !ct.batchIds || !ct.location || !carriedByValid}>
                            {loading ? <Spinner /> : '🚚'} Create Transport
                        </button>
                    </div>
                </div>
            )}

            {/* Track Cargo */}
            {tab === 'track' && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-icon" style={{ background: 'rgba(245,158,11,.15)' }}>📡</div>
                        <div>
                            <div className="card-title">Track Cargo</div>
                            <div className="card-subtitle">Append a real-time tracking log to a transport</div>
                        </div>
                    </div>
                    <div className="form-grid form-grid-2">
                        <div className="form-group">
                            <label>Transport ID *</label>
                            <input className="form-input" placeholder="TRANS001" value={tk.transportId} onChange={e => setTk(p => ({ ...p, transportId: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>Batch IDs in this log (comma-sep) *</label>
                            <input className="form-input" placeholder="BATCH001" value={tk.batchIds} onChange={e => setTk(p => ({ ...p, batchIds: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>Temperature *</label>
                            <input className="form-input" placeholder="e.g. 25C" value={tk.temperature} onChange={e => setTk(p => ({ ...p, temperature: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>Speed *</label>
                            <input className="form-input" placeholder="e.g. 60kmh" value={tk.speed} onChange={e => setTk(p => ({ ...p, speed: e.target.value }))} />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1/-1' }}>
                            <label>Current Location *</label>
                            <input className="form-input" placeholder="e.g. Checkpoint A, City B" value={tk.location} onChange={e => setTk(p => ({ ...p, location: e.target.value }))} />
                        </div>
                    </div>
                    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn btn-warning" onClick={handleTrack} disabled={loading || !tk.transportId || !tk.temperature || !tk.speed || !tk.location || !carriedByValid}>
                            {loading ? <Spinner /> : '📡'} Send Tracking Log
                        </button>
                    </div>
                </div>
            )}

            {/* Complete Transport */}
            {tab === 'complete' && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-icon" style={{ background: 'rgba(16,185,129,.15)' }}>✅</div>
                        <div>
                            <div className="card-title">Complete Transport</div>
                            <div className="card-subtitle">Mark a transport as DELIVERED</div>
                        </div>
                    </div>
                    <div className="form-grid form-grid-2">
                        <div className="form-group">
                            <label>Transport ID *</label>
                            <input className="form-input" placeholder="TRANS001" value={cp.transportId} onChange={e => setCp(p => ({ ...p, transportId: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>End / Delivery Location *</label>
                            <input className="form-input" placeholder="e.g. RetailStoreB, Distribution Centre" value={cp.endLocation} onChange={e => setCp(p => ({ ...p, endLocation: e.target.value }))} />
                        </div>
                    </div>
                    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn btn-success" onClick={handleComplete} disabled={loading || !cp.transportId || !cp.endLocation || !carriedByValid}>
                            {loading ? <Spinner /> : '✅'} Mark as Delivered
                        </button>
                    </div>
                </div>
            )}

            {/* Read Transport */}
            {tab === 'read' && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-icon" style={{ background: 'rgba(139,92,246,.15)' }}>🔍</div>
                        <div>
                            <div className="card-title">Query Transport</div>
                            <div className="card-subtitle">Read a transport record from the ledger</div>
                        </div>
                    </div>
                    <div className="form-grid form-grid-2">
                        <div className="form-group">
                            <label>Transport ID *</label>
                            <input className="form-input" placeholder="TRANS001" value={rd.transportId} onChange={e => setRd(p => ({ ...p, transportId: e.target.value }))} />
                        </div>
                    </div>
                    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn btn-primary" onClick={handleRead} disabled={loading || !rd.transportId}>
                            {loading ? <Spinner /> : '🔍'} Query Ledger
                        </button>
                    </div>
                </div>
            )}

            {/* Result */}
            {result && (
                <div className="card" style={{ marginTop: 20 }}>
                    <div className="card-header">
                        <div className="card-icon" style={{ background: 'rgba(59,130,246,.15)' }}>📋</div>
                        <div>
                            <div className="card-title">Ledger Response</div>
                            {result.status && (
                                <div style={{ marginTop: 6 }}>
                                    <span className={`badge ${result.status === 'DELIVERED' ? 'badge-green' : 'badge-orange'}`}>
                                        {result.status === 'DELIVERED' ? '✅' : '🚚'} {result.status}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {tab === 'read' && result.trackingLogs?.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                            <div className="card-title" style={{ marginBottom: 12 }}>📡 Tracking Logs</div>
                            <div className="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Timestamp</th>
                                            <th>Location</th>
                                            <th>Temperature</th>
                                            <th>Speed</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.trackingLogs.map((log, i) => (
                                            <tr key={i}>
                                                <td><span className="badge badge-blue">{i + 1}</span></td>
                                                <td className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{log.timestamp}</td>
                                                <td>📍 {log.location}</td>
                                                <td>🌡️ {log.temperature}</td>
                                                <td>⚡ {log.speed}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <pre className="json-viewer">{JSON.stringify(result, null, 2)}</pre>
                </div>
            )}
        </div>
    );
}
