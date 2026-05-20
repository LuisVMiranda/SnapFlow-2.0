import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const workspaceRoot = path.resolve('.');
const productionRoots = ['src', path.join('backend', 'src')].map((root) => path.join(workspaceRoot, root));
const sourceExtensions = new Set(['.css', '.js', '.jsx']);
const mojibakePieces = [
  String.fromCharCode(0x00c3),
  String.fromCharCode(0x00c2),
  String.fromCharCode(0x00e2, 0x20ac, 0x00a2),
];
const unaccentedPortuguesePieces = [
  '\\bNao\\b',
  '\\bnao\\b',
  '\\bpossivel\\b',
  '\\bedicao\\b',
  '\\bDescricao\\b',
  '\\bCodigo\\b',
  '\\bConfiguracoes\\b',
  '\\bSessao\\b',
  '\\bliberacao\\b',
  '\\bnumero\\b',
  '\\bdigitos\\b',
  '\\bvalido\\b',
  '\\bparametro\\b',
  '\\bpadrao\\b',
  '\\beditavel\\b',
  '\\breaplicacao\\b',
  '\\balteracoes\\b',
  '\\bserao\\b',
  '\\balem\\b',
  '\\bapos\\b',
];
const forbiddenUiTextPattern = new RegExp([...mojibakePieces, ...unaccentedPortuguesePieces].join('|'));

function listSourceFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist'].includes(entry.name)) continue;
      listSourceFiles(fullPath, results);
      continue;
    }
    if (!sourceExtensions.has(path.extname(entry.name))) continue;
    results.push(fullPath);
  }
  return results;
}

function relativePath(file) {
  return path.relative(workspaceRoot, file).replaceAll(path.sep, '/');
}

describe('qualidade dos arquivos de UI e backend', () => {
  it('mantém arquivos-fonte abaixo de 600 linhas', () => {
    const oversized = productionRoots
      .flatMap((root) => listSourceFiles(root))
      .map((file) => ({
        file: relativePath(file),
        lines: fs.readFileSync(file, 'utf8').split(/\r?\n/).length,
      }))
      .filter(({ lines }) => lines > 600);

    expect(oversized).toEqual([]);
  });

  it('mantém textos visíveis e mensagens sem mojibake ou português sem acento', () => {
    const offenders = productionRoots
      .flatMap((root) => listSourceFiles(root))
      .filter((file) => !file.includes('.test.'))
      .flatMap((file) => {
        const content = fs.readFileSync(file, 'utf8');
        return content.split(/\r?\n/).flatMap((line, index) => (
          forbiddenUiTextPattern.test(line)
            ? [`${relativePath(file)}:${index + 1}: ${line.trim()}`]
            : []
        ));
      });

    expect(offenders).toEqual([]);
  });
});
