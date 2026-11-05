import type { HudState } from "../aircraft/game";
import { formatScore } from "../core/math";

export interface GestureHudProps {
  hud: HudState;
  /** 当前控制方式描述，如「手势 · 单手」 */
  controlLabel: string;
  /** 手是否丢失 */
  handLost?: boolean;
  /** 捏合进度 0~1，用于显示炸弹蓄力提示 */
  pinch?: number;
  /** 是否正在等模型加载 */
  loading?: string;
  /** 暂停按钮 */
  onPause?: () => void;
  /** 静音按钮 */
  muted?: boolean;
  onToggleMute?: () => void;
}

/**
 * 游戏内 HUD：分数/生命/武器/连击/Boss 血条/控制方式。
 * 用绝对定位覆盖在画布上，pointer-events 只在按钮上打开。
 */
export default function GestureHud({
  hud,
  controlLabel,
  handLost = false,
  pinch = 0,
  loading,
  onPause,
  muted = false,
  onToggleMute,
}: GestureHudProps) {
  return (
    <div className="gesture-hud">
      <div className="hud-row hud-top">
        <div className="hud-score">
          <span className="hud-score-value">{formatScore(hud.score)}</span>
          <span className="hud-wave">WAVE {hud.wave}</span>
        </div>
        <div className="hud-actions">
          {onToggleMute && (
            <button type="button" className="hud-btn" onClick={onToggleMute} aria-label={muted ? "取消静音" : "静音"}>
              {muted ? "🔇" : "🔊"}
            </button>
          )}
          {onPause && (
            <button type="button" className="hud-btn" onClick={onPause} aria-label="暂停">
              ❚❚
            </button>
          )}
        </div>
      </div>

      <div className="hud-row hud-bottom">
        <div className="hud-stats">
          <span className="hud-chip hud-lives" aria-label={`剩余生命 ${hud.lives}`}>
            {"♥".repeat(Math.max(0, hud.lives))}
            <span className="hud-dim">{"♡".repeat(Math.max(0, 3 - hud.lives))}</span>
          </span>
          <span className="hud-chip">LV.{hud.weapon}</span>
          <span className={`hud-chip hud-bomb ${hud.bombs === 0 ? "is-empty" : ""}`}>✷ {hud.bombs}</span>
          {hud.shield && <span className="hud-chip hud-shield">SHIELD</span>}
        </div>
        <div className="hud-control">
          <span className={`hud-dot ${handLost ? "is-lost" : ""}`} />
          {controlLabel}
        </div>
      </div>

      {hud.combo > 1 && (
        <div className="hud-combo" style={{ opacity: 1 }}>
          <span className="hud-combo-x">×{hud.combo}</span>
          <span className="hud-combo-bar">
            <span style={{ width: `${Math.round(hud.comboTime * 100)}%` }} />
          </span>
        </div>
      )}

      {hud.bossMaxHp > 0 && (
        <div className="hud-boss">
          <div className="hud-boss-label">BOSS</div>
          <div className="hud-boss-bar">
            <span style={{ width: `${Math.max(0, (hud.bossHp / hud.bossMaxHp) * 100)}%` }} />
          </div>
        </div>
      )}

      {pinch > 0.05 && pinch < 0.9 && (
        <div className="hud-pinch">
          <div className="hud-pinch-ring" style={{ transform: `scale(${1 - pinch * 0.45})` }} />
          <span>捏合释放炸弹</span>
        </div>
      )}

      {loading && (
        <div className="hud-loading">
          <span className="hud-spinner" />
          {loading}
        </div>
      )}

      {handLost && !loading && (
        <div className="hud-toast">没检测到手 · 把手抬到镜头前</div>
      )}
    </div>
  );
}
