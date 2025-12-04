import { useState, useEffect } from 'react';
import { RELAYER_CONFIG } from '../config';

export function SystemStatus() {
    const [status, setStatus] = useState({
        relayer: false,
        prover: true, // Prover is client-side, assumed ready once loaded
        loading: true
    });

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const response = await fetch(`${RELAYER_CONFIG.url}/info`);
                if (response.ok) {
                    const data = await response.json();
                    setStatus(prev => ({ ...prev, relayer: true, loading: false }));
                } else {
                    setStatus(prev => ({ ...prev, relayer: false, loading: false }));
                }
            } catch (error) {
                console.error('Relayer status check failed:', error);
                setStatus(prev => ({ ...prev, relayer: false, loading: false }));
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    const isOperational = status.relayer && status.prover;

    return (
        <div className="card">
            <h3 className="text-lg font-bold mb-2">System Status</h3>

            {status.loading ? (
                <div className="flex items-center gap-2 text-white/60 text-sm animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white/40"></span>
                    Checking systems...
                </div>
            ) : (
                <>
                    <div className={`flex items-center gap-2 text-sm ${isOperational ? 'text-green-400' : 'text-yellow-400'}`}>
                        <span className={`w-2 h-2 rounded-full ${isOperational ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></span>
                        {isOperational ? 'All systems operational' : 'Partial outage'}
                    </div>

                    <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-white/40">ZK Prover</span>
                            <span className="text-green-400">Initialized</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-white/40">Relayer</span>
                            <span className={status.relayer ? 'text-green-400' : 'text-red-400'}>
                                {status.relayer ? 'Connected' : 'Offline'}
                            </span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
