
import React, { useState, useRef } from 'react';
import { Plus, X, Pencil, Trash2, Palette, Upload, Image as ImageIcon } from 'lucide-react';
import { Brand, BrandColor } from '../types';

interface BrandManagerProps {
  brands: Brand[];
  onCreate: (brand: Brand) => void;
  onUpdate: (brand: Brand) => void;
  onDelete: (brandId: string) => void;
}

interface ModalState {
  open: boolean;
  editingBrand: Brand | null;
}

interface DeleteConfirm {
  brandId: string;
  brandName: string;
}

const DEFAULT_COLORS: BrandColor[] = [
  { label: 'Primary', hex: '#2563eb' },
  { label: 'Secondary', hex: '#64748b' },
];

export const BrandManager: React.FC<BrandManagerProps> = ({ brands, onCreate, onUpdate, onDelete }) => {
  const [modal, setModal] = useState<ModalState>({ open: false, editingBrand: null });
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [colors, setColors] = useState<BrandColor[]>(DEFAULT_COLORS);
  const [voiceTone, setVoiceTone] = useState('');
  const [voiceStyle, setVoiceStyle] = useState('');
  const [tagline, setTagline] = useState('');
  const [guidelines, setGuidelines] = useState('');

  const logoInputRef = useRef<HTMLInputElement>(null);

  const openCreate = () => {
    setName('');
    setDescription('');
    setLogoUrl('');
    setColors(DEFAULT_COLORS);
    setVoiceTone('');
    setVoiceStyle('');
    setTagline('');
    setGuidelines('');
    setModal({ open: true, editingBrand: null });
  };

  const openEdit = (brand: Brand) => {
    setName(brand.name);
    setDescription(brand.description);
    setLogoUrl(brand.logoUrl || '');
    setColors(brand.colors.length > 0 ? brand.colors : DEFAULT_COLORS);
    setVoiceTone(brand.voiceTone);
    setVoiceStyle(brand.voiceStyle);
    setTagline(brand.tagline || '');
    setGuidelines(brand.guidelines || '');
    setModal({ open: true, editingBrand: brand });
  };

  const closeModal = () => {
    setModal({ open: false, editingBrand: null });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleColorChange = (index: number, field: keyof BrandColor, value: string) => {
    setColors(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const addColor = () => {
    setColors(prev => [...prev, { label: '', hex: '#000000' }]);
  };

  const removeColor = (index: number) => {
    setColors(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!name.trim()) return;

    const now = new Date().toISOString();
    const cleanedColors = colors.filter(c => c.label.trim() && c.hex.trim());

    if (modal.editingBrand) {
      onUpdate({
        ...modal.editingBrand,
        name: name.trim(),
        description: description.trim(),
        logoUrl: logoUrl || undefined,
        colors: cleanedColors,
        voiceTone: voiceTone.trim(),
        voiceStyle: voiceStyle.trim(),
        tagline: tagline.trim() || undefined,
        guidelines: guidelines.trim() || undefined,
        updatedAt: now,
      });
    } else {
      onCreate({
        id: `brand-${Date.now()}`,
        name: name.trim(),
        description: description.trim(),
        logoUrl: logoUrl || undefined,
        colors: cleanedColors,
        voiceTone: voiceTone.trim(),
        voiceStyle: voiceStyle.trim(),
        tagline: tagline.trim() || undefined,
        guidelines: guidelines.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      });
    }
    closeModal();
  };

  const TONE_PRESETS = [
    'Professional', 'Friendly', 'Playful', 'Authoritative',
    'Inspirational', 'Bold', 'Minimal', 'Luxurious',
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Brands</h1>
          <p className="text-slate-500">Define brand identities with logos, colors, and voice for content generation.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
        >
          <Plus size={18} />
          <span>New Brand</span>
        </button>
      </div>

      {brands.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Palette size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No brands yet</h3>
          <p className="text-slate-500 text-sm mb-6">Create a brand to define your visual identity and voice for AI-generated content.</p>
          <button
            onClick={openCreate}
            className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            <Plus size={18} />
            <span>Create First Brand</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map(brand => (
            <div key={brand.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  {brand.logoUrl ? (
                    <img
                      src={brand.logoUrl}
                      alt={`${brand.name} logo`}
                      className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Palette size={18} className="text-purple-600" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-slate-900">{brand.name}</h3>
                    {brand.tagline && (
                      <p className="text-xs text-slate-400 italic">{brand.tagline}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => openEdit(brand)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ brandId: brand.id, brandName: brand.name })}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {brand.description && (
                <p className="text-sm text-slate-500 mb-3 line-clamp-2">{brand.description}</p>
              )}

              {/* Brand Colors */}
              {brand.colors.length > 0 && (
                <div className="flex items-center space-x-1.5 mb-3">
                  {brand.colors.map((color, idx) => (
                    <div
                      key={idx}
                      className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: color.hex }}
                      title={`${color.label}: ${color.hex}`}
                    />
                  ))}
                </div>
              )}

              {/* Voice Tone */}
              {brand.voiceTone && (
                <div className="inline-flex items-center text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded mb-3">
                  {brand.voiceTone}
                </div>
              )}

              {/* Voice Style Preview */}
              {brand.voiceStyle && (
                <div className="bg-slate-50 rounded-lg p-3 mb-3">
                  <p className="text-xs text-slate-600 line-clamp-2">{brand.voiceStyle}</p>
                </div>
              )}

              <div className="text-xs text-slate-400">
                Created {new Date(brand.createdAt).toLocaleDateString()}
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
                {modal.editingBrand ? 'Edit Brand' : 'New Brand'}
              </h2>
              <button onClick={closeModal} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Logo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Logo</label>
                <div className="flex items-center space-x-4">
                  {logoUrl ? (
                    <div className="relative group">
                      <img
                        src={logoUrl}
                        alt="Brand logo"
                        className="w-16 h-16 rounded-lg object-cover border border-slate-200"
                      />
                      <button
                        onClick={() => setLogoUrl('')}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => logoInputRef.current?.click()}
                      className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      <ImageIcon size={20} className="text-slate-400" />
                      <span className="text-[10px] text-slate-400 mt-1">Upload</span>
                    </div>
                  )}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  {logoUrl && (
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Change
                    </button>
                  )}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Brand Name *</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="e.g. GlowLabs"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Tagline */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tagline</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="e.g. Glow from within"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none h-20 resize-none"
                  placeholder="Briefly describe the brand and its positioning..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Brand Colors */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">Brand Colors</label>
                  <button
                    onClick={addColor}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                  >
                    <Plus size={14} />
                    <span>Add Color</span>
                  </button>
                </div>
                <div className="space-y-2">
                  {colors.map((color, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={color.hex}
                        onChange={(e) => handleColorChange(idx, 'hex', e.target.value)}
                        className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={color.label}
                        onChange={(e) => handleColorChange(idx, 'label', e.target.value)}
                        placeholder="Color label (e.g. Primary)"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                      />
                      <input
                        type="text"
                        value={color.hex}
                        onChange={(e) => handleColorChange(idx, 'hex', e.target.value)}
                        className="w-24 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-mono"
                      />
                      {colors.length > 1 && (
                        <button
                          onClick={() => removeColor(idx)}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Voice Tone */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Voice Tone</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {TONE_PRESETS.map(tone => (
                    <button
                      key={tone}
                      onClick={() => setVoiceTone(tone)}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        voiceTone === tone
                          ? 'bg-purple-100 border-purple-300 text-purple-700'
                          : 'border-slate-200 text-slate-600 hover:border-purple-200 hover:bg-purple-50'
                      }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Or type a custom tone..."
                  value={voiceTone}
                  onChange={(e) => setVoiceTone(e.target.value)}
                />
              </div>

              {/* Voice Style */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Voice & Style Guidelines</label>
                <textarea
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none h-28 resize-none"
                  placeholder="Describe how the brand communicates. E.g. 'Use short, punchy sentences. Avoid jargon. Always address the reader directly.'"
                  value={voiceStyle}
                  onChange={(e) => setVoiceStyle(e.target.value)}
                />
              </div>

              {/* Brand Guidelines */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Additional Guidelines</label>
                <textarea
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none h-24 resize-none"
                  placeholder="Any additional brand guidelines, dos and don'ts, messaging frameworks..."
                  value={guidelines}
                  onChange={(e) => setGuidelines(e.target.value)}
                />
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
                disabled={!name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {modal.editingBrand ? 'Save Changes' : 'Create Brand'}
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
              <h2 className="text-lg font-bold text-slate-900">Delete Brand</h2>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Delete "<span className="font-medium">{deleteConfirm.brandName}</span>"? This cannot be undone.
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
                  onDelete(deleteConfirm.brandId);
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
