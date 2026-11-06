import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Typography, message } from "antd";import {
  AimOutlined,
  ArrowLeftOutlined,
  ExperimentOutlined,
  FullscreenOutlined,
} from "@ant-design/icons";
import GameStage from "../../games/ui/GameStage";
import GestureHud from "../../games/ui/GestureHud";
import CameraStage from "../../games/ui/CameraStage";
import { useGestureRuntime } from "../../games/ui/useGestureRuntime";
import type { HudState } from "../../games/aircraft/game";
import { bestScore, loadScores, submitScore, type ScoreEntry } from "../../games/core/storage";
import { getSfx } from "../../games/core/audio";
import type { GameRunStats } from "../../games/types";
import "../../games/games.css";

type Phase = "intro" | "loading" | "playing" | "paused" | "over";

const GAME_ID = "aircraft";

const EMPTY_HUD: HudState = {
  score: 0,
  lives: 3,
  bombs: 1,
  weapon: 1,
  combo: 0,
  comboTime: 0,
  wave: 1,
  bossHp: 0,
  bossMaxHp: 0,
  shield: false,
};

export default function AircraftGamePage() {
  const navigate = useNavigate();
  const gesture = useGestureRuntime();
  const [phase, setPhase] = useState<Phase>("intro");
  const [hud, setHud] = useState<HudState>(EMPTY_HUD);
  const [best, setBest] = useState(0);
  const [board, setBoard] = useState<ScoreEntry[]>([]);
  const [lastStats, setLastStats] = useState<GameRunStats | null>(null);
  const [rank, setRank] = useState(0);
  const [immersive, setImmersive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [handLost, setHandLost] = useState(false);
  const [gestureLoading, setGestureLoading] = useState("");
  const [useHand, setUseHand] = useState(true);
  const [stageReady, setStageReady] = useState(false);
  /** 每局的 key：变化时 GameStage 重建世界，保证「再来一局」是干净状态 */
  const [runId, setRunId] = useState(0);
  /** 触屏设备：提示文案换成拖动/双击 */
  const isTouch = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true,
    [],
  );

  useEffect(() => {
    setBest(bestScore(GAME_ID));
    setBoard(loadScores(GAME_ID));
    setMuted(getSfx().isMuted);
  }, []);

  useEffect(() => {
    if (immersive) document.body.classList.add("game-immersive");
    else document.body.classList.remove("game-immersive");
    return () => document.body.classList.remove("game-immersive");
  }, [immersive]);

  // 移动端沉浸模式：禁双击缩放 + 屏幕常亮 + 切后台自动暂停
  useEffect(() => {
    if (!immersive) return undefined;
    const meta = document.querySelector('meta[name="viewport"]');
    const prev = meta?.getAttribute("content") ?? null;
    meta?.setAttribute("content", `${prev ?? "width=device-width"}, maximum-scale=1, user-scalable=no`);

    type WakeLockNav = Navigator & {
      wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> };
    };
    let lock: { release(): Promise<void> } | null = null;
    const requestLock = async () => {
      try {
        if (!lock) lock = (await (navigator as WakeLockNav).wakeLock?.request("screen")) ?? null;
      } catch {
        // 不支持或被系统拒绝（省电模式等）就静默跳过
      }
    };
    void requestLock();

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        // 切后台 / 锁屏：自动暂停，回来自动亮屏后点继续
        setPhase((p) => (p === "playing" ? "paused" : p));
      } else {
        lock = null;
        void requestLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (prev !== null) meta?.setAttribute("content", prev);
      document.removeEventListener("visibilitychange", onVisibility);
      void lock?.release().catch(() => undefined);
      lock = null;
    };
  }, [immersive]);

  // Esc 暂停 / 继续
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setPhase((p) => (p === "playing" ? "paused" : p === "paused" ? "playing" : p));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setHandLost(gesture.status === "ready" && !gesture.hasHand);
    if (gesture.status === "requesting") setGestureLoading("正在获取摄像头…");
    else if (gesture.status === "loading") setGestureLoading("正在加载手势模型（首次约 5MB）…");
    else setGestureLoading("");
  }, [gesture.status, gesture.hasHand]);

  /** withHand 必须显式传参：setUseHand 是异步的，闭包里读 state 会拿到旧值 */
  const beginRun = useCallback(
    async (withHand: boolean) => {
      getSfx().unlock();
      setUseHand(withHand);
      setPhase("loading");
      if (withHand && gesture.status !== "ready") {
        await gesture.start();
      }
      setRunId((n) => n + 1);
      setStageReady(false);
      setLastStats(null);
      setRank(0);
      setHud(EMPTY_HUD);
      setPhase("playing");
      setImmersive(true);
    },
    [gesture],
  );

  const handleGameOver = useCallback(
    (stats: GameRunStats) => {
      const source = gesture.status === "ready" ? "hand" : "pointer";
      const entry: ScoreEntry = {
        score: stats.score,
        wave: stats.wave,
        maxCombo: stats.maxCombo,
        kills: stats.kills,
        durationMs: stats.durationMs,
        source,
        ts: Date.now(),
      };
      const res = submitScore(GAME_ID, entry);
      const idx = res.list.findIndex((r) => r.ts === entry.ts);
      setBoard(res.list);
      setRank(idx >= 0 ? idx + 1 : 0);
      setBest(res.list[0]?.score ?? 0);
      setLastStats({ ...stats, source });
      setPhase("over");
    },
    [gesture.status],
  );

  const toggleMute = () => {
    const sfx = getSfx();
    const next = sfx.toggleMute();
    setMuted(next);
    if (!next) sfx.play("uiClick");
  };

  const controlLabel = useMemo(() => {
    if (gesture.status === "ready" && gesture.hasHand) {
      return gesture.settings.twoHands ? "手势 · 双手" : "手势 · 单手";
    }
    if (gesture.status === "ready") return "手势 · 未识别";
    return "鼠标 / 键盘";
  }, [gesture.status, gesture.hasHand, gesture.settings.twoHands]);

  const backToCenter = useCallback(() => {
    setImmersive(false);
    gesture.stop();
    navigate("/games");
  }, [gesture, navigate]);

  const running = phase === "playing";

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            className="game-btn game-btn--ghost"
            style={{ padding: "5px 12px", fontSize: 12.5 }}
            onClick={backToCenter}
          >
            <ArrowLeftOutlined /> 游戏中心
          </button>
          <Typography.Title level={4} style={{ margin: 0 }}>
            飞机大战
          </Typography.Title>
          <span className="game-tag">最佳 {best.toLocaleString()}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="small" icon={<ExperimentOutlined />} onClick={() => navigate("/games/hand-lab")}>
            手势实验室
          </Button>
          <Button size="small" icon={<FullscreenOutlined />} onClick={() => setImmersive((v) => !v)}>
            {immersive ? "退出全屏" : "全屏"}
          </Button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "flex-start",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <div className={`game-shell${immersive ? " game-shell--immersive" : ""}`}>
          <GameStage
            key={runId}
            running={running && stageReady}
            handSource={gesture.status === "ready" ? gesture.source : null}
            handLive={gesture.hasHand}
            onHud={setHud}
            onReady={() => setStageReady(true)}
            onGameOver={handleGameOver}
          />

          {(phase === "playing" || phase === "paused") && (
            <GestureHud
              hud={hud}
              controlLabel={controlLabel}
              handLost={handLost && useHand}
              pinch={gesture.status === "ready" ? gesture.pinchPower : 0}
              loading={gestureLoading}
              onPause={() => setPhase("paused")}
              muted={muted}
              onToggleMute={toggleMute}
            />
          )}

          {phase === "intro" && (
            <div className="game-overlay">
              <h1>飞机大战</h1>
              <p>
                掌心对着镜头移动即可操控战机，自动开火；
                <br />
                捏合拇指与食指投下炸弹，握拳 1.2 秒暂停。
              </p>
              {(gesture.status === "unsupported" || gesture.status === "error") && (
                <p style={{ color: "#ffcfa8" }}>{gesture.error}</p>
              )}
              <div className="game-actions">
                <button
                  type="button"
                  className="game-btn game-btn--primary"
                  onClick={() => {
                    void beginRun(true);
                  }}
                >
                  用手势开始
                </button>
                <button
                  type="button"
                  className="game-btn"
                  onClick={() => {
                    void beginRun(false);
                  }}
                >
                  用鼠标 / 键盘玩
                </button>
                <button
                  type="button"
                  className="game-btn game-btn--ghost"
                  onClick={() => navigate("/games/hand-lab")}
                >
                  <AimOutlined /> 先去调手感
                </button>
              </div>
              <div className="game-hint">
                {isTouch ? (
                  <>
                    <span>拖动屏幕 = 移动（自动开火）</span>
                    <span>双击 = 炸弹</span>
                    <span>点 ❚❚ = 暂停</span>
                  </>
                ) : (
                  <>
                    <span>空格 / 右键 = 炸弹</span>
                    <span>方向键 / WASD = 移动</span>
                    <span>Esc = 暂停</span>
                  </>
                )}
              </div>
            </div>
          )}

          {phase === "loading" && (
            <div className="game-overlay">
              <h2>准备中…</h2>
              <div className="game-loadbar">
                <span style={{ width: gestureLoading ? "62%" : "100%" }} />
              </div>
              <p>{gestureLoading || "加载贴图与音效…"}</p>
            </div>
          )}

          {phase === "playing" && !stageReady && (
            <div className="game-overlay">
              <h2>载入战场…</h2>
              <div className="game-loadbar">
                <span style={{ width: "80%" }} />
              </div>
            </div>
          )}

          {phase === "paused" && (
            <div className="game-overlay">
              <h1 style={{ fontSize: 24 }}>已暂停</h1>
              <p>放松一下，回来继续。</p>
              <div className="game-actions">
                <button
                  type="button"
                  className="game-btn game-btn--primary"
                  onClick={() => setPhase("playing")}
                >
                  继续
                </button>
                <button
                  type="button"
                  className="game-btn"
                  onClick={() => {
                    void beginRun(useHand);
                  }}
                >
                  重新开始
                </button>
                <button type="button" className="game-btn game-btn--ghost" onClick={backToCenter}>
                  返回游戏中心
                </button>
              </div>
            </div>
          )}

          {phase === "over" && (
            <div className="game-overlay">
              <h1 style={{ fontSize: 24 }}>本局结束</h1>
              <div className="game-stats">
                <div className="game-stat">
                  <b>{(lastStats?.score ?? 0).toLocaleString()}</b>
                  <span>SCORE</span>
                </div>
                <div className="game-stat">
                  <b>W{lastStats?.wave ?? 1}</b>
                  <span>WAVE</span>
                </div>
                <div className="game-stat">
                  <b>×{lastStats?.maxCombo ?? 0}</b>
                  <span>COMBO</span>
                </div>
              </div>
              {rank > 0 && rank <= 10 && <p style={{ color: "#ffe08a" }}>进入本地 TOP{rank}！</p>}
              {gesture.status === "ready" && (
                <p style={{ fontSize: 11.5 }}>本局记录为手势成绩</p>
              )}
              <div className="game-board">
                {board.slice(0, 5).map((row, i) => (
                  <div
                    key={`${row.ts}-${i}`}
                    className={`game-board-row${i + 1 === rank ? " is-new" : ""}`}
                  >
                    <span className="game-board-rank">{i + 1}</span>
                    <span>{row.score.toLocaleString()}</span>
                    <span className="game-board-src">{row.source === "hand" ? "手势" : "键鼠"}</span>
                    <span style={{ fontSize: 10.5, color: "#8aa2bd" }}>W{row.wave}</span>
                  </div>
                ))}
              </div>
              <div className="game-actions">
                <button
                  type="button"
                  className="game-btn game-btn--primary"
                  onClick={() => {
                    void beginRun(useHand);
                  }}
                >
                  再来一局
                </button>
                <button
                  type="button"
                  className="game-btn game-btn--ghost"
                  onClick={() => {
                    setImmersive(false);
                    setPhase("intro");
                  }}
                >
                  回到准备页
                </button>
              </div>
            </div>
          )}
        </div>

        {!immersive && (
          <div className="game-side">
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: 12,
                border: "1px solid #eef1f5",
              }}
            >
              <Typography.Text strong style={{ fontSize: 13 }}>
                摄像头预览
              </Typography.Text>
              <div style={{ marginTop: 8, maxWidth: 260, marginLeft: "auto", marginRight: "auto" }}>
                {gesture.video ? (
                  <CameraStage
                    video={gesture.video}
                    mirrored={gesture.mirror}
                    showSkeleton={gesture.settings.showSkeleton}
                    getHands={() => gesture.tracker?.latest ?? []}
                    aspect={3 / 4}
                    dim={!gesture.hasHand}
                  />
                ) : (
                  <div
                    style={{
                      aspectRatio: "3 / 4",
                      borderRadius: 12,
                      background: "#05070f",
                      color: "#7f9bb5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      textAlign: "center",
                      padding: 16,
                      lineHeight: 1.7,
                      whiteSpace: "pre-line",
                    }}
                  >
                    {gesture.status === "ready"
                      ? "摄像头已就绪"
                      : "未开启摄像头\n点「用手势开始」后开启"}
                  </div>
                )}
              </div>
              <Typography.Paragraph style={{ fontSize: 11.5, color: "#8aa2bd", margin: "8px 0 0" }}>
                画面只在本地处理，不上传。
              </Typography.Paragraph>
            </div>

            {gesture.status !== "ready" && (
              <Button
                onClick={() => {
                  void gesture.start();
                  message.info("正在开启摄像头与手势模型");
                }}
              >
                只开摄像头（预览）
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
