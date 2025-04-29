import { createFileTree as createFileTreeComponent } from './components/FileTreeComponent';

/**
 * FileTree component using FileTreeComponent
 * This simply re-exports the createFileTree function from our components directory
 * for backward compatibility.
 */
export function createFileTree(props) {
  return createFileTreeComponent(props);
}