import { useState, useRef } from "react";
import { Card, Upload, Button, Select, Space, message, Typography, Row, Col } from "antd";
import { DownloadOutlined, PictureOutlined, InboxOutlined } from "@ant-design/icons";
import type { UploadProps } from "antd";

const SIZES = [
  { label: "16x16", value: 16 },
  { label: "32x32", value: 32 },
  { label: "48x48", value: 48 },
  { label: "64x64", value: 64 },
  { label: "128x128", value: 128 },
  { label: "256x256", value: 256 },
];

export default function IcoMaker() {
  const [srcImg, setSrcImg] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [size, setSize] = useState(32);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleUpload: UploadProps["beforeUpload"] = (file) => {
    setIconUrl("");
    const reader = new FileReader();
    reader.onload = (e) => {
      setSrcImg(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    return false;
  };

  const generate = () => {
    if (!srcImg) {
      message.warning("请先上传图片");
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, size, size);
      const dataUrl = canvas.toDataURL("image/png");
      setIconUrl(dataUrl);
      message.info("浏览器不支持直接生成 .ico 文件，将以 PNG 格式导出相同尺寸的图标");
    };
    img.onerror = () => {
      message.error("图片加载失败");
    };
    img.src = srcImg;
  };

  const download = () => {
    if (!iconUrl) return;
    const link = document.createElement("a");
    link.download = `icon_${size}x${size}.png`;
    link.href = iconUrl;
    link.click();
  };

  return (
    <Card title="ICO 图标制作">
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
            <Typography.Text>图标尺寸：</Typography.Text>
            <Select
              value={size}
              onChange={(v) => setSize(v)}
              options={SIZES}
              style={{ width: 120, marginLeft: 8 }}
            />
          </Col>
          <Col>
            <Button type="primary" icon={<PictureOutlined />} onClick={generate} disabled={!srcImg}>
              生成 ICO
            </Button>
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
            <Typography.Text strong>
              图标预览 {size}x{size}
            </Typography.Text>
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
              {iconUrl ? (
                <>
                  <img
                    src={iconUrl}
                    alt="图标预览"
                    style={{
                      width: size > 256 ? 256 : size,
                      height: size > 256 ? 256 : size,
                      imageRendering: size < 32 ? "pixelated" : "auto",
                    }}
                  />
                  <Button type="primary" icon={<DownloadOutlined />} onClick={download}>
                    下载 PNG ({size}x{size})
                  </Button>
                </>
              ) : (
                <Typography.Text type="secondary">
                  {srcImg ? '点击「生成 ICO」' : '请先上传图片'}
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
