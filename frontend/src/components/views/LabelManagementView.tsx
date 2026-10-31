import React, { useState, useEffect, useMemo } from 'react';
import { Tag, Plus, Search, Trash2, AlertCircle, CheckCircle, Loader2, BookOpen, Filter } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { api } from '../../services/api';
import { SignClass } from '../../types';

const CATEGORIES = ['General', 'Alphabet', 'Numbers', 'Greetings', 'Emergency', 'Conversational', 'Colors', 'Family', 'Actions'];

export const LabelManagementView: React.FC = () => {
  const [classes, setClasses] = useState<SignClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<SignClass | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', category: 'General', description: '' });
  const [createError, setCreateError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadClasses = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getClasses();
      setClasses(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load labels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadClasses(); }, []);

  const filtered = useMemo(() => {
    return classes.filter(c => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q);
      const matchesCat = !categoryFilter || c.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [classes, searchQuery, categoryFilter]);

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      setCreateError('Label name is required.');
      return;
    }
    if (classes.some(c => c.name.toLowerCase() === createForm.name.trim().toLowerCase())) {
      setCreateError(`Label "${createForm.name}" already exists.`);
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      await api.createClass(createForm.name.trim(), createForm.category, createForm.description.trim());
      setSuccessMsg(`Label "${createForm.name}" created successfully.`);
      setShowCreateModal(false);
      setCreateForm({ name: '', category: 'General', description: '' });
      await loadClasses();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      setCreateError(e.message || 'Failed to create label');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      await api.deleteClass(deleteConfirm.name);
      setSuccessMsg(`Label "${deleteConfirm.name}" deleted.`);
      setDeleteConfirm(null);
      await loadClasses();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      setError(e.message || 'Delete failed');
      setDeleteConfirm(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const sufficiencyThreshold = 10;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-600" />
            Sign Label Management
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your sign vocabulary. Labels define the categories of signs in your dataset.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => { setShowCreateModal(true); setCreateError(null); setCreateForm({ name: '', category: 'General', description: '' }); }}
        >
          New Label
        </Button>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={loadClasses} className="ml-auto underline text-xs">Retry</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search labels..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Labels', value: classes.length, color: 'text-slate-700' },
          { label: 'Ready to Train', value: classes.filter(c => c.sample_count >= sufficiencyThreshold).length, color: 'text-emerald-700' },
          { label: 'Need More Samples', value: classes.filter(c => c.sample_count < sufficiencyThreshold).length, color: 'text-amber-700' },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-xl p-3 text-center">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Labels Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading labels...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <BookOpen className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">
              {classes.length === 0 ? 'No labels created yet.' : 'No labels match your search.'}
            </p>
            {classes.length === 0 && (
              <p className="text-xs mt-1">Add your first sign label to start building your dataset.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-3 pr-4">Label</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-3 pr-4">Category</th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide pb-3 pr-4">Samples</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-3 pr-4">Description</th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(cls => {
                  const isReady = cls.sample_count >= sufficiencyThreshold;
                  return (
                    <tr key={cls.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{cls.name}</span>
                          {isReady && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-semibold">READY</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="slate" size="sm">{cls.category || 'General'}</Badge>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className={`font-mono font-semibold ${isReady ? 'text-emerald-700' : cls.sample_count === 0 ? 'text-slate-400' : 'text-amber-700'}`}>
                          {cls.sample_count}
                        </span>
                        <span className="text-slate-400 text-xs ml-1">
                          {!isReady && cls.sample_count < sufficiencyThreshold && `/ ${sufficiencyThreshold} min`}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-500 max-w-[200px] truncate">
                        {cls.description || <span className="italic text-slate-300">No description</span>}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => setDeleteConfirm(cls)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={`Delete "${cls.name}"`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Label Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Sign Label"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleCreate} disabled={isCreating}>
              {isCreating ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />Creating...</> : 'Create Label'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {createError && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {createError}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Label Name *</label>
            <input
              type="text"
              value={createForm.name}
              onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Hello, Thank You, Water..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
            <select
              value={createForm.category}
              onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Description (optional)</label>
            <textarea
              value={createForm.description}
              onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of this sign..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <p className="text-xs text-slate-400 italic">
            Labels are case-sensitive identifiers that connect samples to your sign vocabulary.
          </p>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Label"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
            >
              {isDeleting ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />Deleting...</> : 'Delete Label'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Are you sure you want to delete the label{' '}
            <span className="font-semibold text-slate-900">"{deleteConfirm?.name}"</span>?
          </p>
          {deleteConfirm && deleteConfirm.sample_count > 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                This label has <strong>{deleteConfirm.sample_count} sample(s)</strong>. The samples will remain in the dataset but will lose their class association. This action cannot be undone.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
