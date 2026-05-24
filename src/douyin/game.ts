type TtApi = {
  createCanvas: () => MiniCanvas;
  createImage?: () => unknown;
  getSystemInfoSync: () => { windowWidth: number; windowHeight: number; pixelRatio?: number };
  onWindowResize?: (listener: (res: { size: { windowWidth: number; windowHeight: number } }) => void) => void;
  onTouchStart?: (listener: (event: MiniTouchEvent) => void) => void;
  onTouchMove?: (listener: (event: MiniTouchEvent) => void) => void;
  onTouchEnd?: (listener: (event: MiniTouchEvent) => void) => void;
  onTouchCancel?: (listener: (event: MiniTouchEvent) => void) => void;
  request?: (options: {
    url: string;
    method?: string;
    data?: unknown;
    header?: Record<string, string>;
    success?: (res: { data: unknown; statusCode: number; header?: Record<string, string> }) => void;
    fail?: (error: unknown) => void;
  }) => void;
};

type MiniCanvas = {
  width: number;
  height: number;
  style?: Record<string, unknown>;
  createImage?: () => unknown;
  getContext: (type: string, options?: unknown) => unknown;
  addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  dispatchEvent?: (event: Event) => boolean;
  getBoundingClientRect?: () => { left: number; top: number; width: number; height: number };
};

type MiniImage = {
  src?: string;
  complete?: boolean;
  width?: number;
  height?: number;
  onload?: (() => void) | null;
  onerror?: ((error: unknown) => void) | null;
  addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
};

type MiniTouch = {
  identifier?: number;
  clientX: number;
  clientY: number;
  pageX?: number;
  pageY?: number;
};

type MiniTouchEvent = {
  touches?: MiniTouch[];
  changedTouches?: MiniTouch[];
  timeStamp?: number;
};

const ttApi = (globalThis as typeof globalThis & { tt?: TtApi }).tt;

if (!ttApi) {
  throw new Error('Douyin mini game runtime requires global tt API.');
}

const systemInfo = ttApi.getSystemInfoSync();
const pixelRatio = Math.min(systemInfo.pixelRatio ?? 1, 2);
const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

const addListener = (type: string, listener: EventListenerOrEventListenerObject) => {
  const bucket = listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
  bucket.add(listener);
  listeners.set(type, bucket);
};

const removeListener = (type: string, listener: EventListenerOrEventListenerObject) => {
  listeners.get(type)?.delete(listener);
};

const mainCanvas = ttApi.createCanvas();
mainCanvas.width = Math.floor(systemInfo.windowWidth * pixelRatio);
mainCanvas.height = Math.floor(systemInfo.windowHeight * pixelRatio);
mainCanvas.style = { width: `${systemInfo.windowWidth}px`, height: `${systemInfo.windowHeight}px` };
mainCanvas.addEventListener ??= addListener;
mainCanvas.removeEventListener ??= removeListener;
mainCanvas.dispatchEvent ??= () => true;
mainCanvas.getBoundingClientRect ??= () => ({
  left: 0,
  top: 0,
  width: systemInfo.windowWidth,
  height: systemInfo.windowHeight
});

const normalizeAssetUrl = (url: string) => url.replace(/^\/assets\//, 'assets/');

const setImageComplete = (image: MiniImage, value: boolean) => {
  try {
    image.complete = value;
  } catch {
    // Douyin runtime may expose complete as read-only on HTMLImageElement.
  }
};

const makeCanvas = (width?: number, height?: number) => {
  const canvas = ttApi.createCanvas();
  canvas.width = Math.max(1, Math.floor(width ?? mainCanvas.width));
  canvas.height = Math.max(1, Math.floor(height ?? mainCanvas.height));
  canvas.style = {};
  canvas.addEventListener ??= addListener;
  canvas.removeEventListener ??= removeListener;
  canvas.dispatchEvent ??= () => true;
  canvas.getBoundingClientRect ??= () => ({
    left: 0,
    top: 0,
    width: canvas.width / pixelRatio,
    height: canvas.height / pixelRatio
  });
  return canvas;
};

const makeImage = () => {
  const rawImage = (mainCanvas.createImage?.() ?? ttApi.createImage?.()) as MiniImage | undefined;
  if (rawImage) {
    rawImage.addEventListener ??= addListener;
    rawImage.removeEventListener ??= removeListener;

    const srcDescriptor =
      Object.getOwnPropertyDescriptor(rawImage, 'src') ??
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(rawImage), 'src');
    let currentSrc = rawImage.src ?? '';
    Object.defineProperty(rawImage, 'src', {
      configurable: true,
      get: () => currentSrc,
      set: (value: string) => {
        currentSrc = normalizeAssetUrl(value);
        if (srcDescriptor?.set) {
          srcDescriptor.set.call(rawImage, currentSrc);
          return;
        }
        Reflect.set(rawImage, '__src', currentSrc);
        setImageComplete(rawImage, false);
        setTimeout(() => {
          setImageComplete(rawImage, true);
          rawImage.onload?.();
        }, 0);
      }
    });

    return rawImage;
  }
  const ImageCtor = (globalThis as typeof globalThis & { Image?: new () => unknown }).Image;
  if (ImageCtor) return new ImageCtor();
  throw new Error('No image factory is available in Douyin runtime.');
};

