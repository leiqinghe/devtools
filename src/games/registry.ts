import type { GameMeta } from "./types";

/** 游戏注册表：新增游戏只在这里加一项 + 在 App.tsx 加路由。 */
export const GAMES: GameMeta[] = [
  {
    id: "aircraft",
    title: "飞机大战",
    subtitle: "Gesture Air Combat",
    desc: "掌心控制战机、自动开火，捏合放炸弹。十波敌人，每五波一个 Boss。",
    path: "/games/aircraft",
    controls: ["手势", "鼠标", "键盘"],
    accent: "#4fd1ff",
    status: "playable",
  },
];

export function getGame(id: string): GameMeta | undefined {
  return GAMES.find((g) => g.id === id);
}
