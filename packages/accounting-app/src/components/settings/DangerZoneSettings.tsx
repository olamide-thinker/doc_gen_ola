import React, { useState } from 'react';
import { AlertTriangle, Download, Trash2 } from 'lucide-react';

const DangerZoneSettings: React.FC = () => {
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // TODO: Implement data export
      // const data = await api.exportData();
      // Download as JSON
      const mockData = { projects: [], documents: [], settings: {} };
      const element = document.createElement('a');
      element.setAttribute(
        'href',
        'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(mockData, null, 2))
      );
      element.setAttribute('download', `export-${new Date().toISOString().split('T')[0]}.json`);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (error) {
      alert('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteProject = async () => {
    if (deleteConfirm !== 'DELETE') {
      alert('Please type "DELETE" to confirm');
      return;
    }

    if (!confirm('This action cannot be undone. All data will be permanently deleted.')) {
      return;
    }

    try {
      // TODO: Implement project deletion
      // await api.deleteProject();
      alert('Project deleted successfully');
      setDeleteConfirm('');
    } catch (error) {
      alert('Failed to delete project');
    }
  };

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
        <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-destructive">Danger Zone</p>
          <p className="text-sm text-destructive/80 mt-1">
            These actions are permanent and cannot be undone.
          </p>
        </div>
      </div>

      {/* Export Data */}
      <div className="p-6 bg-card border border-border rounded-2xl space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Export All Data</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Download a backup of all your projects, documents, and settings as a JSON file.
          </p>
        </div>

        <button
          onClick={handleExportData}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          <Download className="w-4 h-4" />
          {isExporting ? 'Exporting...' : 'Export Data'}
        </button>
      </div>

      {/* Delete Project */}
      <div className="p-6 bg-destructive/5 border border-destructive/20 rounded-2xl space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-destructive">Delete Project</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Permanently delete this entire project and all associated data. This action cannot be undone.
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            placeholder='Type "DELETE" to confirm'
            value={deleteConfirm}
            onChange={e => setDeleteConfirm(e.target.value)}
            className="w-full px-4 py-2.5 bg-muted/30 border border-transparent rounded-xl focus:outline-none focus:bg-card focus:border-destructive/30 transition-colors placeholder-muted-foreground"
          />

          <button
            onClick={handleDeleteProject}
            disabled={deleteConfirm !== 'DELETE'}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
          >
            <Trash2 className="w-4 h-4" />
            Delete Project Permanently
          </button>
        </div>

        <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
          ⚠️ This will delete all invoices, receipts, team member records, and settings associated
          with this project.
        </div>
      </div>

      {/* Delete Account */}
      <div className="p-6 bg-destructive/5 border border-destructive/20 rounded-2xl space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-destructive">Delete Account</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Permanently delete your account and all associated data across all projects.
          </p>
        </div>

        <button
          disabled
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-destructive/30 text-destructive-foreground rounded-lg font-medium cursor-not-allowed opacity-60"
        >
          <Trash2 className="w-4 h-4" />
          Delete Account (Coming Soon)
        </button>

        <p className="text-xs text-muted-foreground">
          This feature will be available in a future update. Please contact support to delete your account.
        </p>
      </div>
    </div>
  );
};

export default DangerZoneSettings;
