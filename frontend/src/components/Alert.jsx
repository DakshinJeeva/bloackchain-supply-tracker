import { useState } from 'react';

export default function Alert({ type = 'info', message, onClose }) {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    return (
        <div className={`alert alert-${type}`} style={{ marginBottom: 20 }}>
            <span>{icons[type]}</span>
            <span style={{ flex: 1 }}>{message}</span>
            {onClose && (
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 16 }}>×</button>
            )}
        </div>
    );
}
