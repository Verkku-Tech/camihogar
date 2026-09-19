import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const COMMIT = '6d574fc';
const GIT_REPO = 'F:/Verkku/Camihogar';

const content = execSync(`git -C "${GIT_REPO}" show ${COMMIT}:Ordina.Frontend/lib/storage.ts`, {
  encoding: 'utf-8',
  maxBuffer: 20 * 1024 * 1024
});

const lines = content.split(/\r?\n/);
const typeBlocks = [];
let capturing = false;
let braceCount = 0;
let currentBlock = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!capturing && /^export (interface|type) \w+/.test(line)) {
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

console.log('Found ' + typeBlocks.length + ' type blocks');
fs.mkdirSync('src/types', { recursive: true });
fs.writeFileSync(
  'src/types/index.ts',
  'import type { Currency, ExchangeRate } from "@/lib/currency-utils";\n\n' +
    typeBlocks.join('\n\n') +
    '\n'
);
console.log('Written src/types/index.ts');
