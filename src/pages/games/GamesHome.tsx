import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Col, Row, Tag, Typography } from "antd";
import { ArrowRightOutlined, ExperimentOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { GAMES } from "../../games/registry";
import { bestScore } from "../../games/core/storage";
import "../../games/games.css";

/** 游戏中心：从注册表渲染，新增游戏无需改这个文件。 */
export default function GamesHome() {
  const navigate = useNavigate();
  const [bests, setBests] = useState<Record<string, number>>({});

  useEffect(() => {
    const map: Record<string, number> = {};
    for (const g of GAMES) map[g.id] = bestScore(g.id);
    setBests(map);
  }, []);

  return (
    <div>
      <div className="games-hero">
        <h1>手势游戏中心</h1>
        <p>
          用摄像头识别手部动作来操作游戏：移动手掌控制载具，握拳/捏合触发技能。
          全部在浏览器本地运行，画面不上传服务器；不习惯也能用鼠标或键盘玩。
        </p>
      </div>

      <Row gutter={[16, 16]}>
        {GAMES.map((g) => (
          <Col xs={24} sm={12} lg={8} key={g.id}>
            <div className="game-card" onClick={() => navigate(g.path)}>
              <div className="game-card-thumb">
                <img src={`${import.meta.env.BASE_URL}game-assets/aircraft/sprites/player.png`} alt={g.title} />
              </div>
              <div className="sub">{g.subtitle}</div>
              <h3>{g.title}</h3>
              <p>{g.desc}</p>
              <div className="game-card-foot">
                <div className="game-tags">
                  {g.controls.map((c) => (
                    <span className="game-tag" key={c}>
                      {c}
                    </span>
                  ))}
                </div>
                <span>
                  {bests[g.id] ? `最高 ${bests[g.id].toLocaleString()}` : g.status === "playable" ? "开始游戏" : "敬请期待"}
                  <ArrowRightOutlined style={{ marginLeft: 4, fontSize: 11 }} />
                </span>
              </div>
            </div>
          </Col>
        ))}

        <Col xs={24} sm={12} lg={8}>
          <div className="game-card" onClick={() => navigate("/games/hand-lab")}>
            <div className="game-card-thumb">
              <ExperimentOutlined style={{ fontSize: 46, color: "#7fd8ff" }} />
            </div>
            <div className="sub">Hand Lab</div>
            <h3>手势实验室</h3>
            <p>实时查看 21 点骨架与各手势读数，调灵敏度、试射击，先把手感调舒服再开打。</p>
            <div className="game-card-foot">
              <div className="game-tags">
                <span className="game-tag">调试</span>
                <span className="game-tag">调参</span>
              </div>
              <span>
                打开
                <ArrowRightOutlined style={{ marginLeft: 4, fontSize: 11 }} />
              </span>
            </div>
          </div>
        </Col>
      </Row>

      <Card style={{ marginTop: 20, borderRadius: 14 }} styles={{ body: { padding: 18 } }}>
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          怎么玩
        </Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 8, color: "#5a7086", fontSize: 13 }}>
          <PlayCircleOutlined style={{ marginRight: 6, color: "#2f6fd0" }} />
          点开始后允许摄像头权限，把手掌对着镜头抬到画面中央。首次加载手势模型约 5MB（之后走缓存）。
        </Typography.Paragraph>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Tag color="blue">掌心移动 = 战机移动</Tag>
          <Tag color="cyan">自动开火</Tag>
          <Tag color="gold">捏合 = 炸弹</Tag>
          <Tag color="purple">握拳 1.2 秒 = 暂停</Tag>
          <Tag>鼠标 / 键盘也可玩</Tag>
        </div>
      </Card>
    </div>
  );
}
