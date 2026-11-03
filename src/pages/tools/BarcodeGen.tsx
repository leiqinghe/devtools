import { useState, useCallback, useRef } from "react";
import { Card, Input, Button, Space, message, Select, InputNumber, Typography } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import JsBarcode from "jsbarcode";

const FORMATS = [
  { label: "CODE128", value: "CODE128" },
  { label: "EAN13", value: "EAN13" },
  { label: "EAN8", value: "EAN8" },
  { label: "UPC", value: "UPC" },
  { label: "CODE39", value: "CODE39" },
];

export default function BarcodeGen() {
  const [text, setText] = useState("");
  const [format, setFormat] = useState<string>("CODE128");
  const [width, setWidth] = useState<number>(2);
  const [height, setHeight] = useState<number>(100);
  const [generated, setGenerated] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generate = useCallback(() => {
    if (!text.trim()) {
      message.warning("请输入条码内容");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      JsBarcode(canvas, text.trim(), {
        format,
        width,
        height,
        displayValue: true,
      });
      setGenerated(true);
      message.success("条码生成成功");
    } catch {
      message.error("条码生成失败，请检查输入内容是否符合所选格式要求");
    }
  }, [text, format, width, height]);

  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `barcode_${text || "output"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    message.success("下载成功");
  }, [text]);

  return (
    <Card title="条码生成器">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Typography.Text strong>条码内容</Typography.Text>
        <Input
          placeholder="输入条码内容"
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ maxWidth: 400 }}
        />
        <Space wrap>
          <Space>
            <Typography.Text>条码格式</Typography.Text>
            <Select
              value={format}
              onChange={(v) => setFormat(v)}
              options={FORMATS}
              style={{ width: 140 }}
            />
          </Space>
          <Space>
            <Typography.Text>宽度</Typography.Text>
            <InputNumber
              value={width}
              onChange={(v) => setWidth(v ?? 2)}
              min={1}
              max={10}
              style={{ width: 80 }}
            />
          </Space>
          <Space>
            <Typography.Text>高度</Typography.Text>
            <InputNumber
              value={height}
              onChange={(v) => setHeight(v ?? 100)}
              min={30}
              max={300}
              style={{ width: 80 }}
            />
          </Space>
        </Space>
        <Space>
          <Button type="primary" onClick={generate}>
            生成
          </Button>
          {generated && (
            <Button icon={<DownloadOutlined />} onClick={download}>
              下载
            </Button>
          )}
        </Space>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <canvas ref={canvasRef} />
        </div>
      </Space>
    </Card>
  );
}
