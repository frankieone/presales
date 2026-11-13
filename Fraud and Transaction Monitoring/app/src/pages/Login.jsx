import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { runFraudChecks } from '../services/entities';
import { readRegistration, registerDeviceSession } from '../services/journey';
import { vertical } from '../config';
import Logo from '../components/Logo';

/**
 * Trigger point 2 — logging in to the client portal.
 *
 * One login per fund: the primary contact who registered on the website. Each
 * login registers a fresh device session against them and runs the onboarding
 * fraud workflow again, so a change of device or country since registration
 * shows as a result in the Portal — an activity alone shows nothing there
 * unless a monitoring rule fires.
 */
export default function Login() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isLocked } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isLocked) return;
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    const reg = readRegistration();
    if (!reg || reg.email.toLowerCase() !== email.trim().toLowerCase()) {
      setError('No account found for that email. Register on our website first.');
      return;
    }
    // Any password is accepted: this is a demo, and presenters shouldn't have
    // to remember what was typed at registration. Only the email must match.

    setLoading(true);
    try {
      try {
        await registerDeviceSession(reg.contactId, 'login');
        // Not awaited: the workflow takes several seconds and the result is for
        // the customer's team, so the applicant goes straight on into the portal.
        runFraudChecks(reg.contactId).catch((fraudErr) =>
          console.error('[Login] Fraud workflow failed:', fraudErr));
      } catch (sessionErr) {
        console.error('[Login] Device session not registered:', sessionErr);
      }

      // Signed in only now: setting the user first lets the public route
      // redirect to the dashboard while the activity is still being recorded.
      login(reg.contactId, 'INDIVIDUAL', reg.fullName, {
        fundId: reg.fundId,
        fundName: reg.fundName,
        applicationId: reg.applicationId,
      });

      navigate(reg.submitted && vertical.container ? '/dashboard' : '/application');
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center"><Logo size="lg" /></div>
          <h1 className="text-xl font-semibold text-gray-900">{vertical.site.portalName}</h1>
          <p className="text-gray-500 mt-1 text-sm">{vertical.brand.product}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLocked}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLocked}
                placeholder="Enter your password"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLocked || loading}
            className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : isLocked ? 'Account Locked' : 'Sign In'}
          </button>
        </form>

        {isLocked && (
          <p className="mt-4 text-center text-sm text-red-600">
            Your account has been locked. Please contact support.
          </p>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          New to {vertical.brand.name}?{' '}
          <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
            Register on our website
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-gray-400">
          {vertical.brand.name} is a placeholder brand for demonstration only.
        </p>
      </div>
    </div>
  );
}
