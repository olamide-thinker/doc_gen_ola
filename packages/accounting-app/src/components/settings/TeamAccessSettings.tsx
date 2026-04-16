import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Mail, Plus, Trash2, Copy, Link2, CheckCircle } from 'lucide-react';

interface TeamMember {
  email: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  status: 'active' | 'pending';
  joinedAt?: string;
}

const TeamAccessSettings: React.FC = () => {
  const { businessId, currentUserRole } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'editor' | 'viewer'>('editor');
  const [isLoading, setIsLoading] = useState(false);
  const [joinLink, setJoinLink] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isOwner] = useState(currentUserRole === 'owner');

  useEffect(() => {
    // TODO: Fetch members from API
    // const fetchMembers = async () => {
    //   const data = await api.getTeamMembers(businessId);
    //   setMembers(data);
    // };
    // fetchMembers();
  }, [businessId]);

  const handleAddMember = async () => {
    if (!newMemberEmail.trim()) {
      setMessage({ type: 'error', text: 'Please enter an email address' });
      return;
    }

    setIsLoading(true);
    try {
      // TODO: Implement API call to add member
      // await api.addMember(businessId, newMemberEmail, selectedRole);
      setMessage({ type: 'success', text: `Invitation sent to ${newMemberEmail}` });
      setNewMemberEmail('');
      setSelectedRole('editor');
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to add member' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = async (email: string) => {
    if (!confirm(`Remove ${email} from the team?`)) return;

    try {
      // TODO: Implement API call to remove member
      // await api.removeMember(businessId, email);
      setMembers(members.filter(m => m.email !== email));
      setMessage({ type: 'success', text: 'Member removed successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to remove member' });
    }
  };

  const handleGenerateJoinLink = () => {
    const link = `${window.location.origin}/onboarding?join=${businessId}`;
    setJoinLink(link);
  };

  const handleCopyJoinLink = () => {
    navigator.clipboard.writeText(joinLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
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

      {/* Add Member Card */}
      {isOwner && (
        <div className="p-6 bg-card border border-border rounded-2xl space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Add Team Member</h3>

          <div className="space-y-3">
            {/* Email Input */}
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">
                Email Address
              </label>
              <input
                type="email"
                value={newMemberEmail}
                onChange={e => setNewMemberEmail(e.target.value)}
                placeholder="team@example.com"
                className="w-full px-4 py-2.5 bg-muted/30 border border-transparent rounded-xl focus:outline-none focus:bg-card focus:border-primary/30 transition-colors"
              />
            </div>

            {/* Role Select */}
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">
                Role
              </label>
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value as 'admin' | 'editor' | 'viewer')}
                className="w-full px-4 py-2.5 bg-muted/30 border border-transparent rounded-xl focus:outline-none focus:bg-card focus:border-primary/30 transition-colors appearance-none cursor-pointer"
              >
                <option value="admin">Admin - Full access</option>
                <option value="editor">Editor - Can edit documents</option>
                <option value="viewer">Viewer - Read only</option>
              </select>
            </div>
          </div>

          {/* Add Button */}
          <button
            onClick={handleAddMember}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            {isLoading ? 'Sending invitation...' : 'Send Invitation'}
          </button>
        </div>
      )}

      {/* Join Link Card */}
      <div className="p-6 bg-card border border-border rounded-2xl space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Share Join Link</h3>
        <p className="text-sm text-muted-foreground">
          Generate a link that team members can use to join your workspace
        </p>

        {!joinLink ? (
          <button
            onClick={handleGenerateJoinLink}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            <Link2 className="w-4 h-4" />
            Generate Join Link
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={joinLink}
                readOnly
                className="flex-1 px-4 py-2.5 bg-muted/30 border border-transparent rounded-xl text-sm font-mono"
              />
              <button
                onClick={handleCopyJoinLink}
                className="px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-lg font-medium transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            {copiedLink && (
              <p className="text-xs text-green-600 dark:text-green-400">✓ Link copied to clipboard</p>
            )}
          </div>
        )}
      </div>

      {/* Current Members */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Team Members ({members.length})</h3>

        {members.length === 0 ? (
          <div className="p-6 text-center bg-muted/30 rounded-xl border border-border">
            <Mail className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No team members yet</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {members.map(member => (
              <div
                key={member.email}
                className={`flex items-center justify-between p-4 bg-card border border-border rounded-lg ${
                  member.role === 'owner' ? 'border-amber-500/30 bg-amber-500/5' : ''
                }`}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{member.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded capitalize">
                      {member.role}
                    </span>
                    {member.status === 'pending' && (
                      <span className="text-xs px-2 py-1 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded">
                        Pending
                      </span>
                    )}
                  </div>
                </div>

                {isOwner && member.role !== 'owner' && (
                  <button
                    onClick={() => handleRemoveMember(member.email)}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamAccessSettings;
