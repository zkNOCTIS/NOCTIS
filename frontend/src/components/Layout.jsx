import { useState } from 'react';
import { useWalletStore } from '../stores/wallet';
import { ADDRESSES, ACTIVE_NETWORK } from '../config';

export function Layout({ children, activeView, onViewChange }) {
    const { address, connect, disconnect, isConnecting, ethBalance, tokenBalance } = useWalletStore();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const navItems = [
        {
            id: 'dashboard', label: 'Dashboard', icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
            )
        },
        {
            id: 'deposit', label: 'Deposit', icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
            )
        },
        {
            id: 'withdraw', label: 'Withdraw', icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
            )
        },
    ];

    return (
        <div className="min-h-screen flex bg-noctis-darker">
            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0a0a0f] border-r border-white/10 transform transition-transform duration-200 lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-full flex flex-col">
                    {/* Logo */}
                    <div className="p-6 border-b border-white/10">
                        <img src="/logo.png" alt="NOCTIS" className="h-10 w-auto" />
                    </div>

                    {/* Nav */}
                    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    onViewChange(item.id);
                                    setIsMobileMenuOpen(false);
                                }}
                                className={`w-full ${activeView === item.id ? 'nav-item-active' : 'nav-item-inactive'} nav-item`}
                            >
                                {item.icon}
                                {item.label}
                            </button>
                        ))}

                        <div className="pt-4 mt-4 border-t border-white/10">
                            <h3 className="px-4 text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Contracts</h3>
                            <a
                                href={`${ACTIVE_NETWORK.blockExplorer}/address/${ADDRESSES.vault}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="nav-item text-white/60 hover:text-white hover:bg-white/5"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Vault
                            </a>
                            <a
                                href={`${ACTIVE_NETWORK.blockExplorer}/token/${ADDRESSES.token}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="nav-item text-white/60 hover:text-white hover:bg-white/5"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Token
                            </a>
                        </div>

                        <div className="pt-4 mt-4 border-t border-white/10">
                            <h3 className="px-4 text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Socials</h3>
                            <a
                                href="https://x.com/zkNOCTIS"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="nav-item text-white/60 hover:text-white hover:bg-white/5"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                </svg>
                                Twitter
                            </a>
                            <a
                                href="https://github.com/zkNOCTIS/NOCTIS"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="nav-item text-white/60 hover:text-white hover:bg-white/5"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                                </svg>
                                GitHub
                            </a>
                        </div>
                    </nav>

                    {/* Footer Info */}
                    <div className="p-4 border-t border-white/10 text-xs text-white/40">
                        <p>NOCTIS</p>
                        <p className="mt-1">Privacy for the people</p>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
                {/* Top Bar */}
                <header className="h-16 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-40 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="lg:hidden p-2 text-white/60 hover:text-white"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>

                    <div className="ml-auto flex items-center gap-4">
                        {address && (
                            <div className="hidden sm:flex items-center gap-4 text-sm">
                                <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                                    <span className="text-white/40 mr-2">ETH</span>
                                    <span>{parseFloat(ethBalance).toFixed(4)}</span>
                                </div>
                                <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                                    <span className="text-white/40 mr-2">NOCTIS</span>
                                    <span>{parseFloat(tokenBalance).toFixed(2)}</span>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={address ? disconnect : connect}
                            disabled={isConnecting}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${address
                                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                                : 'bg-noctis-purple text-white hover:opacity-90 shadow-lg shadow-noctis-purple/20'
                                }`}
                        >
                            {isConnecting ? 'Connecting...' : address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connect Wallet'}
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
                    <div className="max-w-6xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}
        </div>
    );
}
