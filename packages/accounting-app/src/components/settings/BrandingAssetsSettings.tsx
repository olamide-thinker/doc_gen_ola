import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Upload, Trash2, CheckCircle, Loader } from 'lucide-react';
import { API_BASE } from '../../lib/workspace-persist';

interface AssetUpload {
  logoUrl?: string;
  letterheadUrl1?: string;
  letterheadUrl2?: string;
  letterheadUrl3?: string;
}

const BrandingAssetsSettings: React.FC = () => {
  const { businessId, businessAssets, user } = useAuth();
  const [assets, setAssets] = useState<AssetUpload>(businessAssets || {});
  const [uploading, setUploading] = useState<{ [key: string]: boolean }>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const assetFields = [
    { key: 'logoUrl', label: 'Business Logo', description: 'Used in invoices and documents (max 5MB)', size: '5MB' },
    { key: 'letterheadUrl1', label: 'Letterhead 1 (Full Page)', description: 'Standard full-page letterhead (max 10MB)', size: '10MB' },
    { key: 'letterheadUrl2', label: 'Letterhead 2 (Compact)', description: 'Top-header letterhead for compact layouts (max 10MB)', size: '10MB' },
    { key: 'letterheadUrl3', label: 'Letterhead 3 (Alternative)', description: 'Secondary/alternative letterhead (max 10MB)', size: '10MB' },
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, assetKey: string) => {
    const file = e.target.files?.[0];
    if (!file || !businessId || !user) return;

    setUploading(prev => ({ ...prev, [assetKey]: true }));
    setMessage(null);

    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append('file', file);

      // Upload file
      const uploadRes = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error('File upload failed');
      }

      const { url } = await uploadRes.json();

      // Update business assets in backend
      const updateRes = await fetch(`${API_BASE}/businesses/${businessId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metadata: {
            ...assets,
            [assetKey]: url,
          },
        }),
      });

      if (!updateRes.ok) {
        throw new Error('Failed to save asset');
      }

      setAssets(prev => ({ ...prev, [assetKey]: url }));
      setMessage({ type: 'success', text: `${assetFields.find(f => f.key === assetKey)?.label} uploaded successfully` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Upload failed' });
    } finally {
      setUploading(prev => ({ ...prev, [assetKey]: false }));
    }
  };

  const handleDeleteAsset = async (assetKey: string) => {
    if (!confirm('Delete this asset?')) return;
    if (!businessId || !user) return;

    setUploading(prev => ({ ...prev, [assetKey]: true }));

    try {
      const token = await user.getIdToken();
      const updateRes = await fetch(`${API_BASE}/businesses/${businessId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metadata: {
            ...assets,
            [assetKey]: null,
          },
        }),
      });

      if (!updateRes.ok) {
        throw new Error('Failed to delete asset');
      }

      const newAssets = { ...assets };
      delete newAssets[assetKey as keyof AssetUpload];
      setAssets(newAssets);
      setMessage({ type: 'success', text: 'Asset deleted' });
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete asset' });
    } finally {
      setUploading(prev => ({ ...prev, [assetKey]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-2 p-4 border rounded-xl ${
            message.type === 'success'
              ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
          }`}
        >
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Asset Cards */}
      <div className="space-y-4">
        {assetFields.map(field => (
          <div
            key={field.key}
            className="p-6 bg-card border border-border rounded-2xl space-y-4"
          >
            {/* Header */}
            <div>
              <h3 className="text-sm font-semibold text-foreground">{field.label}</h3>
              <p className="text-xs text-muted-foreground mt-1">{field.description}</p>
            </div>

            {/* Preview or Upload */}
            {assets[field.key as keyof AssetUpload] ? (
              <div className="space-y-3">
                {/* Preview */}
                <div className="border border-border rounded-lg p-4 bg-muted/20">
                  <img
                    src={assets[field.key as keyof AssetUpload]}
                    alt={field.label}
                    className="max-w-full h-auto max-h-32 object-contain mx-auto"
                  />
                </div>

                {/* Replace & Delete */}
                <div className="flex gap-2">
                  <label className="flex-1">
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={e => handleFileUpload(e, field.key)}
                      disabled={uploading[field.key]}
                      className="hidden"
                    />
                    <span className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium cursor-pointer hover:opacity-90 disabled:opacity-60 transition-opacity">
                      {uploading[field.key] ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Replace
                        </>
                      )}
                    </span>
                  </label>
                  <button
                    onClick={() => handleDeleteAsset(field.key)}
                    disabled={uploading[field.key]}
                    className="px-4 py-2.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg font-medium transition-colors disabled:opacity-60"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-border rounded-xl hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={e => handleFileUpload(e, field.key)}
                  disabled={uploading[field.key]}
                  className="hidden"
                />
                <Upload className="w-6 h-6 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Click to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG or JPG (max {field.size})</p>
                </div>
              </label>
            )}
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <p className="text-sm text-blue-600 dark:text-blue-400">
          💡 These assets are shared with all team members in your business. They will automatically appear in new invoices and receipts.
        </p>
      </div>
    </div>
  );
};

export default BrandingAssetsSettings;
