import './style.css'
import {
  webContainerService,
  terminalService,
  gitHubService,
  commandService,
  uiService,
  fileSystemService
} from './services'
import { createFileTree } from './components/FileTreeComponent'
import { safeExec } from './utils/common'

// HTML elements
let terminalElement
let repoUrlInput
let loadButton
let statusElement
let iframeEl
let consoleOutput
let fileExplorer

// Initialize the application
window.addEventListener('DOMContentLoaded', async () => {
  // Add the UI elements
  document.querySelector('#app').innerHTML = `
    <div class="container">
      <div class="header">
        <h1>GitHub Repo WebContainer</h1>
        <div class="repo-input">
          <input type="text" id="repo-url" placeholder="Enter GitHub repository URL (e.g., https://github.com/user/repo)">
          <button id="load-repo">Load Repo</button>
        </div>
      </div>
      <div class="main">
        <div class="sidebar">
          <div class="file-browser">
            <div class="file-browser-header">Files <button id="refresh-files" title="Refresh file list">🔄</button></div>
            <div id="file-explorer" class="file-list"></div>
          </div>
        </div>
        <div class="content">
          <div class="terminal">
            <div class="terminal-header">Terminal</div>
            <div id="terminal-container" class="terminal-container"></div>
          </div>
          <div class="console">
            <div class="console-header">Console Output</div>
            <div id="console-output" class="console-output"></div>
          </div>
          <div class="preview">
            <div class="preview-header">Preview</div>
            <iframe src="loading.html"></iframe>
          </div>
        </div>
      </div>
      <div class="footer">
        <div id="status" class="status"></div>
      </div>
    </div>
  `

  // Cache important DOM elements
  terminalElement = document.getElementById('terminal-container')
  repoUrlInput = document.getElementById('repo-url')
  loadButton = document.getElementById('load-repo')
  statusElement = document.getElementById('status')
  iframeEl = document.querySelector('iframe')
  consoleOutput = document.getElementById('console-output')
  fileExplorer = document.getElementById('file-explorer')

  try {
    // Initialize UI service
    uiService.initialize({
      statusElement,
      consoleOutput,
      iframeElement: iframeEl
    })

    // Initialize terminal
    uiService.updateStatus('Initializing terminal...')
    uiService.writeToConsole('Initializing terminal...')

    // Initialize terminal service with command processor
    terminalService.initialize(terminalElement, (command) => {
      return commandService.processCommand(command)
    })

    // Initialize WebContainer
    uiService.updateStatus('Initializing WebContainer...')
    uiService.writeToConsole('Initializing WebContainer environment...')

    await webContainerService.boot()

    // Setup file system for better permissions
    await webContainerService.setupFileSystem()

    // Register callbacks for command service
    commandService.registerFileSystemChangeCallback(() => {
      fileSystemService.refreshFileTree()
    })

    commandService.registerServerStartCallback((url) => {
      uiService.updateIframeUrl(url)
      uiService.updateStatus(`Dev server running at ${url}`)
      uiService.writeToConsole(`Server started at ${url}. Preview is now visible in the preview pane.`)
    })

    // Set up event listeners
    loadButton.addEventListener('click', loadRepository)

    // Initialize file tree
    initializeFileTree()

    // Setup refresh button
    const refreshButton = document.getElementById('refresh-files')
    refreshButton.addEventListener('click', () => {
      fileSystemService.refreshFileTree()
    })

    uiService.writeToConsole('WebContainer initialized successfully.')
    terminalService.write('WebContainer ready. Type commands here.')
    uiService.writeToConsole('Enter a GitHub repository URL above and click "Load Repo" to begin.')
    uiService.updateStatus('Ready')
  } catch (error) {
    console.error('Failed to initialize WebContainer:', error)
    uiService.writeToConsole(`Error: ${error.message}`, true)
    uiService.updateStatus('Failed to initialize')
  }
})

// Initialize the file tree
function initializeFileTree() {
  if (!webContainerService.instance) return

  // Create the file tree
  const fileTree = createFileTree({
    webcontainerInstance: webContainerService.instance,
    rootPath: '/',
    onFileSelect: (path) => {
      fileSystemService.viewFile(path)
    },
    onDirectoryChange: (path) => {
      fileSystemService.setCurrentPath(path)
      uiService.updateStatus(`Viewing directory: ${path}`)
    }
  })

  // Store file tree in service
  fileSystemService.setFileTree(fileTree)

  // Add the file tree to the DOM
  fileExplorer.innerHTML = ''
  fileExplorer.appendChild(fileTree.getContainer())
}

// Function to load a GitHub repository
async function loadRepository() {
  const repoUrl = repoUrlInput.value.trim()

  if (!repoUrl) {
    uiService.writeToConsole('Please enter a GitHub repository URL.', true)
    return
  }

  if (!gitHubService.isValidGitHubUrl(repoUrl)) {
    uiService.writeToConsole('Invalid GitHub URL format. Expected: https://github.com/user/repo', true)
    return
  }

  try {
    uiService.updateStatus('Loading repository...')
    uiService.writeToConsole(`Cloning repository: ${repoUrl}`)

    // Check GitHub API rate limit
    const rateLimit = await gitHubService.checkRateLimit()
    if (rateLimit !== null && rateLimit < 2) {
      uiService.writeToConsole('Error: GitHub API rate limit exceeded. Please try again later.', true)
      uiService.updateStatus('Rate limit exceeded')
      return
    }

    // Extract repository information
    const { user, repo } = gitHubService.extractRepoInfo(repoUrl)
    uiService.writeToConsole(`Repository owner: ${user}, Repository name: ${repo}`)

    // Fetch repository contents with progress callback
    await gitHubService.fetchAndLoadRepository(user, repo, (message, isError) => {
      uiService.writeToConsole(message, isError)
      uiService.updateStatus(message)
    })

    // Re-initialize the file tree
    initializeFileTree()

    // Check if package.json exists and notify user
    const rootFiles = await webContainerService.instance.fs.readdir('/')
    const hasPackageJson = rootFiles.includes('package.json')
    if (hasPackageJson) {
      uiService.writeToConsole('\npackage.json found. You can install dependencies with "npm install".')
    }

    // Setup terminal ready for commands
    terminalService.write('Repository loaded successfully. You can now run commands.')
    uiService.updateStatus('Repository loaded successfully')
  } catch (error) {
    console.error('Failed to load repository:', error)
    uiService.writeToConsole(`Error loading repository: ${error.message}`, true)
    uiService.updateStatus('Failed to load repository')
  }
}
