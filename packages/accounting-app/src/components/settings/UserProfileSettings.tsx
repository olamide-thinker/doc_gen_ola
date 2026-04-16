import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Upload, Trash2, CheckCircle, Loader } from 'lucide-react';
import { API_BASE } from '../../lib/workspace-persist';

interface UserProfileData {
  displayName?: string;
  bio?: string;
  title?: string;
  signatureUrl?: string;
}

const UserProfileSettings: React.FC = () => {
  const { user, userProfile } = useAuth();
  const [profileData, setProfileData] = useState<UserProfileData>({
    displayName: user?.displayName || '',
    bio: userProfile?.bio || '',
    title: userProfile?.title || '',
    signatureUrl: userProfile?.signatureUrl || '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setProfileData({
      displayName: user?.displayName || '',
      bio: userProfile?.bio || '',
      title: userProfile?.title || '',
      signatureUrl: userProfile?.signatureUrl || '',
    });
  }, [user, userProfile]);

  const handleInputChange = (field: string, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
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

      // Update user profile in backend
      const updateRes = await fetch(`${API_BASE}/users/${user.uid}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metadata: {
            ...userProfile,
            signatureUrl: url,
          },
        }),
      });

      if (!updateRes.ok) {
        throw new Error('Failed to save signature');
      }

      setProfileData(prev => ({ ...prev, signatureUrl: url }));
      setMessage({ type: 'success', text: 'Signature uploaded successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteSignature = async () => {
    if (!confirm('Delete this signature?')) return;
    if (!user) return;

    setUploading(true);

    try {
      const token = await user.getIdToken();
      const updateRes = await fetch(`${API_BASE}/users/${user.uid}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metadata: {
            ...userProfile,
            signatureUrl: null,
          },
        }),
      });

      if (!updateRes.ok) {
        throw new Error('Failed to delete signature');
      }

      setProfileData(prev => ({ ...prev, signatureUrl: '' }));
      setMessage({ type: 'success', text: 'Signature deleted' });
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete signature' });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const updateRes = await fetch(`${API_BASE}/users/${user.uid}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: profileData.displayName,
          metadata: {
            ...userProfile,
            bio: profileData.bio,
            title: profileData.title,
          },
        }),
      });

      if (!updateRes.ok) {
        throw new Error('Failed to save profile');
      }

      setMessage({ type: 'success', text: 'Profile updated successfully' });
      setIsEditing(false);
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save' });
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

      {/* Profile Info Card */}
      <div className="p-6 bg-card border border-border rounded-2xl space-y-5">
        {/* Email (Read-only) */}
        <div>
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">
            Email Address
          </label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full px-4 py-2.5 bg-muted/30 border border-transparent rounded-xl disabled:opacity-60 disabled:cursor-default focus:outline-none"
            placeholder="email@example.com"
          />
        </div>

        {/* Display Name */}
        <div>
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">
            Display Name
          </label>
          <input
            type="text"
            value={profileData.displayName || ''}
            onChange={e => handleInputChange('displayName', e.target.value)}
            disabled={!isEditing}
            className="w-full px-4 py-2.5 bg-muted/30 border border-transparent rounded-xl disabled:opacity-60 disabled:cursor-default focus:outline-none focus:bg-card focus:border-primary/30 transition-colors"
            placeholder="Your name"
          />
        </div>

        {/* Title */}
        <div>
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">
            Title / Role
          </label>
          <input
            type="text"
            value={profileData.title || ''}
            onChange={e => handleInputChange('title', e.target.value)}
            disabled={!isEditing}
            className="w-full px-4 py-2.5 bg-muted/30 border border-transparent rounded-xl disabled:opacity-60 disabled:cursor-default focus:outline-none focus:bg-card focus:border-primary/30 transition-colors"
            placeholder="e.g., Project Manager"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">
            Bio
          </label>
          <textarea
            value={profileData.bio || ''}
            onChange={e => handleInputChange('bio', e.target.value)}
            disabled={!isEditing}
            rows={3}
            className="w-full px-4 py-2.5 bg-muted/30 border border-transparent rounded-xl disabled:opacity-60 disabled:cursor-default focus:outline-none focus:bg-card focus:border-primary/30 transition-colors resize-none"
            placeholder="Tell us about yourself..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-border">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
            >
              Edit Profile
            </button>
          ) : (
            <>
              <button
                onClick={handleSaveProfile}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
              >
                Save Changes
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-muted text-foreground rounded-lg font-medium text-sm hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Signature Card */}
      <div className="p-6 bg-card border border-border rounded-2xl space-y-4">
        {/* Header */}
        <div>
          <h3 className="text-sm font-semibold text-foreground">Digital Signature</h3>
          <p className="text-xs text-muted-foreground mt-1">Used in receipts and document signing (max 2MB)</p>
        </div>

        {/* Preview or Upload */}
        {profileData.signatureUrl ? (
          <div className="space-y-3">
            {/* Preview */}
            <div className="border border-border rounded-lg p-4 bg-muted/20">
              <img
                src={profileData.signatureUrl}
                alt="Signature"
                className="max-w-full h-auto max-h-32 object-contain mx-auto"
              />
            </div>

            {/* Replace & Delete */}
            <div className="flex gap-2">
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={e => handleSignatureUpload(e)}
                  disabled={uploading}
                  className="hidden"
                />
                <span className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium cursor-pointer hover:opacity-90 disabled:opacity-60 transition-opacity">
                  {uploading ? (
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
                onClick={handleDeleteSignature}
                disabled={uploading}
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
              onChange={e => handleSignatureUpload(e)}
              disabled={uploading}
              className="hidden"
            />
            <Upload className="w-6 h-6 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Click to upload signature</p>
              <p className="text-xs text-muted-foreground mt-1">PNG or JPG (max 2MB)</p>
            </div>
          </label>
        )}
      </div>

      {/* Info */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <p className="text-sm text-blue-600 dark:text-blue-400">
          💡 Your signature will be visible only to you and will appear in receipts and documents you authorize.
        </p>
      </div>
    </div>
  );
};

export default UserProfileSettings;
