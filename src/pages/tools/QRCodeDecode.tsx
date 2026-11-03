import { useState, useRef } from "react";
import {
  Card,
  Upload,
  Button,
  Space,
  message,
  Typography,
  Image,
} from "antd";
import { InboxOutlined } from "@ant-design/icons";
import type { UploadProps } from "antd";
import jsQR from "jsqr";

export default function QRCodeDecode() {
  const [imgSrc, setImgSrc] = useState("");
  const [result, setResult] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const decodeImage = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, canvas.width, canvas.height);

    if (code) {
      setResult(code.data);
      message.success("解码成功");
    } else {
      setResult("");
      message.warning("未识别到二维码");
    }
  };

  const handleUpload: UploadProps["beforeUpload"] = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setImgSrc(url);
      const img = new window.Image();
      img.onload = () => {
        decodeImage(img);
      };
      img.onerror = () => {
        message.error("图片加载失败");
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
    return false;
  };

  const pasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            const reader = new FileReader();
            reader.onload = (e) => {
              const url = e.target?.result as string;
              setImgSrc(url);
              const img = new window.Image();
              img.onload = () => decodeImage(img);
              img.src = url;
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
      message.warning("剪贴板中没有图片");
    } catch {
      message.error("无法读取剪贴板，请确保已授予权限");
    }
  };

  return (
    <Card title="二维码解码">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space>
          <Upload.Dragger beforeUpload={handleUpload} accept="image/*" showUploadList={false}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ fontSize: 40, color: "#1677ff" }} />
            </p>
            <p className="ant-upload-text" style={{ color: "#666" }}>点击或拖拽文件到此处上传</p>
          </Upload.Dragger>
          <Button onClick={pasteFromClipboard} size="large">
            从剪贴板粘贴
          </Button>
        </Space>
        {imgSrc && (
          <div style={{ textAlign: "center" }}>
            <Image src={imgSrc} alt="上传的图片" style={{ maxHeight: 300 }} />
          </div>
        )}
        {result && (
          <Card size="small" type="inner">
            <Space>
              <Typography.Text strong>解码结果：</Typography.Text>
              <Typography.Paragraph
                copyable
                style={{ margin: 0, wordBreak: "break-all" }}
              >
                {result}
              </Typography.Paragraph>
            </Space>
          </Card>
        )}
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </Space>
    </Card>
  );
}
