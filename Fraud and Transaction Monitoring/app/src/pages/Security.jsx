import { useState } from 'react';
import { ShieldCheck, Lock, Loader2, AlertCircle, CheckCircle, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRisk } from '../context/RiskContext';
import { recordActivity } from '../services/api';
import { changeContact, runFraudChecks } from '../services/entities';
import { readRegistration, registerDeviceSession, saveRegistration } from '../services/journey';

const field = 'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500';

export default function Security() {
  const { user } = useAuth();
  const { buildRiskAttributes } = useRisk();
  const registration = readRegistration();
  const [email, setEmail] = useState(registration?.email || '');
  const [mobile, setMobile] = useState(registration?.mobile || '');
  const [savingContact, setSavingContact] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChangePassword = async () => {
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }

    setSaving(true);
    try {
      // Record PASSWORD_CHANGE activity - triggers monitoring alert
      try {
        const token = await registerDeviceSession(user.userId, 'password_change');
        await recordActivity(user.userId, token, 'PASSWORD_CHANGE', 'INDIVIDUAL', buildRiskAttributes());
      } catch (activityErr) {
        console.warn('Activity recording failed (non-blocking):', activityErr);
      }

      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Password change failed:', err);
      setError('Failed to change password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Changing the email or mobile is the classic first move in an account
   * takeover. Each change goes to FrankieOne as an event, the record is edited
   * in place, and the fraud checks run again on the new details, so a
   * high-risk email or number is flagged in the Portal. The customer only sees
   * that their details were saved.
   */
  const handleChangeContact = async () => {
    setError('');
    setSuccess('');
    const changedEmail = email.trim() && email.trim() !== registration?.email ? email.trim() : null;
    const changedMobile = mobile.replace(/\s/g, '') && mobile.replace(/\s/g, '') !== registration?.mobile ? mobile.replace(/\s/g, '') : null;
    if (!changedEmail && !changedMobile) {
      setError('Nothing has changed.');
      return;
    }
    setSavingContact(true);
    try {
      const token = await registerDeviceSession(user.userId, 'account_update');
      await changeContact(user.userId, { email: changedEmail, phone: changedMobile });
      // The event is for the activity timeline; on some records UAT answers it
      // with a bare 500, so it must not stop the change or the re-screen.
      const events = [changedEmail && 'EMAIL_CHANGE', changedMobile && 'PHONE_CHANGE'].filter(Boolean);
      for (const type of events) {
        await recordActivity(user.userId, token, type, 'INDIVIDUAL', buildRiskAttributes())
          .catch((err) => console.warn(`${type} activity failed (non-blocking):`, err));
      }
      saveRegistration({ ...registration, ...(changedEmail ? { email: changedEmail } : {}), ...(changedMobile ? { mobile: changedMobile } : {}) });
      // Re-screen the new details in the background; the result is for the Portal only.
      runFraudChecks(user.userId).catch((err) => console.warn('Re-screen failed (non-blocking):', err));
      setSuccess('Your contact details have been updated.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error('Contact change failed:', err);
      setError("We couldn't update your details. Please try again.");
    } finally {
      setSavingContact(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Security</h1>
        <p className="text-gray-500">Manage your account security settings</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Contact details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">Contact details</h3>
        </div>
        <div className="space-y-4 max-w-md">
          <div>
            <label htmlFor="sec-email" className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <input id="sec-email" type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label htmlFor="sec-mobile" className="block text-sm font-medium text-gray-700 mb-1">Mobile number</label>
            <input id="sec-mobile" type="tel" className={field} value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </div>
          <button
            onClick={handleChangeContact}
            disabled={savingContact}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {savingContact ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Save contact details
          </button>
        </div>
      </div>

      {/* Password Change */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
        </div>

        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <button
            onClick={handleChangePassword}
            disabled={saving}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Change Password
          </button>
        </div>
      </div>

      {/* Security Overview */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">Security Overview</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-900">Two-Factor Authentication</p>
              <p className="text-sm text-gray-500">Add an extra layer of security</p>
            </div>
            <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">Not Enabled</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-900">Login Notifications</p>
              <p className="text-sm text-gray-500">Get notified of new sign-ins</p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">Enabled</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-gray-900">Session Timeout</p>
              <p className="text-sm text-gray-500">Auto-logout after inactivity</p>
            </div>
            <span className="text-sm font-medium text-gray-700">15 minutes</span>
          </div>
        </div>
      </div>
    </div>
  );
}
