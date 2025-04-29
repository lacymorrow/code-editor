import { getFileIcon } from '../utils/common';
import webContainerService from '../services/WebContainerService';

/**
 * File Tree Component
 * A reusable component to display file tree in the UI
 */
export class FileTreeComponent {
  constructor(options = {}) {
    const {
      rootPath = '/',
      onFileSelect = () => {},
      onDirectoryChange = () => {}
    } = options;

    this.rootPath = rootPath;
    this.onFileSelect = onFileSelect;
    this.onDirectoryChange = onDirectoryChange;
    this.expandedDirs = new Set(['root']);
    this.selectedItem = null;
    this.fileDataCache = new Map();
    this.container = document.createElement('div');
    this.container.className = 'file-tree';
  }

  /**
   * Load directory contents
   * @param {string} path Directory path
   * @returns {Promise<Object[]>} Directory entries
   */
  async loadDirectory(path) {
    try {
      console.log(`[FileTree] Loading directory: ${path}`);

      if (this.fileDataCache.has(path)) {
        console.log(`[FileTree] Using cached data for ${path}`);
        return this.fileDataCache.get(path);
      }

      if (!webContainerService.instance) {
        console.error('[FileTree] WebContainer instance not available');
        return [];
      }

      const entries = await webContainerService.instance.fs.readdir(path, { withFileTypes: true });
      console.log(`[FileTree] Loaded ${entries.length} entries for ${path}`);

      // Sort: directories first, then files
      const sortedEntries = entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      // Cache the result
      this.fileDataCache.set(path, sortedEntries);
      return sortedEntries;
    } catch (error) {
      console.error(`[FileTree] Error loading directory ${path}:`, error);
      this.container.innerHTML = `<div class="error">Error loading directory ${path}: ${error.message}</div>`;
      return [];
    }
  }

  /**
   * Create item ID from path
   * @param {string} path Parent path
   * @param {string} name Item name
   * @param {boolean} isDirectory Whether it's a directory
   * @returns {Object} Item ID object
   */
  createItemId(path, name, isDirectory) {
    const fullPath = path === '/' ? `/${name}` : `${path}/${name}`;
    return {
      id: fullPath,
      isDirectory,
      path: fullPath
    };
  }

  /**
   * Initialize the tree
   */
  async initialize() {
    console.log('[FileTree] Initializing file tree');

    if (!webContainerService.instance) {
      console.error('[FileTree] WebContainer not initialized');
      this.container.innerHTML = '<div class="error">WebContainer not initialized</div>';
      return;
    }

    // Clear existing content
    this.container.innerHTML = '';

    // Initial items (root level)
    try {
      console.log(`[FileTree] Loading root items from ${this.rootPath}`);
      const rootItems = await this.loadDirectory(this.rootPath);
      console.log(`[FileTree] Rendering ${rootItems.length} root items`);
      await this.renderTree(rootItems, this.rootPath);
    } catch (error) {
      console.error('[FileTree] Error initializing file tree:', error);
      this.container.innerHTML = `<div class="error">Error loading file tree: ${error.message}</div>`;
    }
  }

  /**
   * Render tree with items
   * @param {Object[]} items Directory items
   * @param {string} currentPath Current path
   */
  async renderTree(items, currentPath) {
    console.log(`[FileTree] Rendering tree at ${currentPath} with ${items.length} items`);

    // Clear the container
    this.container.innerHTML = '';

    // Add parent directory option if not at root
    if (currentPath !== '/') {
      const parentItem = document.createElement('div');
      parentItem.className = 'tree-item parent-dir';
      parentItem.innerHTML = '<span class="icon">📁</span> ..';
      parentItem.addEventListener('click', () => {
        const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
        console.log(`[FileTree] Navigating to parent directory: ${parentPath}`);
        this.onDirectoryChange?.(parentPath);
        this.loadDirectory(parentPath).then(items => this.renderTree(items, parentPath));
      });
      this.container.appendChild(parentItem);
    }

    // Render each item
    for (const item of items) {
      try {
        const itemEl = document.createElement('div');
        itemEl.className = 'tree-item';

        const isDirectory = item.isDirectory();
        const itemId = this.createItemId(currentPath, item.name, isDirectory);

        if (isDirectory) {
          itemEl.classList.add('directory');
          if (this.expandedDirs.has(itemId.id)) {
            itemEl.classList.add('expanded');
          }

          itemEl.innerHTML = `
            <span class="icon">${this.expandedDirs.has(itemId.id) ? '📂' : '📁'}</span>
            <span class="name">${item.name}</span>
          `;

          // Add click handler for directories
          itemEl.addEventListener('click', async (e) => {
            console.log(`[FileTree] Directory clicked: ${itemId.path}`);
            if (this.expandedDirs.has(itemId.id)) {
              // Collapse directory
              console.log(`[FileTree] Collapsing directory: ${itemId.path}`);
              this.expandedDirs.delete(itemId.id);
              itemEl.classList.remove('expanded');
              itemEl.querySelector('.icon').textContent = '📁';
            } else {
              // Expand directory
              console.log(`[FileTree] Expanding directory: ${itemId.path}`);
              this.expandedDirs.add(itemId.id);
              itemEl.classList.add('expanded');
              itemEl.querySelector('.icon').textContent = '📂';

              // Load child items
              this.onDirectoryChange?.(itemId.path);
              try {
                const childItems = await this.loadDirectory(itemId.path);
                await this.renderTree(childItems, itemId.path);
              } catch (error) {
                console.error(`[FileTree] Error loading child items for ${itemId.path}:`, error);
                this.container.innerHTML = `<div class="error">Error loading directory: ${error.message}</div>`;
              }
            }
          });
        } else {
          // Get file icon based on extension
          const icon = getFileIcon(item.name);

          itemEl.innerHTML = `
            <span class="icon">${icon}</span>
            <span class="name">${item.name}</span>
          `;

          // Add click handler for files
          itemEl.addEventListener('click', () => {
            console.log(`[FileTree] File clicked: ${itemId.path}`);
            // Clear previous selection
            this.container.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
            // Mark as selected
            itemEl.classList.add('selected');
            this.selectedItem = itemId;
            this.onFileSelect?.(itemId.path);
          });
        }

        this.container.appendChild(itemEl);
      } catch (error) {
        console.error(`[FileTree] Error rendering item ${item.name}:`, error);
      }
    }
  }

  /**
   * Refresh the file tree
   */
  refresh() {
    console.log('[FileTree] Refreshing file tree');
    // Clear cache and reinitialize
    this.fileDataCache.clear();
    this.initialize();
  }

  /**
   * Navigate to a specific path
   * @param {string} path Path to navigate to
   */
  async navigateTo(path) {
    console.log(`[FileTree] Navigating to: ${path}`);
    try {
      const items = await this.loadDirectory(path);
      await this.renderTree(items, path);
      this.onDirectoryChange?.(path);
    } catch (error) {
      console.error(`[FileTree] Error navigating to ${path}:`, error);
      this.container.innerHTML = `<div class="error">Error navigating to ${path}: ${error.message}</div>`;
    }
  }

  /**
   * Get the container element
   * @returns {HTMLElement} Container element
   */
  getContainer() {
    return this.container;
  }
}

/**
 * Create and return a new FileTreeComponent
 * @param {Object} options Component options
 * @returns {FileTreeComponent} File tree component
 */
export function createFileTree(options) {
  console.log('[FileTree] Creating file tree with options:', options);
  const fileTree = new FileTreeComponent(options);
  fileTree.initialize();
  return fileTree;
}
