import heroUrl from '../assets/game/loading_hero.png';

/** 健康游戏忠告（版署常见表述），加载页展示 */
const HEALTHY_GAMING_NOTICE =
  '抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防上当受骗。适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。';

/** 加载页「经理贴士」分页上滑文案（游戏内提示） */
const GAME_TIPS = [
  '高强度训练后留出恢复时间，可降低伤病概率并保持状态。',
  '赛前先看对手阵型，微调首发与战术更容易占到便宜。',
  '保持轮换，别让核心球员体力见底再上场比赛。',
  '年轻球员连续首发更易累积疲劳，替补上阵有助长线战绩。',
  '比分落后时提高进攻倾向有风险，注意身后空档别被抓反击。',
  '领先时适度回收阵型，能帮你稳住节奏、减少失误送礼。',
  '门将出击时机要谨慎，贸然出击容易被吊射或穿裆。',
  '任意球靠近球门时，弧线球线路会比直线大力更难扑救。',
  '转会市场多看一眼球员体能与潜力，纸面数值并非全部。',
  '比赛节奏越快，失误概率越高；控球稳住也是一种战术。',
  '边路传中找头球点时，禁区内堆人能提高争顶成功率。',
  '落后别急于一脚直塞，耐心传导往往能撕开防线。',
];

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 一屏一屏向上切换；末尾重复首条用于无缝回绕 */
function buildTipTickSlidesHtml(): string {
  const tips = GAME_TIPS.map((t) => escapeHtml(t.trim()));
  const slides = [...tips, tips[0] ?? ''];
  return slides
    .map(
      (html) =>
        `<div class="loading-tip__tick-slide"><p class="loading-tip__tick-text">${html}</p></div>`,
    )
    .join('');
}

/** 按最长贴士自适应「一屏」高度；只量真实条目（不含末尾重复那条） */
function syncTipTickSlideHeight(host: HTMLElement): void {
  const tickRoot = host.querySelector<HTMLElement>('.loading-tip__tick');
  const viewport = host.querySelector<HTMLElement>('.loading-tip__tick-viewport');
  const slides = [...host.querySelectorAll<HTMLElement>('.loading-tip__tick-slide')];
  if (!tickRoot || !viewport || slides.length === 0) return;

  viewport.style.height = 'auto';
  slides.forEach((s) => {
    s.style.height = 'auto';
  });

  let maxH = 0;
  const measureCount = Math.min(slides.length, GAME_TIPS.length);
  for (let i = 0; i < measureCount; i++) {
    maxH = Math.max(maxH, slides[i]!.scrollHeight);
  }

  const minPx = 44;
  const maxPx = 118;
  const h = Math.min(maxPx, Math.max(minPx, Math.ceil(maxH)));

  viewport.style.removeProperty('height');
  slides.forEach((s) => s.style.removeProperty('height'));

  tickRoot.style.setProperty('--tick-slide-h', `${h}px`);
}

function readTickSlidePx(host: HTMLElement): number {
  const tickRoot = host.querySelector<HTMLElement>('.loading-tip__tick');
  const raw = tickRoot?.style.getPropertyValue('--tick-slide-h').trim() ?? '';
  if (raw.endsWith('px')) {
    const n = Number.parseFloat(raw);
    if (Number.isFinite(n)) return Math.round(n);
  }
  const slide = host.querySelector<HTMLElement>('.loading-tip__tick-slide');
  return slide ? Math.round(slide.getBoundingClientRect().height) : 0;
}

/** 字体与宽度稳定后再量一次，避免 WebFont 到位前后高度跳变 */
function whenTipTypographyStable(cb: () => void): () => void {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    cb();
  };

  let t = window.setTimeout(run, 2600);

  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (fonts?.ready) {
    void fonts.ready.then(() => {
      window.clearTimeout(t);
      run();
    });
  }

  return () => {
    window.clearTimeout(t);
    done = true;
  };
}

export type LoadingOverlay = {
  setProgress(percent: number, headline?: string): void;
  dispose(): void;
};

function appVersion(): string {
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
}

function bulbSvg(): string {
  return `<svg class="loading-tip__icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2Zm-2 18a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1Z"/></svg>`;
}

