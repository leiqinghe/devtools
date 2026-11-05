/**
 * 固定步长主循环：逻辑恒定 60Hz（dt 固定），渲染跟随刷新率。
 * 好处是物理/碰撞结果与设备帧率无关，手势源 30fps 也不会让飞船速度变化。
 */
export interface LoopCallbacks {
  /** 固定步长更新，dt 恒为 step 秒 */
  update(dt: number, elapsed: number): void;
  /** 每帧渲染，alpha 为两次逻辑步之间的插值系数（0~1） */
  render(alpha: number): void;
}

export interface LoopHandle {
  stop(): void;
  readonly running: boolean;
}

const STEP = 1 / 60;
const MAX_FRAME = 0.25; // 单帧最多补 0.25s，避免切标签页回来瞬间跑几百步

export function startLoop(cb: LoopCallbacks): LoopHandle {
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let elapsed = 0;
  let running = true;

  const tick = (now: number) => {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    const frame = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    acc += frame;
    let steps = 0;
    while (acc >= STEP && steps < 8) {
      cb.update(STEP, elapsed);
      elapsed += STEP;
      acc -= STEP;
      steps += 1;
    }
    if (steps === 8) acc = 0; // 掉帧太狠就丢弃积压，宁可慢一点也不要雪崩
    cb.render(acc / STEP);
  };

  raf = requestAnimationFrame(tick);

  return {
    get running() {
      return running;
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
