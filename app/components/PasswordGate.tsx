'use client';

import { useState } from 'react';

interface PasswordGateProps {
  onUnlock: (password: string, userName: string) => void;
  savedName?: string;
}

export default function PasswordGate({ onUnlock, savedName }: PasswordGateProps) {
  const [name, setName] = useState(savedName || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!password.trim()) {
      setError('Please enter a password');
      return;
    }
    onUnlock(password, name.trim());
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-700">
      <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🤖 Inside Arc Agent Army
          </h1>
          <p className="text-gray-600">Sign in to access your AI team</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Andy"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 mb-4"
            autoFocus={!savedName}
          />

          <label className="block text-sm font-medium text-gray-700 mb-1">Team password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 mb-4"
            autoFocus={!!savedName}
          />

          {error && (
            <p className="text-red-500 text-sm mb-4">{error}</p>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all"
          >
            Unlock Agent Army
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center mt-6">
          Your name will appear alongside your messages
        </p>
      </div>
    </div>
  );
}
