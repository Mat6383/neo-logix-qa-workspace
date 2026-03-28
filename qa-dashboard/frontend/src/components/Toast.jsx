import React, { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

const Toast = ({ message, type = 'error', onClose, duration = 5000 }) => {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        if (!message) return;
        setVisible(true);
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(onClose, 300); // Wait for transition
        }, duration);

        return () => clearTimeout(timer);
    }, [message, duration, onClose]);

    if (!message) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: type === 'error' ? '#EF4444' : '#10B981',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 9999,
            transition: 'opacity 0.3s ease, transform 0.3s ease',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)'
        }}>
            <AlertCircle size={20} />
            <span style={{ fontWeight: 500 }}>{message}</span>
            <button
                onClick={() => { setVisible(false); setTimeout(onClose, 300); }}
                style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex' }}
            >
                <X size={16} />
            </button>
        </div>
    );
};

export default Toast;
