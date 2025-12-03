import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWalletStore } from '../stores/wallet';
import { ADDRESSES, VAULT_ABI, TOKEN_ABI, BASE_SEPOLIA } from '../config';

export function Stats() {
  const { provider } = useWalletStore();
  const [stats, setStats] = useState({
    totalDeposits: 0,
    vaultBalance: '0',
    isLoading: true
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const rpcProvider = provider || new ethers.JsonRpcProvider(BASE_SEPOLIA.rpcUrl);
        const vault = new ethers.Contract(ADDRESSES.vault, VAULT_ABI, rpcProvider);
        const token = new ethers.Contract(ADDRESSES.token, TOKEN_ABI, rpcProvider);

        const [noteCount, vaultBal] = await Promise.all([
          vault.getNoteCount(),
          token.balanceOf(ADDRESSES.vault)
        ]);

        setStats({
          totalDeposits: Number(noteCount),
          vaultBalance: ethers.formatEther(vaultBal),
          isLoading: false
        });
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setStats(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [provider]);

  const statItems = [
    {
      label: 'Total Notes',
      value: stats.totalDeposits.toLocaleString(),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      label: 'Vault TVL',
      value: `${parseFloat(stats.vaultBalance).toLocaleString()} NOCTIS`,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      label: 'Privacy Set',
      value: stats.totalDeposits > 0 ? `1:${stats.totalDeposits}` : '-',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    },
    {
      label: 'Network',
      value: 'Base Sepolia',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      )
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statItems.map((stat, i) => (
        <div key={i} className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/60">
              {stat.icon}
            </div>
            <div>
              <div className="text-sm text-white/60">{stat.label}</div>
              <div className="font-semibold">
                {stats.isLoading ? (
                  <div className="w-16 h-5 bg-white/10 rounded animate-pulse" />
                ) : (
                  stat.value
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
