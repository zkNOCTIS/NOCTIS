import { ConnectWallet } from './ConnectWallet';

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-noctis-darker/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-noctis-purple to-noctis-blue flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </div>
            <span className="text-xl font-bold gradient-text">NOCTIS</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#deposit" className="text-white/60 hover:text-white transition-colors">Deposit</a>
            <a href="#withdraw" className="text-white/60 hover:text-white transition-colors">Withdraw</a>
            <a href="#notes" className="text-white/60 hover:text-white transition-colors">My Notes</a>
          </nav>

          <ConnectWallet />
        </div>
      </div>
    </header>
  );
}
