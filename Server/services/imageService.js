// Server/services/imageService.js
'use strict';
const path  = require('path');
const fs    = require('fs/promises');
const sharp = require('sharp');
const crypto = require('crypto');

const PUBLIC_IMG = path.resolve(__dirname, '..', '..', 'Public', 'img');

const VARIANTS = [
  { key: 'lg', width: 1600, quality: 82 },
  { key: 'md', width:  800, quality: 80 },
  { key: 'sm', width:  400, quality: 78 },
];

const safeSlug = (s) =>
  String(s || '').toLowerCase()
    .replace(/[^\w\-]+/g, '-')
    .replace(/\-+/g, '-')
    .replace(/^\-+|\-+$/g, '');

async function ensureDirs(...dirs) {
  await Promise.all(dirs.map(d => fs.mkdir(d, { recursive: true })));
}

function ownerBase(type, ownerId) {
  if (type === 'producto')  return path.join(PUBLIC_IMG, 'products', String(ownerId));
  if (type === 'categoria') return path.join(PUBLIC_IMG, 'categories', String(ownerId));
  throw new Error('Tipo inválido');
}

// Convierte absoluta → /img/relative (porque "Public" está montado en "/")
function toPublicUrl(abs) {
  const rel = path.relative(path.resolve(PUBLIC_IMG, '..'), abs);
  return '/' + rel.replace(/\\/g, '/'); // -> /img/...
}

async function processAndSave({ buffer, originalName, mimetype, type, ownerId }) {
  const baseDir = ownerBase(type, ownerId);
  const subDirs = ['orig', ...VARIANTS.map(v => v.key)].map(k => path.join(baseDir, k));
  await ensureDirs(...subDirs);

  const baseName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeSlug(originalName)}`
                     .replace(/\.(jpe?g|png|gif)$/i, '');

  const isGif = /image\/gif/i.test(mimetype);
  const saved = [];

  if (isGif) {
    const origGif = path.join(baseDir, 'orig', `${baseName}.gif`);
    await fs.writeFile(origGif, buffer);
    saved.push(toPublicUrl(origGif));

    const smPreview = path.join(baseDir, 'sm', `${baseName}.webp`);
    await sharp(buffer, { animated: true })
      .rotate()
      .resize({ width: 400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(smPreview);
    saved.push(toPublicUrl(smPreview));
  } else {
    // Original comprimido como webp (opcional)
    const origWebp = path.join(baseDir, 'orig', `${baseName}.webp`);
    await sharp(buffer).rotate().webp({ quality: 85 }).toFile(origWebp);
    saved.push(toPublicUrl(origWebp));

    for (const v of VARIANTS) {
      const out = path.join(baseDir, v.key, `${baseName}.webp`);
      await sharp(buffer)
        .rotate()
        .resize({ width: v.width, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: v.quality })
        .toFile(out);
      saved.push(toPublicUrl(out));
    }
  }

  const canonical = saved.find(p => /\/md\//.test(p)) || saved[0];
  return { canonicalPath: canonical, allPaths: saved };
}

async function removeByCanonical(canonicalPath) {
  const abs = path.resolve(__dirname, '..', '..', canonicalPath.replace(/^\//, ''));
  const name = path.parse(abs).name;
  const ownerDir = path.dirname(path.dirname(abs)); // .../<owner>

  const candidates = [
    path.join(ownerDir, 'orig', `${name}.webp`),
    path.join(ownerDir, 'orig', `${name}.gif`),
    path.join(ownerDir, 'lg',   `${name}.webp`),
    path.join(ownerDir, 'md',   `${name}.webp`),
    path.join(ownerDir, 'sm',   `${name}.webp`)
  ];
  await Promise.all(candidates.map(async p => { try { await fs.unlink(p); } catch {} }));
}

module.exports = { processAndSave, removeByCanonical };
