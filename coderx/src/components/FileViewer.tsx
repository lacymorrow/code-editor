import { useState, useEffect } from "react";

interface FileViewerProps {
  selectedFile: string | null;
  repoInfo: {
    user: string;
    repo: string;
  } | null;
  defaultBranch: string | null;
}

export default function FileViewer({
  selectedFile,
  repoInfo,
  defaultBranch,
}: FileViewerProps) {
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFileContent() {
      if (!selectedFile || !repoInfo || !defaultBranch) {
        setFileContent(null);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setFileContent(null);

      try {
        const rawUrl = `https://raw.githubusercontent.com/${repoInfo.user}/${repoInfo.repo}/${defaultBranch}/${selectedFile}`;

        const response = await fetch(rawUrl);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`File not found: ${selectedFile}`);
          } else {
            throw new Error(
              `Failed to fetch file: ${response.status} ${response.statusText}`
            );
          }
        }

        const content = await response.text();
        setFileContent(content);
      } catch (err: any) {
        console.error("Error fetching file content:", err);
        setError(err.message || "Failed to fetch file content");
      } finally {
        setIsLoading(false);
      }
    }

    fetchFileContent();
  }, [selectedFile, repoInfo, defaultBranch]);

  if (!selectedFile) {
    return (
      <div className="file-viewer empty-state">
        <p>Select a file to view its contents</p>
      </div>
    );
  }

  return (
    <div className="file-viewer">
      <div className="file-viewer-header">
        <h3>{selectedFile}</h3>
      </div>

      <div className="file-viewer-content">
        {isLoading && <div className="loading">Loading file content...</div>}

        {error && <div className="error-message">Error: {error}</div>}

        {!isLoading && !error && fileContent && (
          <pre>
            <code>{fileContent}</code>
          </pre>
        )}

        {!isLoading && !error && !fileContent && (
          <div className="folder-message">Could not load file content.</div>
        )}
      </div>
    </div>
  );
}
