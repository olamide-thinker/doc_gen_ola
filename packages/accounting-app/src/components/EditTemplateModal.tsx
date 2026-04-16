import React, { useState } from 'react';
import { X, Save, Plus, Trash2, Layout, FileText, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TemplateDefinition } from '../lib/templates';
import { DocData, TableColumn, TableRow } from '../types';

interface EditTemplateModalProps {
  template: TemplateDefinition;
  onSave: (updated: TemplateDefinition) => void;
  onClose: () => void;
}

export const EditTemplateModal: React.FC<EditTemplateModalProps> = ({ template, onSave, onClose }) => {
  const [formData, setFormData] = useState<TemplateDefinition>({ ...template });
  const [activeTab, setActiveTab] = useState<'info' | 'content'>('info');

  const handleContentUpdate = (updates: Partial<DocData>) => {
    setFormData(prev => ({
      ...prev,
      content: { ...prev.content, ...updates }
    }));
  };

  const addRow = () => {
    const columns = formData.content.table?.columns || [];
    const newRow: TableRow = { id: crypto.randomUUID(), rowType: 'row' };
    columns.forEach(col => {
      if (col.type === 'text') newRow[col.id] = 'New Item';
      if (col.type === 'number') newRow[col.id] = 0;
    });
    
    const currentRows = formData.content.table?.rows || [];
    handleContentUpdate({
      table: {
        ...formData.content.table!,
        rows: [...currentRows, newRow]
      }
    });
  };

  const removeRow = (id: string | undefined) => {
    if (!id) return;
    const currentRows = formData.content.table?.rows || [];
    handleContentUpdate({
      table: {
        ...formData.content.table!,
        rows: currentRows.filter(r => r.id !== id)
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-card rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 flex justify-between items-center bg-muted/30">
          <div>
            <h2 className="text-xl font-bold text-foreground font-lexend">Edit Template</h2>
            <p className="text-sm text-muted-foreground">Modify how this template looks and behaves</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 border-t border-border/20 gap-8">
          <button 
            onClick={() => setActiveTab('info')}
            className={`py-4 text-sm font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'info' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Basic Info
          </button>
          <button 
            onClick={() => setActiveTab('content')}
            className={`py-4 text-sm font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'content' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Default Content
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'info' ? (
            <div className="space-y-6 max-w-2xl">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-tighter mb-2">Template Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-4 bg-muted/40 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:bg-card outline-none transition-all text-foreground font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-tighter mb-2">Description</label>
                <textarea 
                  rows={4}
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full p-4 bg-muted/40 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:bg-card outline-none transition-all text-foreground font-medium resize-none"
                />
              </div>
              <div className="p-4 bg-blue-500/10 rounded-2xl flex gap-4">
                <Settings2 className="text-blue-500 shrink-0" size={24} />
                <p className="text-sm text-blue-600/80 leading-relaxed">
                  Changes to this template will affect all new documents created from it. Existing documents will remain unchanged.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Title Edit */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-tighter mb-2">Default Document Title</label>
                <input 
                  type="text" 
                  value={formData.content.title || ''}
                  onChange={e => handleContentUpdate({ title: e.target.value })}
                  className="w-full p-3 bg-muted/40 rounded-xl focus:ring-1 focus:ring-primary/40 outline-none text-foreground"
                />
              </div>

              {/* Rows List */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-tighter">Default Table Items</label>
                  <button 
                    onClick={addRow}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary/20 transition-colors"
                  >
                    <Plus size={14} /> Add Row
                  </button>
                </div>
                
                <div className="space-y-3">
                  {(formData.content.table?.rows || []).map((row, idx) => (
                    <div key={row.id || idx} className="flex items-center gap-4 p-4 rounded-2xl bg-muted/20 group hover:bg-muted/40 transition-colors">
                      <div className="text-xs font-bold text-muted-foreground/40 w-8">{idx + 1}</div>
                      <input 
                        type="text"
                        value={row.B as string || ''}
                        onChange={e => {
                          const newRows = [...(formData.content.table?.rows || [])];
                          newRows[idx] = { ...row, B: e.target.value };
                          handleContentUpdate({ table: { ...formData.content.table!, rows: newRows } });
                        }}
                        className="flex-1 bg-transparent border-none outline-none text-sm text-foreground font-medium"
                        placeholder="Item description..."
                      />
                      <div className="flex items-center gap-2">
                        <input 
                          type="number"
                          value={row.D as number || 0}
                          onChange={e => {
                            const newRows = [...(formData.content.table?.rows || [])];
                            newRows[idx] = { ...row, D: parseFloat(e.target.value) || 0 };
                            handleContentUpdate({ table: { ...formData.content.table!, rows: newRows } });
                          }}
                          className="w-20 p-2 bg-muted/50 rounded-lg text-right text-sm text-foreground focus:ring-1 focus:ring-primary/40 outline-none"
                        />
                        <button 
                          onClick={() => removeRow(row.id)}
                          className="p-2 text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {(formData.content.table?.rows || []).length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed border-border/20 rounded-3xl">
                      <Layout className="mx-auto text-muted-foreground/20 mb-2" size={32} />
                      <p className="text-sm text-muted-foreground">No default rows. Create one to start.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Coming Soon Section */}
              <div className="p-6 border-2 border-dashed border-border/20 rounded-3xl bg-amber-500/5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="px-2 py-0.5 bg-amber-500/20 text-amber-600 rounded text-[10px] font-black uppercase tracking-widest">Coming Soon</div>
                  <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Legal & Contracts</h4>
                </div>
                <p className="text-xs text-muted-foreground/80">Soon you'll be able to attach specific contract terms and legal fine print directly to templates.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-muted/30 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-3 text-muted-foreground font-bold text-sm uppercase tracking-widest hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave(formData)}
            className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-2xl font-bold text-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Save size={18} /> Save Changes
          </button>
        </div>
      </motion.div>
    </div>
  );
};
