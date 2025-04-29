import './style.css'
import { WebContainer } from '@webcontainer/api'

// Initialize the WebContainer
let webcontainerInstance

// HTML elements
let terminal
let terminalOutput
let commandInput
let repoUrlInput
let loadButton
let statusElement
let iframeEl

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
        <div id="status" class="status"></div>
      </div>
      <div class="main">
        <div class="terminal">
          <div id="terminal-output" class="terminal-output"></div>
          <div class="terminal-input">
            <span>$</span>
            <input type="text" id="command" placeholder="Enter command...">
          </div>
        </div>
        <div class="preview">
          <iframe src="loading.html"></iframe>
        </div>
      </div>
    </div>
  `

  // Cache important DOM elements
  terminal = document.querySelector('.terminal')
  terminalOutput = document.getElementById('terminal-output')
  commandInput = document.getElementById('command')
  repoUrlInput = document.getElementById('repo-url')
  loadButton = document.getElementById('load-repo')
  statusElement = document.getElementById('status')
  iframeEl = document.querySelector('iframe')

  try {
    // Initialize the WebContainer
    webcontainerInstance = await WebContainer.boot()

    // Set up event listeners
    commandInput.addEventListener('keydown', handleCommand)
    loadButton.addEventListener('click', loadRepository)

    writeToTerminal('WebContainer initialized successfully.')
    writeToTerminal('Enter a GitHub repository URL and click "Load Repo" to begin.')
  } catch (error) {
    console.error('Failed to initialize WebContainer:', error)
    writeToTerminal(`Error: ${error.message}`, true)
  }
})

// Function to load a GitHub repository
async function loadRepository() {
  const repoUrl = repoUrlInput.value.trim()

  if (!repoUrl) {
    writeToTerminal('Please enter a GitHub repository URL.', true)
    return
  }

  if (!isValidGitHubUrl(repoUrl)) {
    writeToTerminal('Invalid GitHub URL format. Expected: https://github.com/user/repo', true)
    return
  }

  try {
    updateStatus('Loading repository...')
    writeToTerminal(`Cloning repository: ${repoUrl}`)

    // Check GitHub API rate limit
    const rateLimit = await checkRateLimit()
    if (rateLimit !== null && rateLimit < 2) {
      writeToTerminal('Error: GitHub API rate limit exceeded. Please try again later.', true)
      updateStatus('Rate limit exceeded')
      return
    }

    // Extract repository information
    const { user, repo } = extractRepoInfo(repoUrl)
    writeToTerminal(`Repository owner: ${user}, Repository name: ${repo}`)

    // Fetch repository contents
    await fetchAndLoadRepository(user, repo)
  } catch (error) {
    console.error('Failed to load repository:', error)
    writeToTerminal(`Error loading repository: ${error.message}`, true)
    updateStatus('Failed to load repository')
  }
}

// Function to check if a URL is a valid GitHub URL
function isValidGitHubUrl(url) {
  const githubRegex = /^https:\/\/github\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-_.]+\/?$/
  return githubRegex.test(url)
}

// Function to check GitHub API rate limit
async function checkRateLimit() {
  try {
    const response = await fetch('https://api.github.com/rate_limit')
    if (response.ok) {
      const data = await response.json()
      const remaining = data.resources.core.remaining
      const resetTime = new Date(data.resources.core.reset * 1000)

      if (remaining < 5) {
        writeToTerminal(`Warning: GitHub API rate limit low (${remaining} requests remaining). Limit resets at ${resetTime.toLocaleTimeString()}.`, true)
      }

      return remaining
    }
  } catch (error) {
    console.error('Failed to check rate limit:', error)
  }
  return null
}

// Function to extract owner and repo name from GitHub URL
function extractRepoInfo(url) {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/)
  if (!match || match.length < 3) {
    throw new Error('Invalid GitHub URL format')
  }

  return {
    user: match[1],
    repo: match[2].replace(/\/$/, '') // Remove trailing slash if present
  }
}

// Function to fetch repository contents and load them into WebContainer
async function fetchAndLoadRepository(user, repo) {
  try {
    // Clear previous files if any
    await webcontainerInstance.fs.rm('/', { recursive: true, force: true }).catch(() => {})

    // Fetch the repository info to get default branch
    updateStatus('Fetching repository information...')
    const repoResponse = await fetch(`https://api.github.com/repos/${user}/${repo}`)

    if (!repoResponse.ok) {
      const errorText = await repoResponse.text();
      console.error('GitHub API Error:', repoResponse.status, errorText);
      throw new Error(`Failed to fetch repository: ${repoResponse.status} ${repoResponse.statusText}. Make sure the repository exists and is public.`)
    }

    const repoData = await repoResponse.json()
    const defaultBranch = repoData.default_branch

    // Fetch the file tree
    updateStatus('Fetching repository tree...')
    writeToTerminal(`Fetching file tree from branch: ${defaultBranch}`)

    const treeResponse = await fetch(`https://api.github.com/repos/${user}/${repo}/git/trees/${defaultBranch}?recursive=1`)

    if (!treeResponse.ok) {
      const errorText = await treeResponse.text();
      console.error('GitHub API Tree Error:', treeResponse.status, errorText);
      throw new Error(`Failed to fetch file tree: ${treeResponse.status} ${treeResponse.statusText}. The repository might be too large.`)
    }

    const treeData = await treeResponse.json()

    // Check if we got truncated results (large repository)
    if (treeData.truncated) {
      writeToTerminal('Warning: Repository is too large and file list is truncated. Some files may not be loaded.', true)
    }

    // Download and write files to WebContainer
    updateStatus('Downloading files...')
    writeToTerminal('Downloading repository files...')

    const files = treeData.tree.filter(item => item.type === 'blob')
    let processedFiles = 0
    const totalFiles = files.length

    // Process files in batches to avoid overwhelming the browser
    const BATCH_SIZE = 10
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE)
      await Promise.all(batch.map(async file => {
        try {
          const filePath = file.path
          const fileUrl = `https://raw.githubusercontent.com/${user}/${repo}/${defaultBranch}/${filePath}`

          // Fetch the file content
          const contentResponse = await fetch(fileUrl)

          if (!contentResponse.ok) {
            console.warn(`Failed to fetch file ${filePath}: ${contentResponse.status} ${contentResponse.statusText}`)
            return // Skip this file and continue with others
          }

          // Check if we need to create parent directories
          const dirPath = filePath.split('/').slice(0, -1).join('/')
          if (dirPath) {
            await webcontainerInstance.fs.mkdir(dirPath, { recursive: true })
          }

          // Write the file to WebContainer
          const content = await contentResponse.text()
          await webcontainerInstance.fs.writeFile(filePath, content)

          processedFiles++
          if (processedFiles % 10 === 0 || processedFiles === totalFiles) {
            updateStatus(`Downloading files... (${processedFiles}/${totalFiles})`)
          }
        } catch (error) {
          console.error(`Error processing file ${file.path}:`, error)
          // Continue with other files even if one fails
        }
      }))
    }

    writeToTerminal(`Downloaded ${processedFiles} files successfully.`)
    updateStatus('Repository loaded successfully')

    // List the files in the root directory
    writeToTerminal('Files in the repository:')
    const files2 = await webcontainerInstance.fs.readdir('/')
    writeToTerminal(files2.join('\n'))

    // Check if package.json exists
    const hasPackageJson = files2.includes('package.json')
    if (hasPackageJson) {
      writeToTerminal('\npackage.json found. You can install dependencies with "npm install".')
    }

    // Setup terminal ready for commands
    writeToTerminal('\nRepository loaded successfully. You can now run commands.')
  } catch (error) {
    console.error('Error in fetchAndLoadRepository:', error)
    writeToTerminal(`Error: ${error.message}`, true)
    updateStatus('Failed to load repository')
  }
}

