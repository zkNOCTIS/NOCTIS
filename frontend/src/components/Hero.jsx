export function Hero() {
  return (
    <div className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-noctis-purple/10 via-transparent to-transparent pointer-events-none" />

      {/* Animated orbs */}
      <div className="absolute top-20 left-1/4 w-64 h-64 bg-noctis-purple/20 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute top-40 right-1/4 w-96 h-96 bg-noctis-blue/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />

      <div className="relative max-w-4xl mx-auto text-center py-16 px-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-6">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-sm text-white/60">Live on Base Sepolia</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          <span className="gradient-text">Private Transactions</span>
          <br />
          <span className="text-white">on Base</span>
        </h1>

        <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-8">
          NOCTIS enables private token transfers using zero-knowledge proofs.
          Deposit tokens, generate proofs, and withdraw anonymously.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <a href="#deposit" className="btn-primary">
            Start Using
          </a>
          <a
            href="#notes"
            className="btn-secondary flex items-center gap-2"
          >
            View My Notes
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </a>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mt-16">
          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-noctis-purple/20 flex items-center justify-center mb-4 mx-auto">
              <svg className="w-6 h-6 text-noctis-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2">True Privacy</h3>
            <p className="text-sm text-white/60">
              Zero-knowledge proofs ensure your transactions remain private and untraceable.
            </p>
          </div>

          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-noctis-blue/20 flex items-center justify-center mb-4 mx-auto">
              <svg className="w-6 h-6 text-noctis-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2">Flexible Amounts</h3>
            <p className="text-sm text-white/60">
              Deposit and withdraw any amount. No fixed denominations required.
            </p>
          </div>

          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-noctis-cyan/20 flex items-center justify-center mb-4 mx-auto">
              <svg className="w-6 h-6 text-noctis-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold mb-2">Gas-Free Option</h3>
            <p className="text-sm text-white/60">
              Use the relayer for gas-free withdrawals. Perfect for new wallets.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