const callListeners = (type: string, event: Record<string, unknown>) => {
  listeners.get(type)?.forEach((listener) => {
    if (typeof listener === 'function') {
      listener(event as unknown as Event);
    } else {
      listener.handleEvent(event as unknown as Event);
    }
  });
};

const makePointerEvent = (type: string, touch: MiniTouch, source: MiniTouchEvent) => ({
  type,
  pointerId: touch.identifier ?? 1,
  pointerType: 'touch',
  isPrimary: true,
  button: 0,
  buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
  clientX: touch.clientX,
  clientY: touch.clientY,
  pageX: touch.pageX ?? touch.clientX,
  pageY: touch.pageY ?? touch.clientY,
  screenX: touch.clientX,
  screenY: touch.clientY,
  offsetX: touch.clientX,
  offsetY: touch.clientY,
  movementX: 0,
  movementY: 0,
  pressure: type === 'pointerup' || type === 'pointercancel' ? 0 : 0.5,
  width: 1,
  height: 1,
  tiltX: 0,
  tiltY: 0,
  twist: 0,
  tangentialPressure: 0,
  touches: source.touches ?? [],
  changedTouches: source.changedTouches ?? [],
  target: mainCanvas,
  currentTarget: mainCanvas,
  srcElement: mainCanvas,
  timeStamp: source.timeStamp ?? Date.now(),
  isTrusted: true,
  preventDefault() {},
  stopPropagation() {}
});

const dispatchTouch = (pointerType: string, touchType: string, event: MiniTouchEvent) => {
  const changedTouches = event.changedTouches?.length ? event.changedTouches : event.touches ?? [];
  changedTouches.forEach((touch) => {
    const pointerEvent = makePointerEvent(pointerType, touch, event);
    callListeners(pointerType, pointerEvent);
    if (pointerType === 'pointerdown') callListeners('mousedown', { ...pointerEvent, type: 'mousedown' });
    if (pointerType === 'pointermove') callListeners('mousemove', { ...pointerEvent, type: 'mousemove' });
    if (pointerType === 'pointerup') callListeners('mouseup', { ...pointerEvent, type: 'mouseup' });
  });
  callListeners(touchType, {
    type: touchType,
    touches: event.touches ?? [],
    changedTouches,
    target: mainCanvas,
    currentTarget: mainCanvas,
    preventDefault() {},
    stopPropagation() {}
  });
};

ttApi.onTouchStart?.((event) => dispatchTouch('pointerdown', 'touchstart', event));
ttApi.onTouchMove?.((event) => dispatchTouch('pointermove', 'touchmove', event));
ttApi.onTouchEnd?.((event) => dispatchTouch('pointerup', 'touchend', event));
ttApi.onTouchCancel?.((event) => dispatchTouch('pointercancel', 'touchcancel', event));

const miniFetch = (url: RequestInfo | URL, options?: RequestInit) => {
  if (typeof fetch === 'function') return fetch(url, options);
  if (!ttApi.request) return Promise.reject(new Error('No fetch or tt.request API is available.'));

  return new Promise<Response>((resolve, reject) => {
    ttApi.request?.({
      url: String(url),
      method: options?.method,
      data: options?.body,
      header: options?.headers as Record<string, string> | undefined,
      success: (res) => resolve(new Response(res.data as BodyInit, { status: res.statusCode, headers: res.header })),
      fail: reject
    });
  });
};

