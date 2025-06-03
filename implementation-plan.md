# Implementation Plan: CodeSandbox SDK Integration for Codex CLI

This plan outlines the steps to integrate the CodeSandbox SDK into the `coderx` application, enabling the execution of the OpenAI Codex CLI on the content of a loaded GitHub repository within a CodeSandbox Sandbox VM.

## Phase 1: Setup and Initialization

1.  **Install CodeSandbox SDK:**
    *   Add `@codesandbox/sdk` as a project dependency.
    *   Command: `npm install @codesandbox/sdk` or `yarn add @codesandbox/sdk`.
    *   Status: To Do

2.  **Configure API Key:**
    *   Determine a secure method to provide the CodeSandbox API key to the frontend (e.g., environment variables `REACT_APP_CSB_API_KEY`). **Note:** Exposing API keys directly in client-side code is insecure for production; a backend proxy might be needed eventually.
    *   Status: To Do

3.  **Integrate SDK Initialization:**
    *   In a relevant part of the application (e.g., `RepoBrowser.tsx` or a dedicated service module), initialize the SDK instance when needed.
    *   ```typescript
        import { CodeSandbox } from "@codesandbox/sdk";
        // Placeholder for API key retrieval
        const apiKey = process.env.REACT_APP_CSB_API_KEY;
        let sdk: CodeSandbox | null = null;
        if (apiKey) {
          sdk = new CodeSandbox(apiKey);
        } else {
          console.error("CodeSandbox API Key not configured.");
          // Handle error state appropriately
        }
        ```
    *   Status: To Do

## Phase 2: Sandbox Creation and Population

4.  **Trigger Sandbox Creation:**
    *   Modify the existing workflow in `RepoBrowser.tsx`. Instead of (or in addition to) displaying the tree/file, trigger the sandbox creation process after fetching repository info (default branch, file list).
    *   Add a button or modify the "Load Repo" action to initiate this.
    *   Status: To Do

5.  **Create CodeSandbox Sandbox:**
    *   Call `sdk.sandbox.create()` to instantiate a new Sandbox VM. Choose an appropriate base template if necessary (e.g., a minimal Node.js environment).
    *   Store the reference to the created `sandbox` instance.
    *   ```typescript
        const sandbox = await sdk.sandbox.create({ template: 'node' }); // Example template
        console.log(`Sandbox created with ID: ${sandbox.id}`);
        // Store sandbox instance, potentially in component state or context
        ```
    *   Status: To Do

6.  **Implement File Population Logic:**
    *   Reuse the fetched file list (`treeData.items` or raw list from GitHub API).
    *   Iterate through the files:
        *   Fetch raw file content from GitHub (`https://raw.githubusercontent.com/...`).
        *   Use the SDK's filesystem API (assuming `sandbox.fs.writeFile(path, content)`) to write each file into the Sandbox's filesystem (e.g., `/project/sandbox/${filePath}`).
        *   Implement error handling and potentially batching for large repositories.
    *   Status: To Do

## Phase 3: CLI Execution and Teardown

7.  **Execute Codex CLI:**
    *   Once files are populated, use the SDK's shell execution method (`sandbox.shells.run(command)`) to run the OpenAI Codex CLI.
    *   Construct the appropriate command, specifying input/output paths within the Sandbox filesystem.
    *   ```typescript
        const command = `openai-codex-cli --input /project/sandbox --output /results/codex_output.txt`; // Example
        const result = await sandbox.shells.run(command);
        console.log("Codex CLI Output:", result.output);
        // Handle errors, potentially stream stdout/stderr
        ```
    *   Status: To Do

8.  **Handle Output/Results:**
    *   Determine how to display or utilize the results from the Codex CLI execution (e.g., display output in the UI, potentially read result files back from the Sandbox filesystem using `sandbox.fs.readFile`).
    *   Status: To Do

9.  **Manage Sandbox Lifecycle:**
    *   Implement logic to hibernate (`sandbox.hibernate()`) or terminate the sandbox when it's no longer needed (e.g., user navigates away, closes session) to manage resources.
    *   Status: To Do

## Phase 4: UI and Testing

10. **Update UI:**
    *   Add UI elements to trigger the process (if not reusing existing ones).
    *   Display status updates (e.g., "Creating Sandbox...", "Populating files...", "Running Codex CLI...", "Done.").
    *   Display results or errors from the process.
    *   Status: To Do

11. **Testing:**
    *   Test with various small and medium-sized public repositories.
    *   Verify file population is correct.
    *   Confirm Codex CLI execution and output handling.
    *   Test error scenarios (invalid repo, API errors, CLI errors).
    *   Status: To Do
