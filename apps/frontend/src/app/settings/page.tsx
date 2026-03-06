'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loading } from '@/components/layout/loading';

export default function SettingsPage() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState('');
  const [pwError, setPwError] = useState(false);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (authLoading) return <Loading />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Please log in.</p>
      </div>
    );
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwMessage('');
    setPwError(false);

    if (newPassword.length < 8) {
      setPwMessage('New password must be at least 8 characters.');
      setPwError(true);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage('Passwords do not match.');
      setPwError(true);
      return;
    }

    setPwSaving(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setPwMessage('Password changed successfully.');
      setPwError(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwMessage(err.message || 'Failed to change password.');
      setPwError(true);
    } finally {
      setPwSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true);
    try {
      await api.deleteAccount();
      logout();
      router.push('/');
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 space-y-8">
      <div>
        <h1 className="text-lg font-semibold tracking-wide">Settings</h1>
        <p className="text-xs text-muted-foreground mt-1">
          <Link href="/profile" className="hover:text-foreground transition-colors underline">
            Back to profile
          </Link>
        </p>
      </div>

      {/* Password Change */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Security</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            {pwMessage && (
              <div className={`p-3 text-sm rounded-md ${pwError ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground'}`}>
                {pwMessage}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="current-password">Current Password</label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="new-password">New Password</label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="8 characters minimum"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="confirm-password">Confirm New Password</label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={pwSaving || !currentPassword || !newPassword}>
              {pwSaving ? 'Saving...' : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account Deletion */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-sm text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Deleting your account is permanent. All your works, reviews, reading data, and profile
            information will be permanently removed and cannot be recovered.
          </p>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="delete-confirm">
                Type <span className="font-mono text-destructive">DELETE</span> to confirm
              </label>
              <Input
                id="delete-confirm"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="max-w-xs"
              />
            </div>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== 'DELETE' || deleting}
              onClick={handleDeleteAccount}
            >
              {deleting ? 'Deleting...' : 'Delete My Account'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
