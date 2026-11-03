import { useState } from "react";
import {
  Card,
  Upload,
  Button,
  Space,
  message,
  Typography,
  Row,
  Col,
  Input,
} from "antd";
import { CopyOutlined, InboxOutlined } from "@ant-design/icons";
import type { UploadProps } from "antd";

export default function ImageToBase64() {
  const [base64, setBase64] = useState("");
  const [preview, setPreview] = useState("");
  const [imgInfo, setImgInfo] = useState({
    name: "",
    size: 0,
    width: 0,
    height: 0,
    type: "",
  });
  const [expanded, setExpanded] = useState(false);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  };

  const handleUpload: UploadProps["beforeUpload"] = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setBase64(dataUrl);

      const img = new window.Image();
      img.onload = () => {
        setPreview(dataUrl);
        setImgInfo({
          name: file.name,
          size: file.size,
          width: img.naturalWidth,
          height: img.naturalHeight,
          type: file.type,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    return false;
  };

  const copy = () => {
    if (base64) {
      navigator.clipboard.writeText(base64).then(
        () => message.success("已复制"),
        () => message.error("复制失败")
      );
    }
  };

  const displayText = expanded ? base64 : base64.slice(0, 200);

  return (
    <Card title="图片转 Base64">
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
          {base64 && (
            <Col>
              <Button icon={<CopyOutlined />} onClick={copy} size="large">
                复制 Base64
              </Button>
            </Col>
          )}
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Typography.Text strong>图片预览</Typography.Text>
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
              {preview ? (
                <img
                  src={preview}
                  alt="预览"
                  style={{ maxWidth: "100%", maxHeight: 300 }}
                />
              ) : (
                <Typography.Text type="secondary">请上传图片</Typography.Text>
              )}
            </div>
          </Col>
          <Col xs={24} md={12}>
            <Typography.Text strong>图片信息</Typography.Text>
            <div
              style={{
                marginTop: 8,
                padding: 16,
                border: "1px solid #d9d9d9",
                borderRadius: 8,
                minHeight: 200,
                background: "#fafafa",
              }}
            >
              {imgInfo.name ? (
                <Space direction="vertical" size="small">
                  <Typography.Text>
                    文件名：{imgInfo.name}
                  </Typography.Text>
                  <Typography.Text>
                    文件大小：{formatSize(imgInfo.size)}
                  </Typography.Text>
                  <Typography.Text>
                    尺寸：{imgInfo.width} × {imgInfo.height} px
                  </Typography.Text>
                  <Typography.Text>
                    类型：{imgInfo.type || "未知"}
                  </Typography.Text>
                </Space>
              ) : (
                <Typography.Text type="secondary">暂无信息</Typography.Text>
              )}
            </div>
          </Col>
        </Row>

        {base64 && (
          <>
            <Row justify="space-between" align="middle">
              <Col>
                <Typography.Text strong>Base64 编码结果</Typography.Text>
                <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                  （{base64.length.toLocaleString()} 字符）
                </Typography.Text>
              </Col>
              <Col>
                <Button
                  type="link"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? "收起" : "展开全部"}
                </Button>
              </Col>
            </Row>
            <Input.TextArea
              readOnly
              value={displayText}
              rows={expanded ? 12 : 4}
              style={{
                fontFamily: "monospace",
                fontSize: 12,
                background: "#f5f5f5",
                wordBreak: "break-all",
              }}
            />
          </>
        )}
      </Space>
    </Card>
  );
}
