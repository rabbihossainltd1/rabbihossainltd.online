import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const htmlFiles = [];
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.html')) htmlFiles.push(entry.name);
  else if (entry.isDirectory() && !['.git', 'node_modules', 'audit', 'css', 'js', 'images', 'fonts', 'docs', 'scripts'].includes(entry.name)) {
    const nested = path.join(entry.name, 'index.html');
    if (fs.existsSync(path.join(root, nested))) htmlFiles.push(nested);
  }
}
const errors = [];

function checkCss(file) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  let depth = 0;
  let quote = null;
  let comment = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (comment) {
      if (char === '*' && next === '/') { comment = false; i += 1; }
      continue;
    }
    if (!quote && char === '/' && next === '*') { comment = true; i += 1; continue; }
    if (quote) {
      if (char === '\\') { i += 1; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth < 0) errors.push(`${file}: unexpected closing brace`);
  }
  if (depth !== 0) errors.push(`${file}: unbalanced CSS braces (${depth})`);
}

for (const file of ['css/style.css', 'css/v3-overrides.css', 'css/style.min.css']) checkCss(file);
for (const file of ['entity.json']) {
  try { JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); }
  catch (error) { errors.push(`${file}: invalid JSON (${error.message})`); }
}

const attrRegex = /\b(?:href|src)=["']([^"']+)["']/gi;
for (const htmlFile of htmlFiles) {
  const text = fs.readFileSync(path.join(root, htmlFile), 'utf8');
  if (/no-inspect\.js/i.test(text)) errors.push(`${htmlFile}: no-inspect.js must not be loaded`);
  if (/\bkeys\//i.test(text)) errors.push(`${htmlFile}: public key-file reference found`);

  for (const match of text.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(match[1]); }
    catch (error) { errors.push(`${htmlFile}: invalid JSON-LD (${error.message})`); }
  }

  for (const match of text.matchAll(attrRegex)) {
    const value = match[1].trim();
    if (!value || value.includes('${') || value.startsWith('#') || /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(value)) continue;
    const clean = value.split(/[?#]/)[0];
    if (!clean || clean.startsWith('/')) continue;
    const target = path.resolve(root, path.dirname(htmlFile), clean);
    if (!target.startsWith(root)) continue;
    if (!fs.existsSync(target)) errors.push(`${htmlFile}: missing local asset ${clean}`);
  }
}

const trackedSourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'audit'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else trackedSourceFiles.push(full);
  }
}
walk(root);

const secretRules = [
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/],
  ['PEM private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['service account private key', /["']private_key["']\s*:/],
  ['public fulfilment path', /(?:^|["'`/])keys\/(?:ios|drip|br)\//i]
];
for (const file of trackedSourceFiles) {
  let content;
  try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }
  for (const [name, rule] of secretRules) {
    if (rule.test(content)) errors.push(`${path.relative(root, file)}: ${name}`);
  }
}

if (errors.length) {
  console.error('Site validation failed:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Site validation passed (${htmlFiles.length} HTML files).`);
