import { useState, useRef } from "react";
import { Card, Upload, Button, Slider, Space, message, Typography, Row, Col, Switch } from "antd";
import { DownloadOutlined, InboxOutlined } from "@ant-design/icons";
import type { UploadProps } from "antd";

export default function ImageRounded() {
  const [srcImg, setSrcImg] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [radius, setRadius] = useState(20);
  const [circle, setCircle] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleUpload: UploadProps["beforeUpload"] = (file) => {
    setPreviewUrl("");
    const reader = new FileReader();
    reader.onload = (e) => {
      setSrcImg(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    return false;
  };

  const roundImage = (img: HTMLImageElement, r: number, isCircle: boolean): string => {
    const canvas = canvasRef.current;
    if (!canvas) return "";
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    if (isCircle) {
      const cw = Math.min(w, h);
      const cx = (w - cw) / 2;
      const cy = (h - cw) / 2;
      ctx.arc(cx + cw / 2, cy + cw / 2, cw / 2, 0, Math.PI * 2);
    } else {
      const actualRadius = Math.min(r, Math.min(w, h) / 2);
      ctx.moveTo(actualRadius, 0);
      ctx.lineTo(w - actualRadius, 0);
      ctx.quadraticCurveTo(w, 0, w, actualRadius);
      ctx.lineTo(w, h - actualRadius);
      ctx.quadraticCurveTo(w, h, w - actualRadius, h);
      ctx.lineTo(actualRadius, h);
      ctx.quadraticCurveTo(0, h, 0, h - actualRadius);
      ctx.lineTo(0, actualRadius);
      ctx.quadraticCurveTo(0, 0, actualRadius, 0);
    }
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/png");
  };

  const generate = () => {
    if (!srcImg) {
      message.warning("请先上传图片");
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      const url = roundImage(img, radius, circle);
      setPreviewUrl(url);
    };
    img.onerror = () => {
      message.error("图片加载失败");
    };
    img.src = srcImg;
  };

  const download = () => {
    if (!previewUrl) return;
    const link = document.createElement("a");
    link.download = "rounded.png";
    link.href = previewUrl;
    link.click();
  };

  return (
    <Card title="图片切圆角">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Row gutter={16} align="middle">
          <Col>
            <Upload.Dragger
              beforeUpload={handleUpload}
              accept="image/*"
              showUploadList={false}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ fontSize: 40, color: "#1677ff" }} />
              </p>
              <p className="ant-upload-text" style={{ color: "#666" }}>点击或拖拽文件到此处上传</p>
            </Upload.Dragger>
          </Col>
          <Col>
            <Button type="primary" onClick={generate} disabled={!srcImg} size="large">
              生成预览
            </Button>
          </Col>
        </Row>
        <Row gutter={16} align="middle">
          <Col span={4}>
            <Switch
              checked={circle}
              onChange={(v) => {
                setCircle(v);
                setRadius(v ? 50 : 20);
              }}
            />
            <Typography.Text style={{ marginLeft: 8 }}>圆形</Typography.Text>
          </Col>
          <Col span={4}>
            <Typography.Text>
              圆角半径：{circle ? "50%" : radius + "px"}
            </Typography.Text>
          </Col>
          <Col span={12}>
            <Slider
              min={0}
              max={200}
              value={circle ? 50 : radius}
              onChange={(v) => {
                if (!circle) setRadius(v);
              }}
              disabled={circle}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Typography.Text strong>原图</Typography.Text>
            <div
              style={{
                minHeight: 200,
                border: "1px dashed #d9d9d9",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 8,
                overflow: "hidden",
              }}
            >
              {srcImg ? (
                <img src={srcImg} alt="原图" style={{ maxWidth: "100%", maxHeight: 300 }} />
              ) : (
                <Typography.Text type="secondary">请上传图片</Typography.Text>
              )}
            </div>
          </Col>
          <Col xs={24} md={12}>
            <Typography.Text strong>圆角预览</Typography.Text>
            <div
              style={{
                minHeight: 200,
                border: "1px dashed #d9d9d9",
                borderRadius: 8,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 8,
                gap: 16,
              }}
            >
              {previewUrl ? (
                <>
                  <img
                    src={previewUrl}
                    alt="圆角预览"
                    style={{
                      maxWidth: "100%",
                      maxHeight: 260,
                      borderRadius: circle ? "50%" : radius,
                    }}
                  />
                  <Button type="primary" icon={<DownloadOutlined />} onClick={download}>
                    导出 PNG
                  </Button>
                </>
              ) : (
                <Typography.Text type="secondary">
                  {srcImg ? '点击「生成预览」' : '请先上传图片'}
                </Typography.Text>
              )}
            </div>
          </Col>
        </Row>
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </Space>
    </Card>
  );
}
