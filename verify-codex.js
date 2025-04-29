#!/usr/bin/env node

import { readdir, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Get the current directory
const currentDir = process.cwd();

async function findFile(dir, filename, maxDepth = 3, currentDepth = 0) {
  if (currentDepth > maxDepth) return null;

  try {
    const files = await readdir(dir);

    for (const file of files) {
      if (file === '.git' || file === 'node_modules') continue;

      const filePath = join(dir, file);
      const stats = await stat(filePath);

      if (stats.isDirectory()) {
        const found = await findFile(filePath, filename, maxDepth, currentDepth + 1);
        if (found) return found;
      } else if (file === filename || file.includes(filename)) {
        return filePath;
      }
    }
  } catch (error) {
    console.error(`Error searching in directory ${dir}:`, error.message);
  }

  return null;
}

async function locateCodexLacy() {
  console.log('--- Codex-Lacy Verification Tool ---');
  console.log(`Current working directory: ${currentDir}`);

  // Check in node_modules
  console.log('\nChecking node_modules for codex-lacy:');
  const nodeModulesPath = join(currentDir, 'node_modules');

  try {
    // Check if node_modules/codex-lacy exists
    const codexPath = join(nodeModulesPath, 'codex-lacy');
    const codexStats = await stat(codexPath).catch(() => null);

    if (codexStats && codexStats.isDirectory()) {
      console.log(`✅ Found codex-lacy at: ${codexPath}`);

      // Check for bin directory
      const binPath = join(codexPath, 'bin');
      const binStats = await stat(binPath).catch(() => null);

      if (binStats && binStats.isDirectory()) {
        const binFiles = await readdir(binPath);
        console.log(`✅ Found bin directory with files: ${binFiles.join(', ')}`);

        const mainScript = binFiles.find(f => f.includes('codex-lacy'));
        if (mainScript) {
          const mainScriptPath = join(binPath, mainScript);
          console.log(`✅ Main executable: ${mainScriptPath}`);

          // Try to run with node directly
          console.log('\nTrying to execute:');
          console.log(`node ${mainScriptPath} --version`);

          try {
            const output = execSync(`node "${mainScriptPath}" --version`, { encoding: 'utf8' });
            console.log(`✅ Execution successful: ${output.trim()}`);
          } catch (error) {
            console.error('❌ Execution failed:', error.message);
          }

          return mainScriptPath;
        }
      } else {
        console.log('❌ bin directory not found');
      }

      // Look for index.js or main file
      const packageJsonPath = join(codexPath, 'package.json');
      try {
        const packageJson = JSON.parse(await readdir(packageJsonPath, 'utf8'));
        if (packageJson.main) {
          console.log(`✅ Main file defined in package.json: ${packageJson.main}`);
          return join(codexPath, packageJson.main);
        }
      } catch (error) {
        console.log(`❌ Couldn't read package.json: ${error.message}`);
      }

      // Search for any .js files
      const foundFiles = await findFile(codexPath, '.js', 2);
      if (foundFiles) {
        console.log(`✅ Found JS file: ${foundFiles}`);
        return foundFiles;
      }
    } else {
      console.log('❌ codex-lacy not found in node_modules');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Check in node_modules/.bin
  try {
    const binDir = join(nodeModulesPath, '.bin');
    const binStats = await stat(binDir).catch(() => null);

    if (binStats && binStats.isDirectory()) {
      console.log(`\nChecking ${binDir}:`);
      const binFiles = await readdir(binDir);
      console.log(`Found files: ${binFiles.join(', ')}`);

      const codexBin = binFiles.find(f => f === 'codex-lacy' || f.includes('codex-lacy'));
      if (codexBin) {
        console.log(`✅ Found codex-lacy binary: ${join(binDir, codexBin)}`);
        return join(binDir, codexBin);
      } else {
        console.log('❌ codex-lacy binary not found in .bin');
      }
    } else {
      console.log('❌ .bin directory not found');
    }
  } catch (error) {
    console.error('Error checking .bin:', error.message);
  }

  return null;
}

// Run the locator
locateCodexLacy().then(path => {
  if (path) {
    console.log('\n=== RESULTS ===');
    console.log(`Found codex-lacy at: ${path}`);
    console.log('\nTo run codex-lacy, use one of these commands:');
    console.log(`1. node ${path}`);
    console.log('2. npm run codex');
    console.log('3. npm run run-codex');
  } else {
    console.log('\n=== RESULTS ===');
    console.log('❌ Could not locate codex-lacy executable');
    console.log('\nTry reinstalling with:');
    console.log('npm install codex-lacy --save');
  }
});
