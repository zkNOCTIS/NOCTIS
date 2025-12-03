import { useWalletStore } from '../stores/wallet';

export function ConnectWallet() {
  const { address, isConnecting, connect, disconnect, ethBalance, tokenBalance } = useWalletStore();

  const formatAddress = (addr) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (address) {
    return (
      <div className="flex items-center gap-4">
        <div className="hidden md:flex flex-col items-end text-sm">
          <span className="text-white/60">{parseFloat(ethBalance).toFixed(4)} ETH</span>
          <span className="text-noctis-purple">{parseFloat(tokenBalance).toLocaleString()} NOCTIS</span>
        </div>
        <button
          onClick={disconnect}
          className="btn-secondary flex items-center gap-2"
        >
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          {formatAddress(address)}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={isConnecting}
      className="btn-primary"
    >
      {isConnecting ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Connecting...
        </span>
      ) : (
        'Connect Wallet'
      )}
    </button>
  );
}
