import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const COMMIT = '6d574fc';
const GIT_REPO = 'F:/Verkku/Camihogar';

export function extractDir(sourceDir, targetDir) {
  const fullTarget = path.resolve(targetDir);
  if (!fs.existsSync(fullTarget)) {
    fs.mkdirSync(fullTarget, { recursive: true });
  }

  const listCmd = `git -C "${GIT_REPO}" ls-tree -r --name-only ${COMMIT} "${sourceDir}"`;
  const rawList = execSync(listCmd, { encoding: 'utf-8' }).trim();
  if (!rawList) {
    console.log(`No files found for ${sourceDir}`);
    return;
  }

  const files = rawList.split(/\r?\n/).filter(Boolean);
  console.log(`Found ${files.length} files in ${sourceDir}`);

  for (const file of files) {
    const relPath = file.slice(sourceDir.length).replace(/^\/+/, '');
    const targetFile = path.join(fullTarget, relPath);
    const targetFolder = path.dirname(targetFile);
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    const showCmd = `git -C "${GIT_REPO}" show "${COMMIT}:${file}"`;
    const content = execSync(showCmd, { maxBuffer: 10 * 1024 * 1024 });
    fs.writeFileSync(targetFile, content);
    console.log(`Extracted: ${file} -> ${targetFile}`);
  }
}

export function extractFile(sourceFile, targetFile) {
  const fullTarget = path.resolve(targetFile);
  const targetFolder = path.dirname(fullTarget);
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  const showCmd = `git -C "${GIT_REPO}" show "${COMMIT}:${sourceFile}"`;
  const content = execSync(showCmd, { maxBuffer: 10 * 1024 * 1024 });
  fs.writeFileSync(fullTarget, content);
  console.log(`Extracted file: ${sourceFile} -> ${fullTarget}`);
}

const action = process.argv[2];
if (action === 'ui') {
  extractDir('Ordina.Frontend/components/ui', 'src/components/ui');
} else if (action === 'dir') {
  extractDir(process.argv[3], process.argv[4]);
} else if (action === 'file') {
  extractFile(process.argv[3], process.argv[4]);
}
