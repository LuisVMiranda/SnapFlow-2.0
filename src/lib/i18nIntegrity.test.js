import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve('.');
const SCANNED_DIRS = ['src', 'backend/src', 'backend/test'];
const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.jsx', '.json', '.md', '.sql']);
const MOJIBAKE_PATTERNS = [
  { label: 'UTF-8 lido como Latin-1', regex: new RegExp('\\u00c3[\\u0080-\\u00bf]') },
  { label: 'byte extra de Latin-1', regex: new RegExp('\\u00c2[\\u0080-\\u00bf]') },
  { label: 'pontuação UTF-8 quebrada', regex: new RegExp('\\u00e2[\\u0080-\\u20ff]') },
  { label: 'emoji quebrado', regex: new RegExp('\\u00f0\\u0178') },
];

function listTextFiles(dir) {
  const absoluteDir = path.join(ROOT, dir);
  if (!fs.existsSync(absoluteDir)) return [];

  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(absoluteDir, entry.name);
    const relativePath = path.relative(ROOT, absolutePath);
    if (entry.isDirectory()) return listTextFiles(relativePath);
    return TEXT_EXTENSIONS.has(path.extname(entry.name)) ? [absolutePath] : [];
  });
}

describe('integridade de texto em português', () => {
  it('não contém padrões comuns de mojibake nos arquivos de texto editáveis', () => {
    const findings = [];
    for (const file of SCANNED_DIRS.flatMap(listTextFiles)) {
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of MOJIBAKE_PATTERNS) {
        if (pattern.regex.test(content)) {
          findings.push(`${path.relative(ROOT, file)}: ${pattern.label}`);
        }
      }
    }

    expect(findings).toEqual([]);
  });

  it('declara favicon e UTF-8 no HTML principal', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect(html).toContain('<meta charset="UTF-8" />');
    expect(html).toContain('href="/favicon.png"');
    expect(html).toContain('href="/apple-touch-icon.png"');
  });
});
