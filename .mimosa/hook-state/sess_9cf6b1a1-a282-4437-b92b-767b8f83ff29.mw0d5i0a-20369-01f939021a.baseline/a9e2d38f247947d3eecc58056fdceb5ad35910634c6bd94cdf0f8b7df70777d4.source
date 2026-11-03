import { useState, useRef } from "react";
import {
  Card,
  Upload,
  Button,
  Select,
  Space,
  message,
  Typography,
  Image,
  Row,
  Col,
} from "antd";
import { DownloadOutlined, InboxOutlined } from "@ant-design/icons";
import type { UploadProps } from "antd";

const FORMATS = [
  { value: "image/png", label: "PNG" },
  { value: "image/jpeg", label: "JPEG" },
  { value: "image/webp", label: "WebP" },
  { value: "image/bmp", label: "BMP" },
] as const;

const EXT_MAP: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/bmp": "bmp",
};

export default function ImageConvert() {
  const [srcImg, setSrcImg] = useState("");
  const [srcName, setSrcName] = useState("");
  const [targetFormat, setTargetFormat] = useState<string>("image/png");
  const [outputUrl, setOutputUrl] = useState("");
  const [converting, setConverting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleUpload: UploadProps["beforeUpload"] = (file) => {
    setSrcName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      setSrcImg(e.target?.result as string);
      setOutputUrl("");
    };
    reader.readAsDataURL(file);
    return false;
  };

  const convert = () => {
    if (!srcImg) {
      message.warning("请先上传图片");
      return;
    }
    setConverting(true);

    const img = new window.Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        setConverting(false);
        return;
      }
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setConverting(false);
        return;
      }
      ctx.drawImage(img, 0, 0);
      try {
        const dataUrl = canvas.toDataURL(targetFormat, 0.9);
        setOutputUrl(dataUrl);
        message.success("转换成功");
      } catch {
        message.error("转换失败，请尝试其他格式");
      }
      setConverting(false);
    };
    img.onerror = () => {
      message.error("图片加载失败");
      setConverting(false);
    };
    img.src = srcImg;
  };

  const download = () => {
    if (!outputUrl) return;
    const link = document.createElement("a");
    const name = srcName.replace(/\.[^.]+$/, "");
    link.download = `${name}.${EXT_MAP[targetFormat]}`;
    link.href = outputUrl;
    link.click();
  };

  return (
    <Card title="图片格式转换">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Row gutter={16} align="middle">
          <Col>
            <Upload.Dragger beforeUpload={handleUpload} accept="image/*" showUploadList={false}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ fontSize: 40, color: "#1677ff" }} />
              </p>
              <p className="ant-upload-text" style={{ color: "#666" }}>点击或拖拽文件到此处上传</p>
            </Upload.Dragger>
          </Col>
          <Col>
            <Space>
              <Typography.Text>目标格式：</Typography.Text>
              <Select
                value={targetFormat}
                onChange={setTargetFormat}
                options={FORMATS.map((f) => ({ value: f.value, label: f.label }))}
                size="large"
                style={{ width: 120 }}
              />
            </Space>
          </Col>
          <Col>
            <Button
              type="primary"
              onClick={convert}
              loading={converting}
              disabled={!srcImg}
              size="large"
            >
              转换
            </Button>
          </Col>
        </Row>
        {srcName && (
          <Typography.Text type="secondary">
            当前文件：{srcName}
          </Typography.Text>
        )}
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
              }}
            >
              {srcImg ? (
                <Image src={srcImg} alt="原图" style={{ maxHeight: 300 }} />
              ) : (
                <Typography.Text type="secondary">
                  请上传图片
                </Typography.Text>
              )}
            </div>
          </Col>
          <Col xs={24} md={12}>
            <Typography.Text strong>转换结果</Typography.Text>
            <div
              style={{
                minHeight: 200,
                border: "1px dashed #d9d9d9",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 8,
              }}
            >
              {outputUrl ? (
                <Image src={outputUrl} alt="转换结果" style={{ maxHeight: 300 }} />
              ) : (
                <Typography.Text type="secondary">
                  {srcImg ? '点击「转换」开始' : '请先上传图片'}
                </Typography.Text>
              )}
            </div>
            {outputUrl && (
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={download}
                  size="large"
                >
                  下载 {FORMATS.find((f) => f.value === targetFormat)?.label}
                </Button>
              </div>
            )}
          </Col>
        </Row>
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </Space>
    </Card>
  );
}
