import React, { useState } from 'react';
import { ChevronLeft, Building2, Users, BookOpen, FolderOpen, Palette, AlertTriangle, UserCircle, Image } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SettingsNavigation from './settings/SettingsNavigation';
import BusinessProfileSettings from './settings/BusinessProfileSettings';
import UserProfileSettings from './settings/UserProfileSettings';
import BrandingAssetsSettings from './settings/BrandingAssetsSettings';
import TeamAccessSettings from './settings/TeamAccessSettings';
import ServiceDictionarySettings from './settings/ServiceDictionarySettings';
import ProjectsSettings from './settings/ProjectsSettings';
import AppearanceSettings from './settings/AppearanceSettings';
import DangerZoneSettings from './settings/DangerZoneSettings';

export type SettingsSection =
  | 'business-profile'
  | 'user-profile'
  | 'branding-assets'
  | 'team-access'
  | 'service-dictionary'
  | 'projects'
  | 'appearance'
  | 'danger-zone';

interface SettingsSectionConfig {
  id: SettingsSection;
  label: string;
  icon: React.ReactNode;
  category: 'primary' | 'secondary' | 'danger';
  component: React.ReactNode;
}

const SettingsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('business-profile');
  const { businessId } = useAuth();

  const sections: SettingsSectionConfig[] = [
    {
      id: 'business-profile',
      label: 'Business Profile',
      icon: <Building2 className="w-4 h-4" />,
      category: 'primary',
      component: <BusinessProfileSettings />,
    },
    {
      id: 'user-profile',
      label: 'User Profile',
      icon: <UserCircle className="w-4 h-4" />,
      category: 'primary',
      component: <UserProfileSettings />,
    },
    {
      id: 'branding-assets',
      label: 'Branding & Assets',
      icon: <Image className="w-4 h-4" />,
      category: 'primary',
      component: <BrandingAssetsSettings />,
    },
    {
      id: 'team-access',
      label: 'Team & Access',
      icon: <Users className="w-4 h-4" />,
      category: 'primary',
      component: <TeamAccessSettings />,
    },
    {
      id: 'service-dictionary',
      label: 'Service Dictionary',
      icon: <BookOpen className="w-4 h-4" />,
      category: 'primary',
      component: <ServiceDictionarySettings />,
    },
    {
      id: 'projects',
      label: 'Projects & Workspace',
      icon: <FolderOpen className="w-4 h-4" />,
      category: 'secondary',
      component: <ProjectsSettings />,
    },
    {
      id: 'appearance',
      label: 'Appearance',
      icon: <Palette className="w-4 h-4" />,
      category: 'secondary',
      component: <AppearanceSettings />,
    },
    {
      id: 'danger-zone',
      label: 'Danger Zone',
      icon: <AlertTriangle className="w-4 h-4" />,
      category: 'danger',
      component: <DangerZoneSettings />,
    },
  ];

  const activeConfig = sections.find(s => s.id === activeSection);

  return (
    <div className="flex h-full gap-6">
      {/* Left Sidebar Navigation */}
      <SettingsNavigation
        sections={sections}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
      />

      {/* Right Content Area */}
      <div className="flex-1 overflow-y-auto pr-6 pb-8">
        {/* Header */}
        <div className="sticky top-0 bg-background z-10 pb-4 mb-6 border-b border-border">
          <h1 className="text-2xl font-semibold text-foreground">
            {activeConfig?.label}
          </h1>
          {businessId && (
            <p className="text-sm text-muted-foreground mt-1">
              Workspace ID: {businessId.substring(0, 12)}...
            </p>
          )}
        </div>

        {/* Dynamic Content */}
        <div className="max-w-3xl">
          {activeConfig && activeConfig.component}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
