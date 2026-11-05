/**
 * 游戏舞台：把 canvas、输入源、游戏世界串起来。
 * 页面只负责 UI 外壳（开始/暂停/结算），玩法循环都在这里。
 */
import { useEffect, useRef } from "react";
import { AircraftGame, type HudState } from "../aircraft/game";
import { STAGE_H, STAGE_W } from "../aircraft/balance";
import { startLoop, type LoopHandle } from "../core/loop";
import { KeyboardSource, PointerSource } from "../core/input";
import { getSfx } from "../core/audio";
import { loadSprites, type SpriteMap } from "../core/sprites";
import { idleFrame, type ControlFrame, type GameRunStats } from "../types";
import type { HandSource } from "../gesture/hand-source";

export interface StageProps {
  running: boolean;
  handSource: HandSource | null;
  handLive: boolean;
  onHud: (hud: HudState) => void;
  onReady: () => void;
  onGameOver: (stats: GameRunStats) => void;
}

/** 画布尺寸：按容器等比缩放，逻辑分辨率固定 540×960。 */
export default function GameStage({
  running,
  handSource,
  handLive,
  onHud,
  onReady,
  onGameOver,
}: StageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<AircraftGame | null>(null);
  const loopRef = useRef<LoopHandle | null>(null);

  // 循环只建一次，回调与输入源走 ref，避免闭包拿到旧值
  const runningRef = useRef(running);
  runningRef.current = running;
  const handRef = useRef(handSource);
  handRef.current = handSource;
  const handLiveRef = useRef(handLive);
  handLiveRef.current = handLive;
  const onHudRef = useRef(onHud);
  onHudRef.current = onHud;
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const pointerRef = useRef<PointerSource | null>(null);
  const keyboardRef = useRef<KeyboardSource | null>(null);
  const spritesRef = useRef<SpriteMap | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return undefined;

    const sfx = getSfx();
    let disposed = false;

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    void loadSprites().then((sprites) => {
      if (disposed) return;
      spritesRef.current = sprites;
      onReadyRef.current();

      const game = new AircraftGame(sprites, {
        onSfx: (name) => sfx.play(name),
        onHud: (hud) => onHudRef.current(hud),
        onGameOver: (stats) => onGameOverRef.current(stats),
      });
      gameRef.current = game;

      const pointer = new PointerSource(canvas);
      const keyboard = new KeyboardSource();
      pointerRef.current = pointer;
      keyboardRef.current = keyboard;

      loopRef.current = startLoop({
        update: (dt) => {
          const g = gameRef.current;
          if (!g || !runningRef.current) return;
          keyboard.step(dt);
          const frame = composeFrame(
            handRef.current,
            handLiveRef.current,
            pointer,
            keyboard,
          );
          g.update(dt, frame);
        },
        render: () => {
          const g = gameRef.current;
          if (!g) return;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.fillStyle = "#05070f";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const scale = Math.min(canvas.width / STAGE_W, canvas.height / STAGE_H);
          ctx.setTransform(
            scale,
            0,
            0,
            scale,
            (canvas.width - STAGE_W * scale) / 2,
            (canvas.height - STAGE_H * scale) / 2,
          );
          g.render(ctx);
        },
      });
    });

    return () => {
      disposed = true;
      loopRef.current?.stop();
      loopRef.current = null;
      pointerRef.current?.destroy();
      keyboardRef.current?.destroy();
      pointerRef.current = null;
      keyboardRef.current = null;
      gameRef.current?.stop();
      gameRef.current = null;
      ro.disconnect();
    };
  }, []);

  // 开始新一局
  useEffect(() => {
    if (!running) return;
    const g = gameRef.current;
    if (!g || g.isRunning) return;
    getSfx().unlock();
    g.start();
  }, [running]);

  /** 供页面读取实时状态（结算用最新分数） */
  const snapshot = () => gameRef.current?.stats() ?? null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="game-canvas"
        style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
        onContextMenu={(e) => e.preventDefault()}
      />
      <span hidden aria-hidden data-snapshot={snapshot ? "1" : "0"} />
    </>
  );
}

/**
 * 组合输入：手势优先（有手且在跟踪），否则指针，再否则键盘。
 * 键盘只接管位置时同步给指针，避免两套坐标互相打架。
 */
function composeFrame(
  handSource: HandSource | null,
  handLive: boolean,
  pointer: PointerSource,
  keyboard: KeyboardSource,
): ControlFrame {
  // 键盘的炸弹/暂停在所有分支都要合并，避免指针模式下按空格无效
  const k = keyboard.frame();

  if (handSource && handLive) {
    const f = handSource.frame();
    if (f.live) {
      return {
        ...f,
        special: f.special || k.special,
        pause: f.pause || k.pause,
      };
    }
  }

  if (keyboard.moving) {
    pointer.setTarget(k.x, k.y);
    return { ...k, fire: true };
  }

  const p = pointer.frame();
  if (!p.live) {
    return {
      ...idleFrame(),
      x: 0.5,
      y: 0.82,
      fire: false,
      special: k.special,
      pause: k.pause,
      live: false,
      source: "idle",
    };
  }
  return {
    ...p,
    special: p.special || k.special,
    pause: p.pause || k.pause,
  };
}

export { STAGE_W, STAGE_H };
