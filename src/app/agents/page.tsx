'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Edit2, CheckCircle, XCircle, Phone, Mail } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  color_hex: string;
  is_active: boolean;
  store: string;
  created_at: string;
  appointment_count?: number;
}

const COLORS = [
  '#f97316','#7C3AED','#059669','#0891B2','#D97706','#2563EB','#DC2626','#0D9488',
];

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', color_hex: '#f97316', store: 'BCK',
  });

  const fetchAgents = () => {
    setLoading(true);
    fetch('/api/agents')
      .then(r => r.json())
      .then(data => { setAgents(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchAgents(); }, []);

  const openNew = () => {
    setEditAgent(null);
    setForm({ name: '', phone: '', email: '', color_hex: '#f97316', store: 'BCK' });
    setShowForm(true);
  };

  const openEdit = (a: Agent) => {
    setEditAgent(a);
    setForm({ name: a.name, phone: a.phone || '', email: a.email || '', color_hex: a.color_hex, store: a.store });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editAgent) {
        await fetch(`/api/agents/${editAgent.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }
      setShowForm(false);
      fetchAgents();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (a: Agent) => {
    await fetch(`/api/agents/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !a.is_active }),
    });
    fetchAgents();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-[#1a1a2e] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-slate-400 hover:text-white text-sm">← Dashboard</Link>
          <h1 className="text-lg font-bold">Acquisition Agents</h1>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-[#f97316] hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Agent
        </button>
      </div>

      <div className="max-w-3xl mx-auto p-6">
        {loading ? (
          <div className="text-center py-16 text-slate-400">Loading agents…</div>
        ) : agents.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">👤</div>
            <div className="text-slate-600 font-medium mb-1">No agents yet</div>
            <div className="text-slate-400 text-sm mb-4">Add your acquisition team members to get started</div>
            <button onClick={openNew}
              className="bg-[#f97316] hover:bg-orange-600 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
              Add First Agent
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map(agent => (
              <div key={agent.id}
                className={`bg-white rounded-xl border shadow-sm p-4 flex items-center gap-4 ${!agent.is_active ? 'opacity-50' : ''}`}>
                {/* Color dot */}
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: agent.color_hex }}>
                  {agent.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#1a1a2e]">{agent.name}</span>
                    {!agent.is_active && (
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {agent.phone && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Phone className="w-3 h-3" />{agent.phone}
                      </span>
                    )}
                    {agent.email && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Mail className="w-3 h-3" />{agent.email}
                      </span>
                    )}
                    {!agent.phone && !agent.email && (
                      <span className="text-xs text-slate-400">No contact info</span>
                    )}
                  </div>
                </div>

                {/* Today's count */}
                {agent.appointment_count !== undefined && agent.appointment_count > 0 && (
                  <div className="text-center flex-shrink-0">
                    <div className="text-lg font-bold text-[#f97316]">{agent.appointment_count}</div>
                    <div className="text-xs text-slate-400">today</div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => openEdit(agent)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-[#1a1a2e]">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => toggleActive(agent)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    title={agent.is_active ? 'Deactivate' : 'Activate'}>
                    {agent.is_active
                      ? <CheckCircle className="w-4 h-4 text-green-500" />
                      : <XCircle className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-5">
              {editAgent ? 'Edit Agent' : 'Add Acquisition Agent'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#f97316]"
                  value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                  placeholder="e.g. John Smith" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#f97316]"
                    value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))}
                    placeholder="(555) 555-5555" type="tel" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#f97316]"
                    value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))}
                    placeholder="agent@svgmotors.com" type="email" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c} type="button"
                      onClick={() => setForm(p => ({...p, color_hex: c}))}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${form.color_hex === c ? 'border-[#1a1a2e] scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={!form.name.trim() || saving}
                className="flex-1 px-4 py-2 bg-[#f97316] hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                {saving ? 'Saving…' : editAgent ? 'Save Changes' : 'Add Agent'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
