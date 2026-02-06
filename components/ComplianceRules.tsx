
import React, { useState } from 'react';
import { Plus, X, ShieldCheck, FileText, Pencil, Trash2, Upload } from 'lucide-react';
import { ComplianceRule } from '../types';

interface ComplianceRulesProps {
  rules: ComplianceRule[];
  onCreate: (rule: ComplianceRule) => void;
  onUpdate: (rule: ComplianceRule) => void;
  onDelete: (ruleId: string) => void;
}

interface ModalState {
  open: boolean;
  editingRule: ComplianceRule | null;
}

interface DeleteConfirm {
  ruleId: string;
  ruleName: string;
}

export const ComplianceRules: React.FC<ComplianceRulesProps> = ({ rules, onCreate, onUpdate, onDelete }) => {
  const [modal, setModal] = useState<ModalState>({ open: false, editingRule: null });
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ruleText, setRuleText] = useState('');
  const [sourceFileName, setSourceFileName] = useState<string | undefined>(undefined);

  const openCreate = () => {
    setName('');
    setDescription('');
    setRuleText('');
    setSourceFileName(undefined);
    setModal({ open: true, editingRule: null });
  };

  const openEdit = (rule: ComplianceRule) => {
    setName(rule.name);
    setDescription(rule.description);
    setRuleText(rule.ruleText);
    setSourceFileName(rule.sourceFileName);
    setModal({ open: true, editingRule: rule });
  };

  const closeModal = () => {
    setModal({ open: false, editingRule: null });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRuleText(text);
      setSourceFileName(file.name);
    };
    reader.readAsText(file);
    // Reset input so same file can be re-uploaded
    e.target.value = '';
  };

  const handleSave = () => {
    if (!name.trim() || !ruleText.trim()) return;

    const now = new Date().toISOString();

    if (modal.editingRule) {
      onUpdate({
        ...modal.editingRule,
        name: name.trim(),
        description: description.trim(),
        ruleText: ruleText.trim(),
        sourceFileName,
        updatedAt: now,
      });
    } else {
      onCreate({
        id: `rule-${Date.now()}`,
        name: name.trim(),
        description: description.trim(),
        ruleText: ruleText.trim(),
        sourceFileName,
        createdAt: now,
        updatedAt: now,
      });
    }
    closeModal();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Compliance Rules</h1>
          <p className="text-slate-500">Define compliance rules the AI must follow during content generation.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
        >
          <Plus size={18} />
          <span>New Rule</span>
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <ShieldCheck size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No compliance rules yet</h3>
          <p className="text-slate-500 text-sm mb-6">Create rules to enforce regulatory and brand standards during AI generation.</p>
          <button
            onClick={openCreate}
            className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            <Plus size={18} />
            <span>Create First Rule</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rules.map(rule => (
            <div key={rule.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <ShieldCheck size={16} className="text-green-600" />
                  </div>
                  <h3 className="font-bold text-slate-900">{rule.name}</h3>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => openEdit(rule)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ ruleId: rule.id, ruleName: rule.name })}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {rule.description && (
                <p className="text-sm text-slate-500 mb-3">{rule.description}</p>
              )}

              {rule.sourceFileName && (
                <div className="inline-flex items-center text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mb-3">
                  <FileText size={12} className="mr-1" />
                  {rule.sourceFileName}
                </div>
              )}

              <div className="bg-slate-50 rounded-lg p-3 mb-3">
                <p className="text-xs text-slate-600 line-clamp-3 whitespace-pre-wrap">{rule.ruleText}</p>
              </div>

              <div className="text-xs text-slate-400">
                Created {new Date(rule.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">
                {modal.editingRule ? 'Edit Compliance Rule' : 'New Compliance Rule'}
              </h2>
              <button onClick={closeModal} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="e.g. FDA Pharmaceutical Marketing Rules"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Short summary of what this rule covers"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Rule Text *</label>
                  <label className="inline-flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 cursor-pointer">
                    <Upload size={14} />
                    <span>Upload .txt/.md</span>
                    <input
                      type="file"
                      accept=".txt,.md"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
                <textarea
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none h-48 resize-none font-mono text-sm"
                  placeholder="Enter the compliance rules the AI must follow..."
                  value={ruleText}
                  onChange={(e) => setRuleText(e.target.value)}
                />
                {sourceFileName && (
                  <div className="mt-2 inline-flex items-center text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    <FileText size={12} className="mr-1" />
                    Loaded from: {sourceFileName}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-200">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim() || !ruleText.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {modal.editingRule ? 'Save Changes' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Delete Rule</h2>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Delete "<span className="font-medium">{deleteConfirm.ruleName}</span>"? This cannot be undone.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(deleteConfirm.ruleId);
                  setDeleteConfirm(null);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
