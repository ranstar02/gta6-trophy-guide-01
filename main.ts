// Leonida Ledger — the hand-in program for gta6-trophy-guide-01 (Node 22, stdlib only).
// It takes this repository's app/ and screenshots/ and lays them out in the output
// directory the grader reads, then writes dossier.json there with the vendored
// make.fun library. vendor/makefun-frontend.ts is the kit's copy and stays untouched:
// the scorer rebuilds the dossier with its own copy and compares the two byte for byte.
//
// Run it locally like this:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Do NOT delete the output directory itself: in the grader /output is a mount
// point on a read-only filesystem, so removing it fails (EBUSY/EROFS) and the
// run exits 1. The grader hands us an empty /output; just make sure it exists.
mkdirSync(outputDir, { recursive: true });

// The guide itself: every static file under app/.
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });

// The screenshots, first by name is the cover.
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The dossier the judge reads: screenshots, first-load totals, and the source outline.
// Caps are the scorer's own (reference/gate.json): at most 4 screenshots of 256 KiB,
// app/ at most 993 files and directories and 48 MiB, dossier text at most 160 KiB.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
  }),
);

console.log('wrote ' + join(outputDir, 'dossier.json'));
