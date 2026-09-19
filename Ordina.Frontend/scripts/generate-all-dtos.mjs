import { execSync } from 'node:child_process';
import fs from 'node:fs';

const COMMIT = '6d574fc';
const GIT_REPO = 'F:/Verkku/Camihogar';

const rawContent = execSync(`git -C "${GIT_REPO}" show ${COMMIT}:Ordina.Frontend/lib/api-client.ts`, {
  encoding: 'utf-8',
  maxBuffer: 20 * 1024 * 1024
});

const lines = rawContent.split(/\r?\n/);
const typeBlocks = [];
let capturing = false;
let braceCount = 0;
let currentBlock = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!capturing && /^export (interface|type) \w+/.test(line)) {
    // Avoid re-declaring ApiError interface
    if (line.includes('interface ApiError')) continue;
    capturing = true;
    currentBlock = [line];
    braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
    if (line.includes(';') && !line.includes('{')) {
      typeBlocks.push(currentBlock.join('\n'));
      capturing = false;
      currentBlock = [];
    }
  } else if (capturing) {
    currentBlock.push(line);
    braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
    if (braceCount <= 0 && (line.trim().endsWith('}') || line.trim().endsWith('};') || line.trim().endsWith(';'))) {
      typeBlocks.push(currentBlock.join('\n'));
      capturing = false;
      currentBlock = [];
    }
  }
}

console.log('Found ' + typeBlocks.length + ' DTO type blocks');
fs.writeFileSync(
  'src/lib/api-client-dtos.ts',
  typeBlocks.join('\n\n') + '\n'
);
console.log('Written src/lib/api-client-dtos.ts');
