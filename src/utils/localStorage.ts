/**
 * LocalStorage utility functions
 */

/**
 * Get a value from localStorage
 * @param key - Storage key
 * @returns Stored value or null if not found
 */
export const getStorageItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error(`Failed to get localStorage item "${key}":`, error);
    return null;
  }
};

/**
 * Set a value in localStorage
 * @param key - Storage key
 * @param value - Value to store
 */
export const setStorageItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error(`Failed to set localStorage item "${key}":`, error);
  }
};

/**
 * Remove a value from localStorage
 * @param key - Storage key
 */
export const removeStorageItem = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to remove localStorage item "${key}":`, error);
  }
};

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
  CURRENT_PROJECT_ID: 'current_project_id',
} as const;

/**
 * Get current project ID from localStorage
 * @returns Project ID or null if not found
 */
export const getCurrentProjectId = (): string | null => {
  return getStorageItem(STORAGE_KEYS.CURRENT_PROJECT_ID);
};

/**
 * Set current project ID in localStorage
 * @param projectId - Project ID to store
 */
export const setCurrentProjectId = (projectId: string): void => {
  setStorageItem(STORAGE_KEYS.CURRENT_PROJECT_ID, projectId);
};

/**
 * Remove current project ID from localStorage
 */
export const removeCurrentProjectId = (): void => {
  removeStorageItem(STORAGE_KEYS.CURRENT_PROJECT_ID);
};
