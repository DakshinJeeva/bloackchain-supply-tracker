import { useState } from 'react';
import Alert from '../components/Alert.jsx';
import Spinner from '../components/Spinner.jsx';
import { createBatch, addDrying, addMixing, addProduct } from '../api.js';

const STEPS = [
    { id: 0, label: 'Collection', icon: '🌿' },
    { id: 1, label: 'Drying', icon: '🔥' },
    { id: 2, label: 'Mixing', icon: '🧪' },
    { id: 3, label: 'Product Ready', icon: '📦' },
];

function now() {
    return new Date().toISOString().slice(0, 16);
}

export default function BatchPage() {
    const [step, setStep] = useState(0);
    const [batchId, setBatchId] = useState('');
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState(null);
    const [result, setResult] = useState(null);

    // Step 0 – Create Batch
    const [c0, setC0] = useState({ batchId: '', type: '', location: '', dateTime: now(), photo: '' });
    // Step 1 – Drying
    const [c1, setC1] = useState({ temperature: '', duration: '', dateTime: now() });
    // Step 2 – Mixing
    const [c2, setC2] = useState({ temperature: '', ingredients: '', dateTime: now() });
    // Step 3 – Product
    const [c3, setC3] = useState({ photo: '', dateTime: now() });

    function showAlert(type, message) { setAlert({ type, message }); }

    async function handleStep0() {
        setLoading(true); setAlert(null);
        try {
            const data = await createBatch(c0);
            setBatchId(c0.batchId);
            setResult(data);
            showAlert('success', `Batch "${c0.batchId}" created on the ledger!`);
            setStep(1);
        } catch (e) { showAlert('error', e.message); }
        finally { setLoading(false); }
    }

    async function handleStep1() {
        setLoading(true); setAlert(null);
        try {
            const data = await addDrying(batchId, c1);
            setResult(data);
            showAlert('success', 'Drying step recorded on the ledger!');
            setStep(2);
        } catch (e) { showAlert('error', e.message); }
        finally { setLoading(false); }
    }

    async function handleStep2() {
        setLoading(true); setAlert(null);
        try {
            const data = await addMixing(batchId, c2);
            setResult(data);
            showAlert('success', 'Mixing step recorded on the ledger!');
            setStep(3);
        } catch (e) { showAlert('error', e.message); }
        finally { setLoading(false); }
    }

    async function handleStep3() {
        setLoading(true); setAlert(null);
        try {
            const data = await addProduct(batchId, c3);
            setResult(data);
            showAlert('success', '🎉 Product finalised on the ledger! All production phases complete.');
            setStep(4);
        } catch (e) { showAlert('error', e.message); }
        finally { setLoading(false); }
    }

    function reset() {
        setStep(0); setBatchId(''); setResult(null); setAlert(null);
        setC0({ batchId: '', type: '', location: '', dateTime: now(), photo: '' });
        setC1({ temperature: '', duration: '', dateTime: now() });
        setC2({ temperature: '', ingredients: '', dateTime: now() });
        setC3({ photo: '', dateTime: now() });
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">🏭 <span>Batch Management</span></h1>
                <p className="page-subtitle">Step through the full production pipeline — collection → drying → mixing → product</p>
            </div>

            {/* Stepper */}
            <div className="stepper">
                {STEPS.map((s, i) => (
                    <div key={s.id} style={{ display: 'contents' }}>
                        <div className={`step ${step > i ? 'done' : step === i ? 'active' : 'pending'}`}>
                            <div className="step-circle">
                                {step > i ? '✓' : s.icon}
                            </div>
                            <div className="step-label">{s.label}</div>
                        </div>
                        {i < STEPS.length - 1 && <div key={`line-${s.id}`} className={`step-line ${step > i ? 'done' : ''}`} />}
                    </div>
                ))}
            </div>

            {alert && <Alert {...alert} onClose={() => setAlert(null)} />}

            {/* Step 0 */}
            {step === 0 && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-icon" style={{ background: 'rgba(16,185,129,.15)' }}>🌿</div>
                        <div>
                            <div className="card-title">Step 1 — Collection</div>
                            <div className="card-subtitle">Create a new batch with raw material collection info</div>
                        </div>
                    </div>
                    <div className="form-grid form-grid-2">
                        <div className="form-group">
                            <label>Batch ID *</label>
                            <input className="form-input" placeholder="e.g. BATCH001" value={c0.batchId} onChange={e => setC0(p => ({ ...p, batchId: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>Type / Material *</label>
                            <input className="form-input" placeholder="e.g. Milk, Tea Leaves" value={c0.type} onChange={e => setC0(p => ({ ...p, type: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>Collection Location *</label>
                            <input className="form-input" placeholder="e.g. FarmA, Region B" value={c0.location} onChange={e => setC0(p => ({ ...p, location: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>Date & Time *</label>
                            <input className="form-input" type="datetime-local" value={c0.dateTime} onChange={e => setC0(p => ({ ...p, dateTime: e.target.value }))} />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1/-1' }}>
                            <label>Photo / Reference URL</label>
                            <input className="form-input" placeholder="https://... or leave blank" value={c0.photo} onChange={e => setC0(p => ({ ...p, photo: e.target.value }))} />
                        </div>
                    </div>
                    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn btn-success" onClick={handleStep0} disabled={loading || !c0.batchId || !c0.type || !c0.location}>
                            {loading ? <Spinner /> : '🌿'} Create Batch
                        </button>
                    </div>
                </div>
            )}

            {/* Step 1 */}
            {step === 1 && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-icon" style={{ background: 'rgba(245,158,11,.15)' }}>🔥</div>
                        <div>
                            <div className="card-title">Step 2 — Drying</div>
                            <div className="card-subtitle">Batch: <span className="mono" style={{ color: 'var(--accent-blue)' }}>{batchId}</span></div>
                        </div>
                    </div>
                    <div className="form-grid form-grid-3">
                        <div className="form-group">
                            <label>Temperature *</label>
                            <input className="form-input" placeholder="e.g. 45C" value={c1.temperature} onChange={e => setC1(p => ({ ...p, temperature: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>Duration *</label>
                            <input className="form-input" placeholder="e.g. 2h, 90min" value={c1.duration} onChange={e => setC1(p => ({ ...p, duration: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>Date & Time *</label>
                            <input className="form-input" type="datetime-local" value={c1.dateTime} onChange={e => setC1(p => ({ ...p, dateTime: e.target.value }))} />
                        </div>
                    </div>
                    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setStep(0)}>← Back</button>
                        <button className="btn btn-warning" onClick={handleStep1} disabled={loading || !c1.temperature || !c1.duration}>
                            {loading ? <Spinner /> : '🔥'} Record Drying
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-icon" style={{ background: 'rgba(139,92,246,.15)' }}>🧪</div>
                        <div>
                            <div className="card-title">Step 3 — Mixing</div>
                            <div className="card-subtitle">Batch: <span className="mono" style={{ color: 'var(--accent-blue)' }}>{batchId}</span></div>
                        </div>
                    </div>
                    <div className="form-grid form-grid-3">
                        <div className="form-group">
                            <label>Temperature *</label>
                            <input className="form-input" placeholder="e.g. 60C" value={c2.temperature} onChange={e => setC2(p => ({ ...p, temperature: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>Ingredients *</label>
                            <input className="form-input" placeholder="e.g. Sugar, Salt, Flavor" value={c2.ingredients} onChange={e => setC2(p => ({ ...p, ingredients: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>Date & Time *</label>
                            <input className="form-input" type="datetime-local" value={c2.dateTime} onChange={e => setC2(p => ({ ...p, dateTime: e.target.value }))} />
                        </div>
                    </div>
                    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>← Back</button>
                        <button className="btn btn-purple" onClick={handleStep2} disabled={loading || !c2.temperature || !c2.ingredients}>
                            {loading ? <Spinner /> : '🧪'} Record Mixing
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-icon" style={{ background: 'rgba(59,130,246,.15)' }}>📦</div>
                        <div>
                            <div className="card-title">Step 4 — Product Finalisation</div>
                            <div className="card-subtitle">Batch: <span className="mono" style={{ color: 'var(--accent-blue)' }}>{batchId}</span></div>
                        </div>
                    </div>
                    <div className="form-grid form-grid-2">
                        <div className="form-group">
                            <label>Product Photo / Reference</label>
                            <input className="form-input" placeholder="https://... or leave blank" value={c3.photo} onChange={e => setC3(p => ({ ...p, photo: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>Date & Time *</label>
                            <input className="form-input" type="datetime-local" value={c3.dateTime} onChange={e => setC3(p => ({ ...p, dateTime: e.target.value }))} />
                        </div>
                    </div>
                    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setStep(2)}>← Back</button>
                        <button className="btn btn-primary" onClick={handleStep3} disabled={loading}>
                            {loading ? <Spinner /> : '📦'} Finalise Product
                        </button>
                    </div>
                </div>
            )}

            {/* Completed */}
            {step === 4 && (
                <div>
                    <div className="card" style={{ textAlign: 'center', padding: '48px 28px' }}>
                        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
                        <h2 style={{ fontSize: 24, marginBottom: 8 }}>Production Complete!</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
                            Batch <span className="mono" style={{ color: 'var(--accent-blue)' }}>{batchId}</span> has been fully recorded on the blockchain.
                        </p>
                        <button className="btn btn-primary" onClick={reset}>
                            + Create Another Batch
                        </button>
                    </div>
                    {result && (
                        <div className="card" style={{ marginTop: 20 }}>
                            <div className="card-header" style={{ marginBottom: 16 }}>
                                <div>
                                    <div className="card-title">Ledger Response</div>
                                </div>
                            </div>
                            <pre className="json-viewer">{JSON.stringify(result, null, 2)}</pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
