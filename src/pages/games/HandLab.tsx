import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Card, Col, Row, Slider, Switch, Tag, Typography, message } from "antd";
import { ArrowLeftOutlined, CameraOutlined, PlayCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import CameraStage from "../../games/ui/CameraStage";
import { useGestureRuntime } from "../../games/ui/useGestureRuntime";
import { GESTURE_DEFAULTS, saveGestureSettings } from "../../games/gesture/settings";
import { fistClosure, pinchRatio } from "../../games/gesture/math";
import "../../games/games.css";

const { Text, Paragraph } = Typography;

function Meter({ label, value, hint, color }: { label: string; value: number; hint: string; color: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <Text strong>{label}</Text>
        <Text type="secondary">{value.toFixed(2)}</Text>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "#eef1f5", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`,
            background: color,
            transition: "width 0.08s linear",
          }}
        />
      </div>
      <Text type="secondary" style={{ fontSize: 11 }}>
        {hint}
      </Text>
    </div>
  );
}

/** 手势实验室：看骨架、看读数、调阈值、试射击。 */
export default function HandLab() {
  const navigate = useNavigate();
  const gesture = useGestureRuntime();
  const [readout, setReadout] = useState({ pinch: 0, fist: 0, hands: 0, fistProgress: 0 });
  const [persist, setPersist] = useState(true);

  // 轮询读数（20Hz），避免把 60fps 数据塞进 React
  useEffect(() => {
    const timer = setInterval(() => {
      const src = gesture.source;
      if (!src) {
        setReadout({ pinch: 0, fist: 0, hands: 0, fistProgress: 0 });
        return;
      }
      setReadout(src.readouts);
    }, 50);
    return () => clearInterval(timer);
  }, [gesture.source]);

  // 直接算一遍原始值做交叉验证（看是否与 source 读数一致）
  const raw = useMemo(() => {
    const hands = gesture.tracker?.latest ?? [];
    if (!hands.length) return null;
    return {
      pinch: pinchRatio(hands[0].landmarks),
      fist: fistClosure(hands[0].landmarks),
    };
  }, [gesture.tracker, readout.hands]);

  const update = (patch: Parameters<typeof gesture.updateSettings>[0]) => {
    gesture.updateSettings(patch);
  };

  const save = () => {
    saveGestureSettings(gesture.settings);
    message.success("设置已保存，下次打开直接生效");
  };

  const reset = () => {
    gesture.updateSettings(GESTURE_DEFAULTS);
    saveGestureSettings(GESTURE_DEFAULTS);
    message.success("已恢复默认值");
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <button
          type="button"
          className="game-btn game-btn--ghost"
          style={{ padding: "5px 12px", fontSize: 12.5 }}
          onClick={() => navigate("/games")}
        >
          <ArrowLeftOutlined /> 游戏中心
        </button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          手势实验室
        </Typography.Title>
        <Tag color={gesture.hasHand ? "green" : "default"}>
          {gesture.hasHand ? "已识别到手" : "未识别"}
        </Tag>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} lg={10}>
          <Card
            title="摄像头与骨架"
            style={{ borderRadius: 14 }}
            styles={{ body: { padding: 14 } }}
            extra={
              <Switch
                size="small"
                checked={gesture.settings.showSkeleton}
                onChange={(v) => update({ showSkeleton: v })}
                checkedChildren="骨架"
                unCheckedChildren="骨架"
              />
            }
          >
            {gesture.video ? (
              <CameraStage
                video={gesture.video}
                mirrored={gesture.mirror}
                showSkeleton={gesture.settings.showSkeleton}
                getHands={() => gesture.tracker?.latest ?? []}
                aspect={4 / 3}
                dim={!gesture.hasHand}
              />
            ) : (
              <div
                style={{
                  aspectRatio: "4 / 3",
                  borderRadius: 12,
                  background: "#05070f",
                  color: "#7f9bb5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12.5,
                  padding: 20,
                  textAlign: "center",
                  lineHeight: 1.8,
                  whiteSpace: "pre-line",
                }}
              >
                {gesture.status === "loading"
                  ? "正在加载手势模型（首次约 5MB）…"
                  : gesture.status === "requesting"
                    ? "正在获取摄像头权限…"
                    : "还没开启摄像头\n点下方按钮开始"}
              </div>
            )}

            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {gesture.status === "off" || gesture.status === "error" || gesture.status === "unsupported" ? (
                <Button type="primary" icon={<CameraOutlined />} onClick={() => void gesture.start()}>
                  开启摄像头
                </Button>
              ) : (
                <Button icon={<ReloadOutlined />} onClick={gesture.stop}>
                  关闭摄像头
                </Button>
              )}
              <Button icon={<PlayCircleOutlined />} onClick={() => navigate("/games/aircraft")}>
                去打一局
              </Button>
            </div>

            {gesture.error && (
              <Alert
                style={{ marginTop: 12 }}
                type="warning"
                showIcon
                message={gesture.error}
                description="可以先用鼠标/键盘玩，或者用 https 域名重新打开本页。"
              />
            )}

            <Paragraph type="secondary" style={{ fontSize: 11.5, marginTop: 12, marginBottom: 0 }}>
              视频流只在浏览器内处理，不会上传到服务器。
            </Paragraph>
          </Card>
        </Col>

        <Col xs={24} md={12} lg={7}>
          <Card title="实时读数" style={{ borderRadius: 14 }} styles={{ body: { padding: 16 } }}>
            <Meter
              label="捏合量 pinch"
              value={raw?.pinch ?? readout.pinch}
              hint={`小于 ${gesture.settings.pinchEnter.toFixed(2)} 触发炸弹，大于 ${gesture.settings.pinchExit.toFixed(2)} 释放`}
              color="#ffb347"
            />
            <Meter
              label="握拳程度 fist"
              value={raw?.fist ?? readout.fist}
              hint={`大于 0.72 持续 ${gesture.settings.fistHoldMs}ms 触发暂停`}
              color="#8b7bff"
            />
            <div style={{ fontSize: 12, color: "#5a7086", display: "flex", gap: 16, marginTop: 6 }}>
              <span>识别手数：{readout.hands}</span>
              <span>暂停蓄力：{(readout.fistProgress * 100).toFixed(0)}%</span>
            </div>
            <div style={{ marginTop: 10 }}>
              <Tag color={readout.fistProgress > 0.95 ? "red" : "default"}>握拳会触发暂停</Tag>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={24} lg={7}>
          <Card title="手感调参" style={{ borderRadius: 14 }} styles={{ body: { padding: 16 } }}>
            <div style={{ fontSize: 12, marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
              <Text strong>平滑强度</Text>
              <Text type="secondary">{gesture.settings.smoothing.toFixed(1)}</Text>
            </div>
            <Slider
              min={0.6}
              max={2.5}
              step={0.1}
              value={gesture.settings.smoothing}
              onChange={(v) => update({ smoothing: v })}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              越大越稳但更迟钝；手抖得厉害就调大。
            </Text>

            <div style={{ fontSize: 12, margin: "14px 0 4px", display: "flex", justifyContent: "space-between" }}>
              <Text strong>捏合触发阈值</Text>
              <Text type="secondary">{gesture.settings.pinchEnter.toFixed(2)}</Text>
            </div>
            <Slider
              min={0.15}
              max={0.6}
              step={0.01}
              value={gesture.settings.pinchEnter}
              onChange={(v) => update({ pinchEnter: v, pinchExit: Math.max(v + 0.15, gesture.settings.pinchExit) })}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              越小越难触发；总是误触就调小。
            </Text>

            <div style={{ fontSize: 12, margin: "14px 0 4px", display: "flex", justifyContent: "space-between" }}>
              <Text strong>握拳保持时长</Text>
              <Text type="secondary">{(gesture.settings.fistHoldMs / 1000).toFixed(1)}s</Text>
            </div>
            <Slider
              min={600}
              max={2500}
              step={100}
              value={gesture.settings.fistHoldMs}
              onChange={(v) => update({ fistHoldMs: v })}
            />

            <div style={{ fontSize: 12, margin: "14px 0 4px", display: "flex", justifyContent: "space-between" }}>
              <Text strong>边缘内缩</Text>
              <Text type="secondary">{gesture.settings.margin.toFixed(2)}</Text>
            </div>
            <Slider
              min={0.02}
              max={0.3}
              step={0.01}
              value={gesture.settings.margin}
              onChange={(v) => update({ margin: v })}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              越大越容易够到画面边缘，但活动范围更小。
            </Text>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 0 8px" }}>
              <Text strong style={{ fontSize: 12 }}>
                双手模式
              </Text>
              <Switch
                size="small"
                checked={gesture.settings.twoHands}
                onChange={(v) => update({ twoHands: v })}
              />
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              左手控制位置、右手决定射击方向。
            </Text>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <Button size="small" type="primary" onClick={save}>
                保存设置
              </Button>
              <Button size="small" onClick={reset}>
                恢复默认
              </Button>
            </div>
            <div style={{ marginTop: 10 }}>
              <Switch size="small" checked={persist} onChange={setPersist} />{" "}
              <Text type="secondary" style={{ fontSize: 11 }}>
                改动即时生效（{persist ? "已自动记忆" : "仅本次"}）
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16, borderRadius: 14 }} styles={{ body: { padding: 18 } }}>
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          手势速查
        </Typography.Title>
        <Row gutter={[16, 12]}>
          {[
            ["张开手掌移动", "掌心位置控制战机；自动开火，无需按住"],
            ["捏合（拇指 + 食指）", "释放炸弹，清屏并对全场敌人造成伤害"],
            ["握拳保持 1.2 秒", "暂停 / 继续，防误触需要持续握紧"],
            ["双手（可选）", "左手定位、右手拉开决定射击角度 ±70°"],
          ].map(([title, desc]) => (
            <Col xs={24} sm={12} key={title}>
              <Text strong style={{ fontSize: 13 }}>
                {title}
              </Text>
              <Paragraph type="secondary" style={{ fontSize: 12, margin: "2px 0 0" }}>
                {desc}
              </Paragraph>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
