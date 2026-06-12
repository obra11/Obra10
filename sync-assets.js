const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'obra10-frontend', 'dist');
const destDir = path.join(__dirname, 'obra10-backend', 'client');

/**
 * Deletes a directory and its contents recursively.
 */
function deleteFolderRecursive(directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file) => {
      const curPath = path.join(directoryPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(directoryPath);
  }
}

/**
 * Copies a directory recursively.
 */
function copyFolderRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.readdirSync(src).forEach((file) => {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    if (fs.lstatSync(srcPath).isDirectory()) {
      copyFolderRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

console.log('🧹 Clearing old backend static assets...');
try {
  deleteFolderRecursive(destDir);
} catch (err) {
  console.warn('⚠️ Warning: Could not fully clear client folder. Proceeding copy anyway.', err.message);
}

console.log('🚚 Copying new frontend build output to backend static client folder...');
if (fs.existsSync(srcDir)) {
  try {
    copyFolderRecursive(srcDir, destDir);
    console.log('✅ Success: Frontend assets successfully synchronized to backend!');
  } catch (err) {
    console.error('❌ Error copying assets:', err.message);
    process.exit(1);
  }
} else {
  console.error('❌ Error: Frontend build directory (obra10-frontend/dist) not found.');
  console.error('Please run "npm run build:frontend" first.');
  process.exit(1);
}
