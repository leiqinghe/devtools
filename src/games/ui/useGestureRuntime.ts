/**
 * 手势运行时 Hook：统一管理摄像头 + 模型 + HandSource 的生命周期。
 * 游戏页和手势实验室共用，保证两边行为一致。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cameraSupport, openCamera, type CameraHandle, type CameraError } from "../gesture/camera";
import { getTracker, type HandTracker, type TrackerProgress } from "../gesture/tracker";
import { HandSource } from "../gesture/hand-source";
import { loadGestureSettings, type GestureSettings } from "../gesture/settings";

export type GestureRuntimeStatus =
  | "off"
  | "requesting"
  | "loading"
  | "ready"
  | "error"
  | "unsupported";

export interface UseGestureRuntime {
  status: GestureRuntimeStatus;
  error: string | null;
  progress: TrackerProgress | null;
  video: HTMLVideoElement | null;
  source: HandSource | null;
  tracker: HandTracker | null;
  settings: GestureSettings;
  /** 当前是否收到了手 */
  hasHand: boolean;
  mirror: boolean;
  start: () => Promise<void>;
  stop: () => void;
  updateSettings: (patch: Partial<GestureSettings>) => void;
}

export function useGestureRuntime(): UseGestureRuntime {
  const [status, setStatus] = useState<GestureRuntimeStatus>("off");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<TrackerProgress | null>(null);
  const [settings, setSettings] = useState<GestureSettings>(loadGestureSettings);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [hasHand, setHasHand] = useState(false);

  const cameraRef = useRef<CameraHandle | null>(null);
  const sourceRef = useRef<HandSource | null>(null);
  const trackerRef = useRef<HandTracker | null>(null);
  const mountedRef = useRef(true);
  // 用 ref 保存最新设置，避免 start() 闭包拿到旧值
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const stop = useCallback(() => {
    sourceRef.current?.destroy();
    sourceRef.current = null;
    cameraRef.current?.stop();
    cameraRef.current = null;
    setVideo(null);
    setHasHand(false);
    setStatus("off");
  }, []);

  const start = useCallback(async () => {
    if (sourceRef.current) return;
    const support = cameraSupport();
    if (!support.ok) {
      setStatus("unsupported");
      setError(support.hint ?? "摄像头不可用");
      return;
    }

    setError(null);
    setStatus("requesting");
    try {
      const cam = await openCamera(settingsRef.current.deviceId);
      if (!mountedRef.current) {
        cam.stop();
        return;
      }
      cameraRef.current = cam;
      setVideo(cam.video);

      setStatus("loading");
      const tracker = getTracker(settingsRef.current.twoHands ? 2 : 1);
      trackerRef.current = tracker;
      await tracker.load((p) => {
        if (mountedRef.current) setProgress(p);
      });
      if (!mountedRef.current) return;

      const source = new HandSource({ tracker, settings: settingsRef.current, mirrored: true });
      source.attachVideo(cam.video);
      sourceRef.current = source;
      setStatus("ready");
    } catch (err) {
      const e = err as CameraError;
      setStatus("error");
      setError(e?.message || "手势启动失败");
      stop();
      setStatus("error");
    }
  }, [stop]);

  const updateSettings = useCallback((patch: Partial<GestureSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (next.pinchExit <= next.pinchEnter) next.pinchExit = next.pinchEnter + 0.15;
      sourceRef.current?.updateSettings(next);
      return next;
    });
  }, []);

  // 手是否在场：轮询 source 的读数，避免把高频数据塞进 React state
  useEffect(() => {
    if (status !== "ready") return undefined;
    const timer = setInterval(() => {
      const src = sourceRef.current;
      setHasHand(!!src && src.readouts.hands > 0);
    }, 200);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => stop, [stop]);

  const mirror = true;

  return useMemo(
    () => ({
      status,
      error,
      progress,
      video,
      source: sourceRef.current,
      tracker: trackerRef.current,
      settings,
      hasHand,
      mirror,
      start,
      stop,
      updateSettings,
    }),
    [status, error, progress, video, settings, hasHand, mirror, start, stop, updateSettings],
  );
}
