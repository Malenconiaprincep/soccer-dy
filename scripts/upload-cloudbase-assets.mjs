import cloudbase from '@cloudbase/node-sdk';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { loadEnv } from './cloudbase-env.mjs';

const DEFAULT_ASSET_DIR = 'public/assets';
const DEFAULT_PREFIX = 'soccer-dy3/assets';
const DEFAULT_MANIFEST = 'cloudbase-assets-manifest.json';
const CONCURRENCY = 6;

const args = parseArgs(process.argv.slice(2));
const env = loadEnv();
const assetDir = args['assets-dir'] ?? DEFAULT_ASSET_DIR;
const cloudPrefix = cleanPrefix(args.prefix ?? env.CLOUDBASE_ASSET_PREFIX ?? DEFAULT_PREFIX);
const manifestPath = args.manifest ?? DEFAULT_MANIFEST;
const shouldFetchTempUrls = args['temp-urls'] === '1';
const envId = env.CLOUDBASE_ENV_ID ?? env.TCB_ENV;
const apiKey = env.CLOUDBASE_API_KEY ?? env.CLOUDBASE_APIKEY;
const secretId = env.TENCENTCLOUD_SECRETID ?? env.CLOUDBASE_SECRET_ID;
const secretKey = env.TENCENTCLOUD_SECRETKEY ?? env.CLOUDBASE_SECRET_KEY;

if (!existsSync(assetDir)) {
  console.error(`资源目录不存在：${assetDir}`);
  process.exit(1);
}

if (!envId) {
  console.error('缺少 CLOUDBASE_ENV_ID。');
  process.exit(1);
}

const app = cloudbase.init(resolveCloudbaseInitOptions({ envId, apiKey, secretId, secretKey }));

const files = listFiles(assetDir);
const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
console.log(`准备上传 ${files.length} 个资源，${formatBytes(totalBytes)} -> cloud://${envId}/${cloudPrefix}/`);

const uploaded = [];
let completed = 0;

await runPool(files, CONCURRENCY, async (file) => {
  const cloudPath = `${cloudPrefix}/${toPosix(file.relativePath)}`;
  const result = await app.uploadFile({
    cloudPath,
    fileContent: createReadStream(file.absolutePath)
  });
  const fileID = result.fileID ?? result.fileId ?? `cloud://${envId}/${cloudPath}`;
  completed += 1;
  uploaded.push({
    localPath: `/assets/${toPosix(file.relativePath)}`,
    cloudPath,
    fileID,
    size: file.size,
    sha1: file.sha1
  });
  if (completed % 20 === 0 || completed === files.length) {
    console.log(`已上传 ${completed}/${files.length}`);
  }
});

uploaded.sort((a, b) => a.localPath.localeCompare(b.localPath));

if (shouldFetchTempUrls) {
  const chunks = chunk(uploaded, 50);
  for (const group of chunks) {
    const result = await app.getTempFileURL({ fileList: group.map((item) => item.fileID) });
    const urls = result.fileList ?? [];
    urls.forEach((row, index) => {
      group[index].tempFileURL = row.tempFileURL ?? row.download_url ?? row.url;
    });
  }
}

const manifest = {
  envId,
  assetDir,
  cloudPrefix,
  uploadedAt: new Date().toISOString(),
  totalFiles: uploaded.length,
  totalBytes,
  files: uploaded
};

mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`完成上传，manifest 已写入 ${manifestPath}`);
console.log('小游戏构建需要配置 VITE_ASSET_BASE_URL 为云存储/CDN 的 HTTPS 前缀，前缀后面应能直接访问 /assets/...');
console.log('例如：VITE_ASSET_BASE_URL=https://你的静态资源域名/soccer-dy3');

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

function resolveCloudbaseInitOptions({ envId, apiKey, secretId, secretKey }) {
  if (hasRealValue(apiKey)) return { env: envId, accessKey: apiKey };
  if (hasRealValue(secretId) && hasRealValue(secretKey)) return { env: envId, secretId, secretKey };
  return { env: envId };
}

function hasRealValue(value) {
  if (!value) return false;
  return !/^(your-|YOUR_|xxx|placeholder)/i.test(String(value));
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
  return out;
}

function sha1File(path) {
  const hash = createHash('sha1');
  const buffer = readFileSync(path);
  hash.update(buffer);
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

function toPosix(path) {
  return path.split(/[/\\]+/).join('/');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function chunk(items, size) {
  const out = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}