// Function to handle command execution
async function handleCommand(event) {
  if (event.key !== 'Enter') return

  const command = commandInput.value.trim()
  if (!command) return

  // Clear the input
  commandInput.value = ''

  // Display the command in the terminal
  writeToTerminal(`$ ${command}`)

  try {
    if (!webcontainerInstance) {
      throw new Error('WebContainer not initialized')
    }

    // Parse the command
    const [cmd, ...args] = command.split(' ')

    // Special handling for npm start, dev, etc. to connect to the preview
    if (cmd === 'npm' && ['start', 'run'].includes(args[0])) {
      await runDevServer(command)
    } else {
      // For other commands
      await runCommand(cmd, args)
    }
  } catch (error) {
    console.error('Command execution failed:', error)
    writeToTerminal(`Error: ${error.message}`, true)
  }
}

// Function to run npm start/dev commands and connect to preview
async function runDevServer(fullCommand) {
  try {
    updateStatus('Starting dev server...')
    writeToTerminal('Starting development server...')

    // Start the server process
    const process = await webcontainerInstance.spawn('sh', ['-c', fullCommand])

    // Listen for server output
    process.output.pipeTo(new WritableStream({
      write(data) {
        writeToTerminal(data)
      }
    }))

    // Wait for the server-ready event
    webcontainerInstance.on('server-ready', (port, url) => {
      iframeEl.src = url
      updateStatus(`Dev server running at ${url}`)
      writeToTerminal(`Server started at ${url}`)
    })
  } catch (error) {
    console.error('Failed to start dev server:', error)
    writeToTerminal(`Error starting server: ${error.message}`, true)
  }
}

// Function to run general commands
async function runCommand(cmd, args) {
  try {
    // Spawn the process
    const process = await webcontainerInstance.spawn(cmd, args)

    // Store the exit code
    const exitCode = await process.exit

    // Get the output
    const output = await process.output.getReader().read()
    const outputText = new TextDecoder().decode(output.value)

    // Write the output to the terminal
    if (outputText) {
      writeToTerminal(outputText)
    }

    // Display the exit code
    writeToTerminal(`Process exited with code ${exitCode}`)
  } catch (error) {
    console.error('Command execution error:', error)
    writeToTerminal(`Error: ${error.message}`, true)
  }
}

// Function to write to the terminal
function writeToTerminal(text, isError = false) {
  const line = document.createElement('div')
  line.textContent = text
  if (isError) {
    line.style.color = '#e74c3c'
  }
  terminalOutput.appendChild(line)
  terminalOutput.scrollTop = terminalOutput.scrollHeight
}

// Function to update status message
function updateStatus(message) {
  statusElement.textContent = message
}
