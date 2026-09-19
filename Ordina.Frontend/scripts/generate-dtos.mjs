import { execSync } from 'node:child_process';
import fs from 'node:fs';

const COMMIT = '6d574fc';
const GIT_REPO = 'F:/Verkku/Camihogar';

const rawContent = execSync(`git -C "${GIT_REPO}" show ${COMMIT}:Ordina.Frontend/lib/api-client.ts`, {
  encoding: 'utf-8',
  maxBuffer: 20 * 1024 * 1024
});

// Extract all interfaces and types before `class ApiClient`
const classIdx = rawContent.indexOf('class ApiClient');
let dtosBlock = rawContent.slice(0, classIdx);

// Remove the Next.js process.env URLs and old imports from dtosBlock
dtosBlock = dtosBlock.replace(/import\s+.*?;/gs, '');
dtosBlock = dtosBlock.replace(/const\s+[A-Z_]+_API_URL_DIRECT\s*=.*?;/g, '');

// Now extract the methods of ApiClient
const clientBody = rawContent.slice(classIdx);
// We want to replace this.fetch(endpoint, ...) with apiFetch(endpoint, ...)
// and normalize endpoints: remove /api/proxy/ or microservice routing prefix

console.log('DTOs block length:', dtosBlock.length);
fs.writeFileSync('src/lib/api-client-dtos.ts', dtosBlock.trim() + '\n');
console.log('Written src/lib/api-client-dtos.ts');
