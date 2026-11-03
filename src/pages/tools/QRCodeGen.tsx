import { useState, useRef } from "react";
import {
  Card,
  Input,
  Select,
  Button,
  Space,
  Slider,
  Row,
  Col,
  message,
  Typography,
} from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import QRCodeLib from "qrcode";

const ERROR_LEVELS = [
  { value: "L" as const, label: "L (7%)" },
  { value: "M" as const, label: "M (15%)" },
  { value: "Q" as const, label: "Q (25%)" },
  { value: "H" as const, label: "H (30%)" },
];

export default function QRCodeGen() {
  const [text, setText] = useState("");
  const [size, setSize] = useState(256);
  const [errorLevel, setErrorLevel] = useState<"L" | "M" | "Q" | "H">("M");
  const [dataUrl, setDataUrl] = useState("");
  const [darkColor, setDarkColor] = useState("#000000");
  const [lightColor, setLightColor] = useState("#ffffff");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generate = async () => {
    if (!text.trim()) {
      message.warning("请输入要生成的内容");
      return;
    }
    try {
      const url = await QRCodeLib.toDataURL(text.trim(), {
        width: size,
        errorCorrectionLevel: errorLevel,
        color: { dark: darkColor, light: lightColor },
      });
      setDataUrl(url);
    } catch {
      message.error("生成失败，请检查内容");
    }
  };

  const download = () => {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.download = "qrcode.png";
    link.href = dataUrl;
    link.click();
  };

  return (
    <Card title="二维码生成">
      <Row gutter={24}>
        <Col xs={24} md={12}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Input.TextArea
              placeholder="输入文本或链接"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              size="large"
            />
            <Row gutter={16}>
              <Col span={12}>
                <Typography.Text>前景色</Typography.Text>
                <Input
                  type="color"
                  value={darkColor}
                  onChange={(e) => setDarkColor(e.target.value)}
                  style={{ width: "100%", height: 40, padding: 2 }}
                />
              </Col>
              <Col span={12}>
                <Typography.Text>背景色</Typography.Text>
                <Input
                  type="color"
                  value={lightColor}
                  onChange={(e) => setLightColor(e.target.value)}
                  style={{ width: "100%", height: 40, padding: 2 }}
                />
              </Col>
            </Row>
            <div>
              <Typography.Text>尺寸：{size}px</Typography.Text>
              <Slider
                min={128}
                max={512}
                step={16}
                value={size}
                onChange={setSize}
              />
            </div>
            <Space>
              <Typography.Text>容错级别：</Typography.Text>
              <Select
                value={errorLevel}
                onChange={setErrorLevel}
                options={ERROR_LEVELS}
                style={{ width: 120 }}
              />
            </Space>
            <Space>
              <Button type="primary" onClick={generate} size="large">
                生成二维码
              </Button>
              {dataUrl && (
                <Button icon={<DownloadOutlined />} onClick={download} size="large">
                  下载
                </Button>
              )}
            </Space>
          </Space>
        </Col>
        <Col xs={24} md={12}>
          <div
            style={{
              minHeight: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px dashed #d9d9d9",
              borderRadius: 8,
              marginTop: 16,
            }}
          >
            {dataUrl ? (
              <img src={dataUrl} alt="QR Code" style={{ maxWidth: "100%" }} />
            ) : (
              <Typography.Text type="secondary">
                点击"生成二维码"后在此显示
              </Typography.Text>
            )}
          </div>
        </Col>
      </Row>
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </Card>
  );
}
