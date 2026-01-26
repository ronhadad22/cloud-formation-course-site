import { useState } from 'react';
import { signUp, confirmSignUp, signIn } from '../cognito';

function Auth({ onAuthSuccess }) {
  const [mode, setMode] = useState('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await signUp(username, email, password);
      setSuccess('Sign up successful! Please check your email for confirmation code.');
      setNeedsConfirmation(true);
    } catch (err) {
      setError(err.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await confirmSignUp(username, confirmationCode);
      setSuccess('Account confirmed! You can now sign in.');
      setNeedsConfirmation(false);
      setMode('signin');
      setConfirmationCode('');
    } catch (err) {
      setError(err.message || 'Confirmation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const tokens = await signIn(username, password);
      setSuccess('Sign in successful!');
      setTimeout(() => {
        onAuthSuccess({ username, ...tokens });
      }, 500);
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  if (needsConfirmation) {
    return (
      <div className="auth-container">
        <h1>Confirm Account</h1>
        <h2>Enter the code sent to your email</h2>
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}
        <form onSubmit={handleConfirmSignUp}>
          <div className="form-group">
            <label>Confirmation Code</label>
            <input
              type="text"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              required
              placeholder="Enter 6-digit code"
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Confirming...' : 'Confirm Account'}
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setNeedsConfirmation(false)}
          >
            Back
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <h1>AWS Cognito Auth</h1>
      <h2>{mode === 'signin' ? 'Sign In' : 'Sign Up'}</h2>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}
      
      {mode === 'signin' ? (
        <form onSubmit={handleSignIn}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Enter your username"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <div className="toggle-link" onClick={() => setMode('signup')}>
            Don't have an account? Sign up
          </div>
        </form>
      ) : (
        <form onSubmit={handleSignUp}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Choose a username"
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Choose a password (min 8 characters)"
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Signing up...' : 'Sign Up'}
          </button>
          <div className="toggle-link" onClick={() => setMode('signin')}>
            Already have an account? Sign in
          </div>
        </form>
      )}
    </div>
  );
}

export default Auth;
