const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050/api';

const AUTH_STORAGE_KEY = 'leadspy_auth_user';
const TOKEN_STORAGE_KEY = 'leadspy_auth_token';

/**
 * Log in with email and password
 */
export async function loginUser(email, password) {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Login failed. Please check your credentials.');
    }

    // Save session locally
    setStoredUser(data.user, data.token);
    return data;
  } catch (err) {
    // If backend is offline or network error, fallback to offline demo session for testing
    if (err.message?.includes('fetch failed') || err.message?.includes('Failed to fetch')) {
      console.warn('Backend offline, creating local offline session for:', email);
      const offlineUser = {
        id: `offline-${Date.now()}`,
        email: email,
        name: email.split('@')[0] || 'LeadSpy Agent',
        role: 'Offline Agent'
      };
      setStoredUser(offlineUser, 'offline-token');
      return { success: true, user: offlineUser, token: 'offline-token' };
    }
    throw err;
  }
}

/**
 * Register new user
 */
export async function registerUser(email, password, name) {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Registration failed.');
    }

    setStoredUser(data.user, data.token);
    return data;
  } catch (err) {
    if (err.message?.includes('fetch failed') || err.message?.includes('Failed to fetch')) {
      const offlineUser = {
        id: `offline-${Date.now()}`,
        email: email,
        name: name || email.split('@')[0],
        role: 'LeadSpy Agent'
      };
      setStoredUser(offlineUser, 'offline-token');
      return { success: true, user: offlineUser, token: 'offline-token' };
    }
    throw err;
  }
}

/**
 * Logout user
 */
export async function logoutUser() {
  try {
    const token = getStoredToken();
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }).catch(() => {});
  } finally {
    clearStoredUser();
  }
}

/**
 * Storage helpers
 */
export function getStoredUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || null;
}

export function setStoredUser(user, token) {
  try {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    }
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
  } catch (e) {
    console.error('Failed to store auth info:', e);
  }
}

export function clearStoredUser() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}