const makeElement = (tagName: string) => {
  const element = {
    tagName: tagName.toUpperCase(),
    style: {} as Record<string, unknown>,
    parentNode: null as null | { appendChild?: (child: unknown) => unknown; removeChild?: (child: unknown) => unknown },
    children: [] as unknown[],
    appendChild(child: unknown) {
      this.children.push(child);
      if (child && typeof child === 'object') {
        (child as { parentNode?: unknown }).parentNode = this;
      }
      return child;
    },
    removeChild(child: unknown) {
      this.children = this.children.filter((item) => item !== child);
      if (child && typeof child === 'object') {
        (child as { parentNode?: unknown }).parentNode = null;
      }
      return child;
    },
    remove() {
      this.parentNode?.removeChild?.(this);
      this.parentNode = null;
    },
    contains(child: unknown) {
      return this.children.includes(child);
    },
    addEventListener: addListener,
    removeEventListener: removeListener,
    setAttribute() {},
    getAttribute() {
      return null;
    }
  };

  if (tagName === 'video') {
    return Object.assign(element, {
      canPlayType: () => '',
      play: () => Promise.resolve(),
      pause: () => undefined,
      load: () => undefined
    });
  }

  return element;
};

const miniWindow = Object.assign(globalThis, {
  devicePixelRatio: pixelRatio,
  innerWidth: systemInfo.windowWidth,
  innerHeight: systemInfo.windowHeight,
  addEventListener: addListener,
  removeEventListener: removeListener,
  location: { href: '' }
});

const miniDocument = {
  body: { appendChild: () => undefined, style: {} },
  baseURI: '',
  fonts: null,
  createElement(tagName: string) {
    if (tagName === 'canvas') return makeCanvas();
    if (tagName === 'img' || tagName === 'image') return makeImage();
    return makeElement(tagName);
  },
  querySelector() {
    return null;
  },
  addEventListener: addListener,
  removeEventListener: removeListener
};

Object.assign(globalThis, {
  window: miniWindow,
  document: miniDocument,
  PointerEvent: undefined,
  MouseEvent: undefined,
  TouchEvent: undefined,
  ResizeObserver: class MiniGameResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
  navigator: { userAgent: 'ByteDanceMicroGame', gpu: null },
  Image: (globalThis as typeof globalThis & { Image?: unknown }).Image ?? function MiniGameImage() {
    return makeImage();
  }
});

void Promise.all([import('pixi.js/unsafe-eval'), import('pixi.js')]).then(async ([, pixi]) => {
  pixi.DOMAdapter.set({
    createCanvas: makeCanvas,
    createImage: makeImage,
    getCanvasRenderingContext2D: () => mainCanvas.getContext('2d')?.constructor ?? Object,
    getWebGLRenderingContext: () => mainCanvas.getContext('webgl')?.constructor ?? Object,
    getNavigator: () => ({ userAgent: 'ByteDanceMicroGame', gpu: null }),
    getBaseUrl: () => './',
    getFontFaceSet: () => null,
    fetch: miniFetch,
    parseXML: (xml: string) => {
      const DOMParserCtor = (globalThis as typeof globalThis & { DOMParser?: new () => DOMParser }).DOMParser;
      if (!DOMParserCtor) throw new Error('DOMParser is not available.');
      return new DOMParserCtor().parseFromString(xml, 'text/xml');
    }
  } as any);

  const { GameApp } = await import('../game/GameApp');
  const mount = {
    clientWidth: systemInfo.windowWidth,
    clientHeight: systemInfo.windowHeight,
    appendChild: () => undefined,
    addEventListener: addListener
  };
  const game = new GameApp(mount, {
    canvas: mainCanvas,
    width: systemInfo.windowWidth,
    height: systemInfo.windowHeight,
    pixelRatio,
    miniGame: true
  });
  Object.assign(globalThis, { __soccerGame: game });
  void game.start();

  ttApi.onWindowResize?.(({ size }) => {
    mount.clientWidth = size.windowWidth;
    mount.clientHeight = size.windowHeight;
    mainCanvas.width = Math.floor(size.windowWidth * pixelRatio);
    mainCanvas.height = Math.floor(size.windowHeight * pixelRatio);
    game.app.renderer.resize(size.windowWidth, size.windowHeight);
  });
});
