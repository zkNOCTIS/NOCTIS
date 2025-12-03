import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { useWalletStore } from '../stores/wallet';

function BackupModal({ isOpen, onClose, onExport, onImport }) {
  const [importText, setImportText] = useState('');

  if (!isOpen) return null;

  const handleImport = () => {
    onImport(importText);
    setImportText('');
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        className="bg-[#0a0a0f] border border-white/10 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Backup & Restore</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Export */}
          <div className="p-4 bg-white/5 rounded-xl">
            <h4 className="font-semibold mb-2">Export Backup</h4>
            <p className="text-sm text-white/60 mb-3">
              Download your notes as a JSON file. Keep this safe - it contains your spending keys!
            </p>
            <button onClick={onExport} className="btn-primary w-full">
              Download Backup
            </button>
          </div>

          {/* Import */}
          <div className="p-4 bg-white/5 rounded-xl">
            <h4 className="font-semibold mb-2">Restore from Backup</h4>
            <p className="text-sm text-white/60 mb-3">
              Paste your backup JSON to restore notes.
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='Paste backup JSON here...'
              className="input h-24 mb-3 font-mono text-xs"
            />
            <button
              onClick={handleImport}
              disabled={!importText}
              className="btn-secondary w-full"
            >
              Import Notes
            </button>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm text-yellow-400 font-semibold">Keep your backup secure!</p>
              <p className="text-xs text-yellow-400/70 mt-1">
                Anyone with your backup can spend your private funds. Never share it.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function NotesPanel() {
  const {
    notes,
    getActiveNotes,
    getPrivateBalance,
    exportNotes,
    importNotes,
    removeSpentNotes
  } = useWalletStore();

  const [showBackupModal, setShowBackupModal] = useState(false);

  const activeNotes = getActiveNotes();
  const privateBalance = getPrivateBalance();
  const spentNotes = notes.filter(n => n.spent);

  const handleExport = () => {
    const data = exportNotes();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noctis-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Backup downloaded!');
  };

  const handleImport = (importText) => {
    try {
      const count = importNotes(importText);
      toast.success(`Imported ${count} new notes`);
      setShowBackupModal(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <div id="notes" className="card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-noctis-purple/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-noctis-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold">My Notes</h2>
              <p className="text-sm text-white/60">Your private balance</p>
            </div>
          </div>

          <button
            onClick={() => setShowBackupModal(true)}
            className="btn-secondary text-sm"
          >
            Backup
          </button>
        </div>

        {/* Balance Summary */}
        <div className="p-4 bg-gradient-to-r from-noctis-purple/20 to-noctis-blue/20 rounded-xl mb-6">
          <div className="text-sm text-white/60 mb-1">Private Balance</div>
          <div className="text-3xl font-bold gradient-text">
            {parseFloat(privateBalance).toLocaleString()} NOCTIS
          </div>
          <div className="text-sm text-white/40 mt-1">
            {activeNotes.length} active note{activeNotes.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Active Notes */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white/60">Active Notes</h3>
          {activeNotes.length === 0 ? (
            <div className="p-8 text-center text-white/40 bg-white/5 rounded-xl">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p>No notes yet</p>
              <p className="text-sm mt-1">Deposit tokens to create your first private note</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activeNotes.map((note) => (
                <div
                  key={note.commitment}
                  className="p-4 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white/60">Note #{note.noteIndex}</span>
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Active</span>
                      </div>
                      <div className="text-lg font-semibold mt-1">
                        {parseFloat(ethers.formatEther(note.balance)).toLocaleString()} NOCTIS
                      </div>
                      <div className="text-xs text-white/40 mt-1">
                        Created {formatDate(note.createdAt)}
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify({
                        spendingKey: note.spendingKey.toString(),
                        randomness: note.randomness.toString(),
                        balance: note.balance.toString(),
                        commitment: note.commitment.toString(),
                        noteIndex: note.noteIndex
                      }, null, 2))}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      title="Copy full note (for backup)"
                    >
                      <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Spent Notes */}
        {spentNotes.length > 0 && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white/60">Spent Notes</h3>
              <button
                onClick={() => {
                  removeSpentNotes();
                  toast.success('Spent notes cleared');
                }}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Clear
              </button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {spentNotes.map((note) => (
                <div
                  key={note.commitment}
                  className="p-3 bg-white/5 border border-white/5 rounded-xl opacity-50"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/40">Note #{note.noteIndex}</span>
                    <span className="text-sm line-through text-white/40">
                      {parseFloat(ethers.formatEther(note.balance)).toLocaleString()} NOCTIS
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal rendered via portal to document.body */}
      <BackupModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        onExport={handleExport}
        onImport={handleImport}
      />
    </>
  );
}
