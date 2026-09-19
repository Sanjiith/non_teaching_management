import api from './api';
import { STORAGE_KEYS } from '../config/constants';

/**
 * Login — sends credentials, stores token + user in localStorage
 */
export const login = async (employeeId, password) => {
  const response = await api.post('/auth/login', { employeeId, password });
  const { user, token } = response.data.data;

  localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));

  return { user, token };
};

/**
 * Logout — calls logout endpoint and clears localStorage
 */
export const logout = async () => {
  try {
    await api.post('/auth/logout');
  } catch {
    // If token is already invalid, silently proceed
  } finally {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
  }
};

/**
 * Get current user from API (validates token)
 */
export const getCurrentUser = async () => {
  const response = await api.get('/auth/me');
  return response.data.data.user;
};

/**
 * Get stored token from localStorage
 */
export const getStoredToken = () => localStorage.getItem(STORAGE_KEYS.TOKEN);

/**
 * Get stored user from localStorage (parsed)
 */
export const getStoredUser = () => {
  try {
    const user = localStorage.getItem(STORAGE_KEYS.USER);
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};
