import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Save, X, CheckCircle } from 'lucide-react';

const BusinessProfileSettings: React.FC = () => {
  const { businessName, businessId } = useAuth();
  const [businessInfo, setBusinessInfo] = useState({
    name: businessName || '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    setBusinessInfo({
      name: businessName || '',
      email: '',
      phone: '',
      address: '',
      city: '',
      country: '',
    });
  }, [businessName]);

  const handleChange = (field: string, value: string) => {
    setBusinessInfo(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // TODO: Implement API call to save business profile
      // await api.updateBusinessProfile(businessId, businessInfo);
      setSaveMessage('Business profile updated successfully');
      setIsEditing(false);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      setSaveMessage('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setBusinessInfo({
      name: businessName || '',
      email: '',
      phone: '',
      address: '',
      city: '',
      country: '',
    });
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {saveMessage && (
        <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-600 dark:text-green-400">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">{saveMessage}</span>
        </div>
      )}

      {/* Business Info Card */}
      <div className="p-6 bg-card border border-border rounded-2xl space-y-5">
        {/* Company Name */}
        <div>
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">
            Company Name
          </label>
          <input
            type="text"
            value={businessInfo.name}
            onChange={e => handleChange('name', e.target.value)}
            disabled={!isEditing}
            className="w-full px-4 py-2.5 bg-muted/30 border border-transparent rounded-xl disabled:opacity-60 disabled:cursor-default focus:outline-none focus:bg-card focus:border-primary/30 transition-colors"
            placeholder="Enter company name"
          />
        </div>

        {/* Email */}
        <div>
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">
            Business Email
          </label>
          <input
            type="email"
            value={businessInfo.email}
            onChange={e => handleChange('email', e.target.value)}
            disabled={!isEditing}
            className="w-full px-4 py-2.5 bg-muted/30 border border-transparent rounded-xl disabled:opacity-60 disabled:cursor-default focus:outline-none focus:bg-card focus:border-primary/30 transition-colors"
            placeholder="contact@company.com"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">
            Phone Number
          </label>
          <input
            type="tel"
            value={businessInfo.phone}
            onChange={e => handleChange('phone', e.target.value)}
            disabled={!isEditing}
            className="w-full px-4 py-2.5 bg-muted/30 border border-transparent rounded-xl disabled:opacity-60 disabled:cursor-default focus:outline-none focus:bg-card focus:border-primary/30 transition-colors"
            placeholder="+1 (555) 000-0000"
          />
        </div>

        {/* Address */}
        <div>
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">
            Address
          </label>
          <input
            type="text"
            value={businessInfo.address}
            onChange={e => handleChange('address', e.target.value)}
            disabled={!isEditing}
            className="w-full px-4 py-2.5 bg-muted/30 border border-transparent rounded-xl disabled:opacity-60 disabled:cursor-default focus:outline-none focus:bg-card focus:border-primary/30 transition-colors"
            placeholder="Street address"
          />
        </div>

        {/* City & Country */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">
              City
            </label>
            <input
              type="text"
              value={businessInfo.city}
              onChange={e => handleChange('city', e.target.value)}
              disabled={!isEditing}
              className="w-full px-4 py-2.5 bg-muted/30 border border-transparent rounded-xl disabled:opacity-60 disabled:cursor-default focus:outline-none focus:bg-card focus:border-primary/30 transition-colors"
              placeholder="City"
            />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">
              Country
            </label>
            <input
              type="text"
              value={businessInfo.country}
              onChange={e => handleChange('country', e.target.value)}
              disabled={!isEditing}
              className="w-full px-4 py-2.5 bg-muted/30 border border-transparent rounded-xl disabled:opacity-60 disabled:cursor-default focus:outline-none focus:bg-card focus:border-primary/30 transition-colors"
              placeholder="Country"
            />
          </div>
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
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg font-medium text-sm hover:bg-muted/80 disabled:opacity-60 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Business ID Info */}
      <div className="p-4 bg-muted/30 rounded-xl">
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">
          Business ID
        </p>
        <p className="font-mono text-sm text-foreground break-all">{businessId}</p>
      </div>
    </div>
  );
};

export default BusinessProfileSettings;
