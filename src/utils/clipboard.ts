/**
 * Clipboard utility functions
 */

/**
 * Copy text to clipboard
 * @param text - Text to copy
 * @throws Error if clipboard operation fails
 */
export const copyToClipboard = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    throw new Error('Failed to copy to clipboard');
  }
};
