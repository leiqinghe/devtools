import { useEffect, useRef } from "react";
import { HAND } from "../gesture/math";
import type { Landmark } from "../gesture/math";

/** 手部骨架连接（与 MediaPipe HAND_CONNECTIONS 一致的常用子集） */
const CONNECTIONS: [number, number][] = [
  [HAND.WRIST, HAND.THUMB_CMC],
  [HAND.THUMB_CMC, HAND.THUMB_MCP],
  [HAND.THUMB_MCP, HAND.THUMB_IP],
  [HAND.THUMB_IP, HAND.THUMB_TIP],
  [HAND.WRIST, HAND.INDEX_MCP],
  [HAND.INDEX_MCP, HAND.INDEX_PIP],
  [HAND.INDEX_PIP, HAND.INDEX_DIP],
  [HAND.INDEX_DIP, HAND.INDEX_TIP],
  [HAND.WRIST, HAND.MIDDLE_MCP],
  [HAND.MIDDLE_MCP, HAND.MIDDLE_PIP],
  [HAND.MIDDLE_PIP, HAND.MIDDLE_DIP],
  [HAND.MIDDLE_DIP, HAND.MIDDLE_TIP],
  [HAND.WRIST, HAND.RING_MCP],
  [HAND.RING_MCP, HAND.RING_PIP],
  [HAND.RING_PIP, HAND.RING_DIP],
  [HAND.RING_DIP, HAND.RING_TIP],
  [HAND.WRIST, HAND.PINKY_MCP],
  [HAND.PINKY_MCP, HAND.PINKY_PIP],
  [HAND.PINKY_PIP, HAND.PINKY_DIP],
  [HAND.PINKY_DIP, HAND.PINKY_TIP],
  [HAND.INDEX_MCP, HAND.MIDDLE_MCP],
  [HAND.MIDDLE_MCP, HAND.RING_MCP],
  [HAND.RING_MCP, HAND.PINKY_MCP],
];

export interface CameraStageProps {
  /** 摄像头视频元素；由外部创建（不放进 React 树，避免重渲染丢帧） */
  video: HTMLVideoElement | null;
  /** 是否镜像显示（前置摄像头） */
  mirrored: boolean;
  /** 是否显示骨架 */
  showSkeleton: boolean;
  /** 每帧取当前手部关键点，返回空数组表示没识别到 */
  getHands: () => { landmarks: Landmark[] }[];
  /** 覆盖层高宽比，默认 4:3；游戏里用 3:4 竖条 */
  aspect?: number;
  width?: number | string;
  height?: number | string;
  /** 识别到手的数量提示，用于边框颜色 */
  dim?: boolean;
}

/**
 * 摄像头预览 + 21 点骨架叠加。
 * 用独立的 requestAnimationFrame 循环绘制骨架，与游戏主循环解耦，
 * 这样即使游戏暂停，骨架仍然实时。
 */
export default function CameraStage({
  video,
  mirrored,
  showSkeleton,
  getHands,
  aspect = 4 / 3,
  width = "100%",
  height,
  dim = false,
}: CameraStageProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);
  /** getHands 每次渲染都是新函数，放进依赖会让绘制循环反复重建 → 用 ref 取最新实现 */
  const getHandsRef = useRef(getHands);
  getHandsRef.current = getHands;

  // 把 video 挂进 DOM（video 由外部创建，addEventListener 不受影响）
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !video) return undefined;
    video.className = "gesture-video";
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.objectFit = "cover";
    video.style.transform = mirrored ? "scaleX(-1)" : "none";
    // 必须压在骨架 canvas 之下：canvas 是 JSX 先声明的，video 后 append，
    // 不给层级的话 video 会盖住骨架（表现为"识别到但看不到骨架"）
    video.style.position = "absolute";
    video.style.inset = "0";
    video.style.zIndex = "1";
    wrap.appendChild(video);
    return () => {
      if (video.parentElement === wrap) wrap.removeChild(video);
    };
  }, [video, mirrored]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      if (!showSkeleton) return;

      const hands = getHandsRef.current();
      for (const hand of hands) {
        const lm = hand.landmarks;
        // 摄像头坐标是 0~1，镜像时 X 翻转，与视频预览方向一致
        const toX = (x: number) => (mirrored ? 1 - x : x) * w;
        const toY = (y: number) => y * h;

        ctx.strokeStyle = "rgba(110, 235, 255, 0.85)";
        ctx.lineWidth = Math.max(1.5, w * 0.004);
        ctx.beginPath();
        for (const [a, b] of CONNECTIONS) {
          if (!lm[a] || !lm[b]) continue;
          ctx.moveTo(toX(lm[a].x), toY(lm[a].y));
          ctx.lineTo(toX(lm[b].x), toY(lm[b].y));
        }
        ctx.stroke();

        for (let i = 0; i < lm.length; i += 1) {
          const p = lm[i];
          if (!p) continue;
          const isTip = i === HAND.THUMB_TIP || i === HAND.INDEX_TIP;
          ctx.fillStyle = isTip ? "#ffe08a" : "rgba(200, 250, 255, 0.95)";
          ctx.beginPath();
          ctx.arc(toX(p.x), toY(p.y), isTip ? Math.max(3, w * 0.009) : Math.max(2, w * 0.006), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
    // getHands 通过 ref 读取，不进依赖，避免循环被反复重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mirrored, showSkeleton]);

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        width,
        height: height ?? undefined,
        aspectRatio: height ? undefined : String(aspect),
        overflow: "hidden",
        borderRadius: 12,
        background: "#05070f",
        opacity: dim ? 0.55 : 1,
        transition: "opacity 0.25s",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}
      />
    </div>
  );
}
