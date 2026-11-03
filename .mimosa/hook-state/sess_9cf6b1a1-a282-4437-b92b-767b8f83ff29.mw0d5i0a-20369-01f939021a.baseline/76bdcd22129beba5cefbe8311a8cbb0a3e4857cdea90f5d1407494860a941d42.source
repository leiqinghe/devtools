import { useState, useRef } from "react";
import {
  Card,
  Upload,
  Button,
  Slider,
  InputNumber,
  Space,
  message,
  Typography,
  Row,
  Col,
} from "antd";
import {
  DownloadOutlined,
  CompressOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import type { UploadProps } from "antd";

export default function ImageCompress() {
  const [srcImg, setSrcImg] = useState("");
  const [srcFile, setSrcFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(80);
  const [maxWidth, setMaxWidth] = useState<number | null>(null);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);
  const [resultUrl, setResultUrl] = useState("");
  const [srcSize, setSrcSize] = useState(0);
  const [resultSize, setResultSize] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  };

  const handleUpload: UploadProps["beforeUpload"] = (file) => {
    setSrcFile(file);
    setSrcSize(file.size);
    setResultUrl("");
    setResultSize(0);
    const reader = new FileReader();
    reader.onload = (e) => {
      setSrcImg(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    return false;
  };

  const compress = () => {
    if (!srcImg) {
      message.warning("请先上传图片");
      return;
    }

    const img = new window.Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (maxWidth && w > maxWidth) {
        h = Math.round((h * maxWidth) / w);
        w = maxWidth;
      }
      if (maxHeight && h > maxHeight) {
        w = Math.round((w * maxHeight) / h);
        h = maxHeight;
      }

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            setResultUrl(url);
            setResultSize(blob.size);
            message.success("压缩成功");
          } else {
            message.error("压缩失败");
          }
        },
        "image/jpeg",
        quality / 100
      );
    };
    img.onerror = () => {
      message.error("图片加载失败");
    };
    img.src = srcImg;
  };

  const download = () => {
    if (!resultUrl) return;
    const link = document.createElement("a");
    link.download = "compressed.jpg";
    link.href = resultUrl;
    link.click();
  };

  const ratio =
    srcSize > 0 && resultSize > 0
      ? ((1 - resultSize / srcSize) * 100).toFixed(1)
      : "0";

  return (
    <Card title="图片压缩">
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
            <Button
              type="primary"
              icon={<CompressOutlined />}
              onClick={compress}
              disabled={!srcImg}
              size="large"
            >
              压缩
            </Button>
          </Col>
        </Row>

        <Row gutter={16} align="middle">
          <Col span={4}>
            <Typography.Text>压缩质量：{quality}%</Typography.Text>
          </Col>
          <Col span={12}>
            <Slider
              min={10}
              max={100}
              value={quality}
              onChange={setQuality}
            />
          </Col>
          <Col span={4}>
            <InputNumber
              min={10}
              max={100}
              value={quality}
              onChange={(v) => setQuality(v ?? 80)}
              size="small"
              style={{ width: "100%" }}
            />
          </Col>
        </Row>

        <Row gutter={16} align="middle">
          <Col span={4}>
            <Typography.Text>最大宽度：</Typography.Text>
          </Col>
          <Col span={8}>
            <InputNumber
              placeholder="不限制"
              value={maxWidth}
              onChange={(v) => setMaxWidth(v)}
              min={1}
              style={{ width: "100%" }}
            />
          </Col>
          <Col span={4}>
            <Typography.Text>最大高度：</Typography.Text>
          </Col>
          <Col span={8}>
            <InputNumber
              placeholder="不限制"
              value={maxHeight}
              onChange={(v) => setMaxHeight(v)}
              min={1}
              style={{ width: "100%" }}
            />
          </Col>
        </Row>

        {srcFile && (
          <Typography.Text type="secondary">
            当前文件：{srcFile.name}（{formatSize(srcSize)}）
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
                overflow: "hidden",
              }}
            >
              {srcImg ? (
                <img
                  src={srcImg}
                  alt="原图"
                  style={{ maxWidth: "100%", maxHeight: 300 }}
                />
              ) : (
                <Typography.Text type="secondary">请上传图片</Typography.Text>
              )}
            </div>
          </Col>
          <Col xs={24} md={12}>
            <Typography.Text strong>压缩结果</Typography.Text>
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
              {resultUrl ? (
                <img
                  src={resultUrl}
                  alt="压缩结果"
                  style={{ maxWidth: "100%", maxHeight: 300 }}
                />
              ) : (
                <Typography.Text type="secondary">
                  {srcImg ? '点击「压缩」开始' : '请先上传图片'}
                </Typography.Text>
              )}
            </div>
            {resultSize > 0 && (
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <Space direction="vertical" size="small">
                  <Typography.Text>
                    原始大小：{formatSize(srcSize)} → 压缩后：{formatSize(resultSize)}（缩小 {ratio}%）
                  </Typography.Text>
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={download}
                  >
                    下载压缩图
                  </Button>
                </Space>
              </div>
            )}
          </Col>
        </Row>
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </Space>
    </Card>
  );
}
