/**
 * Safely execute a function
 * @param {Function} fn Function to execute
 * @param {any[]} args Arguments to pass to the function
 * @param {Function} onError Error handler
 * @returns {Promise<any>} Function result
 */
export const safeExec = async (fn, args = [], onError = console.error) => {
  try {
    return await fn(...args);
  } catch (error) {
    onError(error);
    return null;
  }
};

/**
 * Debounce a function
 * @param {Function} fn Function to debounce
 * @param {number} delay Delay in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
};

/**
 * Format error message
 * @param {Error} error Error object
 * @returns {string} Formatted error message
 */
export const formatError = (error) => {
  if (!error) return 'Unknown error';

  if (error.stack) {
    const firstLine = error.stack.split('\n')[0];
    return firstLine || error.message || 'Unknown error';
  }

  return error.message || 'Unknown error';
};

/**
 * Check if a string is valid JSON
 * @param {string} str String to check
 * @returns {boolean} Whether the string is valid JSON
 */
export const isValidJson = (str) => {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Sleep for a given number of milliseconds
 * @param {number} ms Milliseconds to sleep
 * @returns {Promise<void>}
 */
export const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Get file extension from path
 * @param {string} path File path
 * @returns {string} File extension (without the dot)
 */
export const getFileExtension = (path) => {
  const parts = path.split('.');
  if (parts.length === 1) return '';
  return parts[parts.length - 1].toLowerCase();
};

/**
 * Get file icon based on extension
 * @param {string} path File path
 * @returns {string} File icon (emoji)
 */
export const getFileIcon = (path) => {
  const extension = getFileExtension(path);

  const iconMap = {
    js: '📜',
    jsx: '📜',
    ts: '📜',
    tsx: '📜',
    json: '⚙️',
    html: '🌐',
    htm: '🌐',
    css: '🎨',
    scss: '🎨',
    sass: '🎨',
    less: '🎨',
    md: '📝',
    markdown: '📝',
    png: '🖼️',
    jpg: '🖼️',
    jpeg: '🖼️',
    gif: '🖼️',
    svg: '🖼️',
    gitignore: '🔧',
    npmrc: '🔧',
    env: '🔧'
  };

  return iconMap[extension] || '📄';
};

/**
 * Create a path by joining segments
 * @param {...string} segments Path segments
 * @returns {string} Joined path
 */
export const joinPath = (...segments) => {
  return segments
    .map(segment => segment.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
};
