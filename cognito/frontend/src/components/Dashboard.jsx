import { useState } from 'react';
import axios from 'axios';
import { signOut, getAccessToken } from '../cognito';
import { apiConfig } from '../config';

function Dashboard({ user, onLogout }) {
  const [apiResponse, setApiResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const callAPI = async (endpoint, requiresAuth = false) => {
    setLoading(true);
    setApiResponse(null);

    try {
      const headers = {};
      
      if (requiresAuth) {
        const token = await getAccessToken();
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await axios.get(`${apiConfig.baseURL}${endpoint}`, {
        headers,
      });

      setApiResponse({
        success: true,
        data: response.data,
      });
    } catch (error) {
      setApiResponse({
        success: false,
        error: error.response?.data?.error || error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    signOut();
    onLogout();
  };

  return (
    <div className="dashboard">
      <h1>Welcome, {user.username}!</h1>
      
      <div className="user-info">
        <h3>User Information</h3>
        <p><strong>Username:</strong> {user.username}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Email Verified:</strong> {user.email_verified}</p>
      </div>

      <div className="api-section">
        <h3>Test API Endpoints</h3>
        <div className="api-buttons">
          <button onClick={() => callAPI('/api/public', false)}>
            Call Public Endpoint
          </button>
          <button onClick={() => callAPI('/api/protected', true)}>
            Call Protected Endpoint
          </button>
          <button onClick={() => callAPI('/api/user/profile', true)}>
            Get User Profile
          </button>
        </div>

        {loading && <div className="info">Loading...</div>}

        {apiResponse && (
          <div className="response-box">
            <strong>API Response:</strong>
            <pre>{JSON.stringify(apiResponse, null, 2)}</pre>
          </div>
        )}
      </div>

      <button className="logout-btn" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}

export default Dashboard;