export function tryCreateLoadingOverlay(): LoadingOverlay | null {
  if (typeof document === 'undefined') return null;

  const root = document.createElement('div');
  root.className = 'loading-screen';
  root.setAttribute('role', 'progressbar');
  root.setAttribute('aria-valuemin', '0');
  root.setAttribute('aria-valuemax', '100');
  root.setAttribute('aria-valuenow', '0');
  root.innerHTML = `
    <div class="loading-screen__inner">
      <header class="loading-screen__header">
        <h1 class="loading-screen__title">FOOTBALL STAR</h1>
        <p class="loading-screen__subtitle">NEO-CHIBI MANAGER</p>
      </header>
      <div class="loading-screen__hero-wrap">
        <div class="loading-screen__hero-card">
          <img class="loading-screen__hero-img" alt="" src="${heroUrl}" decoding="async" />
          <div class="loading-screen__hero-glow" aria-hidden="true"></div>
        </div>
      </div>
      <div class="loading-screen__bottom">
        <div class="loading-screen__status">
          <h2 class="loading-screen__headline">正在进入球场...</h2>
          <div class="loading-bar">
            <div class="loading-bar__track">
              <div class="loading-bar__fill" style="width:0%"></div>
              <div class="loading-bar__shine" aria-hidden="true"></div>
            </div>
          </div>
          <p class="loading-screen__percent-row">
            <span class="loading-screen__percent-label">LOADING ASSETS</span>
            <span class="loading-screen__percent-value">0%</span>
          </p>
        </div>
        <div class="loading-tip">
          <div class="loading-tip__icon">${bulbSvg()}</div>
          <div class="loading-tip__body">
            <h4 class="loading-tip__label">经理贴士</h4>
            <div class="loading-tip__tick" role="region" aria-label="游戏贴士">
              <div class="loading-tip__tick-viewport">
                <div class="loading-tip__tick-track">
                  ${buildTipTickSlidesHtml()}
                </div>
              </div>
            </div>
          </div>
        </div>
        <p class="loading-screen__healthy-gaming" role="note">${HEALTHY_GAMING_NOTICE}</p>
        <footer class="loading-screen__footer">
          <span>VER ${appVersion()}-PRO</span>
          <div class="loading-screen__dots" aria-hidden="true">
            <span class="loading-screen__dot loading-screen__dot--on"></span>
            <span class="loading-screen__dot"></span>
            <span class="loading-screen__dot"></span>
          </div>
          <span>© 2026 FOOTBALL STAR</span>
        </footer>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  const tickTrack = root.querySelector<HTMLElement>('.loading-tip__tick-track');
  const tickRoot = root.querySelector<HTMLElement>('.loading-tip__tick');

  let tipCarouselTimer = 0;
  let tipIndex = 0;

  const stopTipCarousel = () => {
    if (tipCarouselTimer !== 0) window.clearInterval(tipCarouselTimer);
    tipCarouselTimer = 0;
  };

  let disposed = false;

  const reduceMotion =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let resizeTimer = 0;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (disposed) return;
      if (!tickRoot?.classList.contains('loading-tip__tick--layout-ready')) return;
      syncTipTickSlideHeight(root);
      if (tipCarouselTimer !== 0 && tickTrack) {
        stopTipCarousel();
        tipIndex = 0;
        tickTrack.style.transition = 'none';
        tickTrack.style.transform = 'translateY(0)';
        void tickTrack.offsetHeight;
        tickTrack.style.transition = '';
        tryStartTipCarousel();
      }
    }, 150);
  };
  window.addEventListener('resize', onResize);

  const n = GAME_TIPS.length;
  const stepMs = 4000;

  const tryStartTipCarousel = () => {
    if (disposed || reduceMotion || n <= 1 || !tickTrack) return;
    if (tipCarouselTimer !== 0) return;
    const step = readTickSlidePx(root);
    if (step <= 0) return;

    tipCarouselTimer = window.setInterval(() => {
      if (!tickTrack || disposed) return;
      tipIndex += 1;
      tickTrack.style.transform = `translateY(-${tipIndex * step}px)`;
      if (tipIndex === n) {
        tickTrack.addEventListener(
          'transitionend',
          (ev) => {
            if ((ev as TransitionEvent).propertyName !== 'transform') return;
            tickTrack.style.transition = 'none';
            tickTrack.style.transform = 'translateY(0)';
            tipIndex = 0;
            void tickTrack.offsetHeight;
            tickTrack.style.transition = '';
          },
          { once: true },
        );
      }
    }, stepMs);
  };

  let cancelTypographyWatch: () => void;

  if (reduceMotion) {
    cancelTypographyWatch = () => {};
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (disposed) return;
        syncTipTickSlideHeight(root);
        tickRoot?.classList.add('loading-tip__tick--layout-ready');
      });
    });
  } else {
    cancelTypographyWatch = whenTipTypographyStable(() => {
      if (disposed) return;
      syncTipTickSlideHeight(root);
      tickRoot?.classList.add('loading-tip__tick--layout-ready');
      tryStartTipCarousel();
    });
  }

  const fill = root.querySelector<HTMLElement>('.loading-bar__fill');
  const pctEl = root.querySelector<HTMLElement>('.loading-screen__percent-value');
  const headlineEl = root.querySelector<HTMLElement>('.loading-screen__headline');

  const setProgress = (percent: number, headline?: string) => {
    if (disposed || !fill || !pctEl) return;
    const p = Math.max(0, Math.min(100, Math.round(percent)));
    fill.style.width = `${p}%`;
    pctEl.textContent = `${p}%`;
    root.setAttribute('aria-valuenow', String(p));
    root.setAttribute('aria-valuetext', `加载进度 ${p}%`);
    if (headline !== undefined && headlineEl) headlineEl.textContent = headline;
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelTypographyWatch();
    window.removeEventListener('resize', onResize);
    window.clearTimeout(resizeTimer);
    stopTipCarousel();
    root.classList.add('loading-screen--out');
    const done = () => {
      root.remove();
    };
    root.addEventListener('transitionend', done, { once: true });
    window.setTimeout(done, 420);
  };

  return { setProgress, dispose };
}
