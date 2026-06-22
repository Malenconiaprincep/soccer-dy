import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative } from 'node:path';
import { HttpMethodType, TosClient } from '@volcengine/tos-sdk';
import { loadEnv } from './cloudbase-env.mjs';

const DEFAULT_ASSET_DIR = 'public/assets';
const DEFAULT_PREFIX = 'soccer-dy3/assets';
const DEFAULT_MANIFEST = 'douyin-assets-manifest.json';
const CONCURRENCY = 6;

const args = parseArgs(process.argv.slice(2));
const env = loadEnv();
const assetDir = args['assets-dir'] ?? DEFAULT_ASSET_DIR;
const bucket = required(args.bucket ?? args['tos-bucket'] ?? env.TOS_BUCKET ?? env.DOUYIN_TOS_BUCKET, 'TOS_BUCKET', '--bucket');
const endpoint = cleanEndpoint(required(args.endpoint ?? args['tos-endpoint'] ?? env.TOS_ENDPOINT ?? env.DOUYIN_TOS_ENDPOINT, 'TOS_ENDPOINT', '--endpoint'));
const region = required(args.region ?? args['tos-region'] ?? env.TOS_REGION ?? env.DOUYIN_TOS_REGION, 'TOS_REGION', '--region');
const accessKeyId = required(args['access-key-id'] ?? args['tos-access-key-id'] ?? env.TOS_ACCESS_KEY_ID ?? env.DOUYIN_TOS_ACCESS_KEY_ID, 'TOS_ACCESS_KEY_ID', '--access-key-id');
const secretAccessKey = normalizeSecretAccessKey(
  required(args['secret-access-key'] ?? args['tos-secret-access-key'] ?? env.TOS_SECRET_ACCESS_KEY ?? env.DOUYIN_TOS_SECRET_ACCESS_KEY, 'TOS_SECRET_ACCESS_KEY', '--secret-access-key'),
  args['secret-access-key-encoding'] ?? env.TOS_SECRET_ACCESS_KEY_ENCODING
);
const prefix = cleanPrefix(args.prefix ?? env.TOS_ASSET_PREFIX ?? env.DOUYIN_TOS_ASSET_PREFIX ?? DEFAULT_PREFIX);
const manifestPath = args.manifest ?? DEFAULT_MANIFEST;
const publicBaseUrl = cleanPublicBaseUrl(args['public-base-url'] ?? env.TOS_PUBLIC_BASE_URL ?? env.DOUYIN_TOS_PUBLIC_BASE_URL);
const shouldConfigureCors = args['configure-cors'] === '1';
const objectAcl = args.acl ?? env.TOS_OBJECT_ACL ?? 'public-read';
const limit = Number(args.limit ?? 0);

if (!existsSync(assetDir)) {
  console.error(`资源目录不存在：${assetDir}`);
  process.exit(1);
}

const host = `${bucket}.${endpoint}`;
const client = new TosClient({
  accessKeyId,
  accessKeySecret: secretAccessKey,
  endpoint,
  region,
  bucket,
  secure: true,
  enableCRC: false
});
const files = listFiles(assetDir).slice(0, limit > 0 ? limit : undefined);
const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
console.log(`准备上传 ${files.length} 个资源，${formatBytes(totalBytes)} -> tos://${bucket}/${prefix}/`);

if (shouldConfigureCors) {
  await putBucketCors();
  console.log('已写入 bucket CORS 配置：允许 GET/HEAD/OPTIONS 跨域读取。');
}

const uploaded = [];
let completed = 0;

