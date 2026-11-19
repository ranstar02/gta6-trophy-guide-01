// Leonida Trophy Atlas — entry program (Node 22, standard library only).
// Hands the guide in: copies this repo's app/ and screenshots/ into the output
// directory and writes dossier.json with the vendored make.fun library.
// The output directory is /output inside the grader; outside it, the
// MAKEFUN_OUTPUT_DIR environment variable stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The program is deterministic: same input files, same dossier bytes.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(source, target) {
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
}

function copyScreenshots() {
  const source = join(repoRoot, 'screenshots');
  const target = join(outputDir, 'screenshots');
  mkdirSync(target, { recursive: true });
  if (!existsSync(source)) return;
  const names = readdirSync(source).filter((name) => !name.startsWith('.')).sort();
  for (const name of names) {
    cpSync(join(source, name), join(target, name));
  }
}

mkdirSync(outputDir, { recursive: true });
copyTree(join(repoRoot, 'app'), join(outputDir, 'app'));
copyScreenshots();

// Caps from the competition's gate: at most 4 screenshots of 256 KiB, app/ at
// most 993 files/directories and 48 MiB, dossier text at most 163,840 bytes.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
