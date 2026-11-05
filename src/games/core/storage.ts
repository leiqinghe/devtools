/** 本地存储封装：最高分 / 历史局 / 设置。存储不可用时静默降级到内存。 */

const PREFIX = "games:";

interface MemStore {
  [key: string]: string;
}

const memory: MemStore = Object.create(null);

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return memory[key] ?? null;
  }
}

function writeRaw(key: string, value: string) {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    memory[key] = value;
  }
}

export function readJson<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    writeRaw(key, JSON.stringify(value));
  } catch {
    // 循环引用等极端情况，放弃即可
  }
}

export interface ScoreEntry {
  score: number;
  wave: number;
  maxCombo: number;
  kills: number;
  durationMs: number;
  source: string;
  ts: number;
}

const LEADERBOARD_LIMIT = 10;

export function loadScores(gameId: string): ScoreEntry[] {
  const list = readJson<ScoreEntry[]>(`${gameId}:scores`, []);
  if (!Array.isArray(list)) return [];
  return list
    .filter((e) => e && typeof e.score === "number")
    .sort((a, b) => b.score - a.score)
    .slice(0, LEADERBOARD_LIMIT);
}

/** 写入一条成绩，返回是否进入 TOP10 与当前榜单。 */
export function submitScore(
  gameId: string,
  entry: ScoreEntry,
): { ranked: boolean; rank: number; list: ScoreEntry[] } {
  const list = [...loadScores(gameId), entry].sort((a, b) => b.score - a.score).slice(0, LEADERBOARD_LIMIT);
  writeJson(`${gameId}:scores`, list);
  const idx = list.indexOf(entry);
  return { ranked: idx >= 0, rank: idx + 1, list };
}

export function bestScore(gameId: string): number {
  const list = loadScores(gameId);
  return list.length ? list[0].score : 0;
}

export function clearScores(gameId: string) {
  writeJson(`${gameId}:scores`, []);
}

/** 通用设置读取，缺省字段用 defaults 补全。 */
export function loadSettings<T extends object>(key: string, defaults: T): T {
  const saved = readJson<Partial<T>>(key, {});
  return { ...defaults, ...saved };
}

export function saveSettings<T extends object>(key: string, value: T) {
  writeJson(key, value);
}
