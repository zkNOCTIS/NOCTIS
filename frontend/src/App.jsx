import { Toaster } from 'react-hot-toast';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Stats } from './components/Stats';
import { DepositCard } from './components/DepositCard';
import { WithdrawCard } from './components/WithdrawCard';
import { NotesPanel } from './components/NotesPanel';

function App() {
  return (
    <div className="min-h-screen">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
          },
          success: {
            iconTheme: {
              primary: '#8b5cf6',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />

      <Header />

      <main className="pt-16">
        <Hero />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-8">
          <Stats />

          <div className="grid lg:grid-cols-2 gap-6">
            <DepositCard />
            <WithdrawCard />
          </div>

          <NotesPanel />

          {/* How It Works */}
          <div className="card">
            <h2 className="text-xl font-bold mb-6">How It Works</h2>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-noctis-purple/20 flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-noctis-purple">1</span>
                </div>
                <h3 className="font-semibold mb-1">Deposit</h3>
                <p className="text-sm text-white/60">
                  Send NOCTIS tokens to the vault. A private note is created.
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-noctis-purple/20 flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-noctis-purple">2</span>
                </div>
                <h3 className="font-semibold mb-1">Save Note</h3>
                <p className="text-sm text-white/60">
                  Your note is saved locally. Back it up - you'll need it to withdraw.
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-noctis-purple/20 flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-noctis-purple">3</span>
                </div>
                <h3 className="font-semibold mb-1">Generate Proof</h3>
                <p className="text-sm text-white/60">
                  When ready, generate a ZK proof to prove ownership without revealing identity.
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-noctis-purple/20 flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-noctis-purple">4</span>
                </div>
                <h3 className="font-semibold mb-1">Withdraw</h3>
                <p className="text-sm text-white/60">
                  Send tokens to any address. The link to your deposit is broken.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="text-center text-white/40 text-sm py-8 border-t border-white/10">
            <p className="mb-2">NOCTIS Privacy Vault</p>
            <div className="flex items-center justify-center gap-4">
              <span className="hover:text-white/60 transition-colors">
                Built on Base
              </span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
