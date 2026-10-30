import React from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';

export default function SmartSessionButton({ onClick, label = 'Start Smart Session', loading = false }) {
  return (
    <button className="btn dashboard-primary-action" onClick={onClick} type="button" disabled={loading}>
      <Sparkles size={15} />
      {loading ? 'Preparing session…' : label}
      <ArrowUpRight size={15} />
    </button>
  );
}