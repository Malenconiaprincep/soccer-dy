import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve } from 'node:path';

const projectRoot = resolve('cocos-client');
const scenePath = resolve(projectRoot, 'assets/scenes/main.scene');
const sceneMetaPath = `${scenePath}.meta`;
const scriptMetaPath = resolve(projectRoot, 'assets/scripts/runtime/GameRoot.ts.meta');
const projectSettingsPath = resolve(projectRoot, 'settings/v2/packages/project.json');
const expectedScriptUuid = '65ba2cc9-62f4-4dc7-99bb-2ca91c00138a';
const expectedScriptType = compressUuid(expectedScriptUuid);
const expectedSceneUuid = 'f7cb6df1-0409-4c69-b650-159fdbc71839';

await assertFile(resolve(projectRoot, 'package.json'), '没有找到 cocos-client，请在仓库根目录运行此命令。');
await assertGameRootMeta();

let scene = await readJson(scenePath).catch(() => undefined);
if (!is2dScene(scene)) {
  scene = await loadCreator2dTemplate();
}

repairScene(scene);
await mkdir(dirname(scenePath), { recursive: true });
await writeFile(scenePath, `${JSON.stringify(scene, null, 2)}\n`);
await writeFile(sceneMetaPath, `${JSON.stringify({
  ver: '1.1.50',
  importer: 'scene',
  imported: true,
  uuid: expectedSceneUuid,
  files: ['.json'],
  subMetas: {},
  userData: {}
}, null, 2)}\n`);

const settings = await readJson(projectSettingsPath).catch(() => ({ __version__: '1.0.6' }));
settings.general ??= {};
settings.general.designResolution = { width: 720, height: 1280 };
settings.script ??= {};
settings.script.preserveSymlinks = true;
await mkdir(dirname(projectSettingsPath), { recursive: true });
await writeFile(projectSettingsPath, `${JSON.stringify(settings, null, 2)}\n`);

console.info('[cocos] 主场景已生成并绑定 GameRoot');
console.info(`[cocos] 工程目录: ${projectRoot}`);
console.info(`[cocos] 请在 Creator 中双击: db://assets/scenes/main.scene`);

async function assertGameRootMeta() {
  const meta = await readJson(scriptMetaPath).catch(() => undefined);
  if (meta?.uuid !== expectedScriptUuid) {
    throw new Error(`GameRoot.ts.meta UUID 不正确，期望 ${expectedScriptUuid}`);
  }
}

function repairScene(value) {
  const sceneAsset = value[0];
  const sceneNode = value[1];
  const canvas = value.find((item) => item?.__type__ === 'cc.Node' && item._name === 'Canvas');
  const canvasTransformRef = canvas._components
    .map((item) => value[item?.__id__])
    .find((item) => item?.__type__ === 'cc.UITransform');

  sceneAsset._name = 'main';
  sceneNode._name = 'main';
  sceneNode._id = 'f7cb6df1-0409-4c69-b650-159fdbc71839';
  canvas._lpos = { __type__: 'cc.Vec3', x: 360, y: 640, z: 0 };
  if (canvasTransformRef) {
    canvasTransformRef._contentSize = { __type__: 'cc.Size', width: 720, height: 1280 };
  }

  let componentIndex = value.findIndex((item) => item?.__type__ === expectedScriptType);
  if (componentIndex < 0) {
    componentIndex = value.length;
    value.push({
      __type__: expectedScriptType,
      _name: '',
      _objFlags: 0,
      node: { __id__: value.indexOf(canvas) },
      _enabled: true,
      __prefab: null,
      _id: 'dSFVgIhHFAK7a7PpP6PqBi'
    });
  }

  canvas._components = canvas._components.filter((ref, index, refs) => {
    const type = value[ref?.__id__]?.__type__;
    return type !== expectedScriptType || refs.findIndex((candidate) => value[candidate?.__id__]?.__type__ === expectedScriptType) === index;
  });
  if (!canvas._components.some((ref) => ref?.__id__ === componentIndex)) {
    canvas._components.push({ __id__: componentIndex });
  }

  ensureRuntimeScreens(value, canvas);
}

function ensureRuntimeScreens(value, canvas) {
  const canvasIndex = value.indexOf(canvas);
  let nodeIndex = canvas._children
    .map((ref) => ref?.__id__)
    .find((index) => value[index]?.__type__ === 'cc.Node' && value[index]._name === 'RuntimeScreens');

  if (nodeIndex == null) {
    nodeIndex = value.length;
    value.push({
      __type__: 'cc.Node',
      _name: 'RuntimeScreens',
      _objFlags: 0,
      _parent: { __id__: canvasIndex },
      _children: [],
      _active: true,
      _components: [],
      _prefab: null,
      _lpos: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
      _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 },
      _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 },
      _layer: 33554432,
      _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
      _id: 'soccerRuntimeScreens'
    });
    canvas._children.push({ __id__: nodeIndex });
  }

  const node = value[nodeIndex];
  node._parent = { __id__: canvasIndex };
  node._lpos = { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 };
  let transformIndex = node._components
    .map((ref) => ref?.__id__)
    .find((index) => value[index]?.__type__ === 'cc.UITransform');

  if (transformIndex == null) {
    transformIndex = value.length;
    value.push({
      __type__: 'cc.UITransform',
      _name: '',
      _objFlags: 0,
      node: { __id__: nodeIndex },
      _enabled: true,
      __prefab: null,
      _contentSize: { __type__: 'cc.Size', width: 720, height: 1280 },
      _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 },
      _id: 'soccerRuntimeTransform'
    });
    node._components.push({ __id__: transformIndex });
  }

  value[transformIndex]._contentSize = { __type__: 'cc.Size', width: 720, height: 1280 };
}

function is2dScene(value) {
  return Array.isArray(value)
    && value.some((item) => item?.__type__ === 'cc.Canvas')
    && value.some((item) => item?.__type__ === 'cc.Node' && item._name === 'Canvas');
}

async function loadCreator2dTemplate() {
  const creatorRoot = '/Applications/Cocos/Creator';
  const versions = (await readdir(creatorRoot)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  for (const version of versions) {
    const template = resolve(
      creatorRoot,
      version,
      'CocosCreator.app/Contents/Resources/resources/3d/engine/editor/assets/default_file_content/scene/scene-2d.scene'
    );
    try {
      return await readJson(template);
    } catch {
      // Try the next installed Creator version.
    }
  }
  throw new Error('未找到 Cocos Creator 的 2D 场景模板，请安装 Creator 3.8.x。');
}

function compressUuid(uuid) {
  const hex = uuid.replaceAll('-', '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bits = [...hex.slice(5)].map((value) => Number.parseInt(value, 16).toString(2).padStart(4, '0')).join('');
  let result = hex.slice(0, 5);
  for (let index = 0; index < bits.length; index += 6) {
    result += alphabet[Number.parseInt(bits.slice(index, index + 6).padEnd(6, '0'), 2)];
  }
  return result;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function assertFile(path, message) {
  try {
    await access(path, constants.R_OK);
  } catch {
    throw new Error(message);
  }
}