await runPool(files, CONCURRENCY, async (file) => {
  const objectKey = `${prefix}/${toPosix(file.relativePath)}`;
  const body = readFileSync(file.absolutePath);
  await putObject(objectKey, body, {
    'content-type': contentType(file.absolutePath),
    'cache-control': 'public, max-age=31536000, immutable'
  });
  completed += 1;
  uploaded.push({
    localPath: `/assets/${toPosix(file.relativePath)}`,
    objectKey,
    url: publicBaseUrl ? `${publicBaseUrl}/assets/${toPosix(file.relativePath)}` : `https://${host}/${objectKey}`,
    size: file.size,
    sha1: file.sha1
  });
  if (completed % 20 === 0 || completed === files.length) {
    console.log(`已上传 ${completed}/${files.length}`);
  }
});

uploaded.sort((a, b) => a.localPath.localeCompare(b.localPath));

const manifest = {
  bucket,
  endpoint,
  region,
  assetDir,
  prefix,
  publicBaseUrl: publicBaseUrl || `https://${host}/${prefix.replace(/\/assets$/, '')}`,
  uploadedAt: new Date().toISOString(),
  totalFiles: uploaded.length,
  totalBytes,
  objectAcl,
  files: uploaded
};

mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`完成上传，manifest 已写入 ${manifestPath}`);
console.log(`请将 VITE_ASSET_BASE_URL 设置为：${manifest.publicBaseUrl}`);
console.log('如果小游戏仍报图片 CORS，请在抖音云/TOS 控制台确认 bucket 已允许 GET/HEAD/OPTIONS 跨域。');

async function putObject(objectKey, body, headers) {
  const disposition = `inline; filename="${basename(objectKey).replace(/"/g, '')}"`;
  await client.putObject({
    bucket,
    key: objectKey,
    body,
    contentLength: body.length,
    contentType: headers['content-type'],
    cacheControl: headers['cache-control'],
    contentDisposition: disposition,
    acl: objectAcl,
    headers: {
      'content-disposition': disposition
    }
  });
}

async function putBucketCors() {
  await client.putBucketCORS({
    bucket,
    CORSRules: [
      {
        AllowedOrigins: ['*'],
        AllowedMethods: [
          HttpMethodType.HttpMethodGet,
          HttpMethodType.HttpMethodHead,
          HttpMethodType.HttpMethodOptions ?? 'OPTIONS'
        ],
        AllowedHeaders: ['*'],
        ExposeHeaders: ['ETag', 'x-tos-hash-crc64ecma'],
        MaxAgeSeconds: 86400,
        ResponseVary: false
      }
    ]
  });
}

function normalizeSecretAccessKey(value, encoding) {
  if (encoding !== 'base64') return value;
  return Buffer.from(value, 'base64').toString('utf8');
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = '1';
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function required(value, name, flag) {
  if (value) return String(value);
  console.error(`缺少 ${name}。请在 .env.local 中配置，或通过 ${flag} 传入。`);
  process.exit(1);
}

function listFiles(root) {
  const out = [];
  const visit = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === '.DS_Store') continue;
      const absolutePath = join(dir, name);
      const stat = statSync(absolutePath);
      if (stat.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!stat.isFile()) continue;
      out.push({
        absolutePath,
        relativePath: relative(root, absolutePath),
        size: stat.size,
        sha1: sha1File(absolutePath)
      });
    }
  };
  visit(root);
  return out.sort((a, b) => toPosix(a.relativePath).localeCompare(toPosix(b.relativePath)));
}

function sha1File(path) {
  const hash = createHash('sha1');
  hash.update(readFileSync(path));
  return hash.digest('hex');
}

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const current = items[cursor];
      cursor += 1;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

function cleanPrefix(value) {
  return String(value).replace(/^\/+|\/+$/g, '');
}

function cleanEndpoint(value) {
  return String(value).replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

function cleanPublicBaseUrl(value) {
  return value ? String(value).replace(/\/+$/, '') : '';
}

function toPosix(path) {
  return path.split(/[/\\]+/).join('/');
}

function contentType(path) {
  const type = {
    '.avif': 'image/avif',
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.webp': 'image/webp'
  }[extname(path).toLowerCase()];
  return type ?? 'application/octet-stream';
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
