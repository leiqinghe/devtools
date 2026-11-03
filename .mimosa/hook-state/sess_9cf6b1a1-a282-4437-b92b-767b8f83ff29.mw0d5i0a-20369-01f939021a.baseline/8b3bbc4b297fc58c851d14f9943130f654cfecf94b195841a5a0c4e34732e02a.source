import { useState, useCallback } from "react";
import { Card, Input, Button, Space, message, Typography, Row, Col, Tabs, Upload } from "antd";
import { CopyOutlined, DeleteOutlined, InboxOutlined } from "@ant-design/icons";

const { Dragger } = Upload;

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(binary);
}

function base64ToUtf8(str: string): string {
  const binary = atob(str);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export default function Base64Tool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  const encode = useCallback(() => {
    if (!input.trim()) {
      message.warning("请输入文本");
      return;
    }
    try {
      setOutput(utf8ToBase64(input));
      message.success("编码成功");
    } catch {
      message.error("编码失败");
    }
  }, [input]);

  const decode = useCallback(() => {
    if (!input.trim()) {
      message.warning("请输入 Base64 文本");
      return;
    }
    try {
      setOutput(base64ToUtf8(input.trim()));
      message.success("解码成功");
    } catch {
      message.error("解码失败，请检查输入是否为有效的 Base64 字符串");
    }
  }, [input]);

  const copy = () => {
    const text = output || input;
    if (text) {
      navigator.clipboard.writeText(text).then(() => message.success("已复制"));
    }
  };

  const clear = () => {
    setInput("");
    setOutput("");
  };

  const [fileResult, setFileResult] = useState("");
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setFileResult(reader.result as string);
      setFileInfo({ name: file.name, size: file.size });
      message.success("文件读取成功");
    };
    reader.onerror = () => message.error("文件读取失败");
    reader.readAsDataURL(file);
    return false;
  };

  const copyFileResult = () => {
    if (fileResult) {
      navigator.clipboard.writeText(fileResult).then(() => message.success("已复制"));
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const textTab = (
    <Card title="Base64 编解码">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space>
          <Button type="primary" onClick={encode}>
            Base64 编码 (UTF-8)
          </Button>
          <Button onClick={decode}>Base64 解码</Button>
          <Button icon={<CopyOutlined />} onClick={copy}>
            复制结果
          </Button>
          <Button icon={<DeleteOutlined />} onClick={clear}>
            清空
          </Button>
        </Space>
        <Row gutter={16}>
          <Col xs={24} lg={12}>
            <Typography.Text strong>输入</Typography.Text>
            <Input.TextArea
              placeholder="输入要编解码的文本"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={16}
              style={{ fontFamily: "monospace", fontSize: 13 }}
            />
          </Col>
          <Col xs={24} lg={12}>
            <Typography.Text strong>输出</Typography.Text>
            <Input.TextArea
              readOnly
              value={output}
              rows={16}
              style={{
                fontFamily: "monospace",
                fontSize: 13,
                background: "#f5f5f5",
              }}
            />
          </Col>
        </Row>
      </Space>
    </Card>
  );

  const fileTab = (
    <Card title="Base64 文件编码">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Dragger
          accept="*/*"
          beforeUpload={handleFileUpload}
          showUploadList={false}
          multiple={false}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">文件将被读取为 Base64 Data URL</p>
        </Dragger>
        {fileInfo && (
          <Card size="small" style={{ background: "#f5f5f5" }}>
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              <Typography.Text>
                文件名：{fileInfo.name}
              </Typography.Text>
              <Typography.Text>
                文件大小：{formatSize(fileInfo.size)}
              </Typography.Text>
              {fileResult && (
                <>
                  <Typography.Text strong>Base64 结果：</Typography.Text>
                  <Input.TextArea
                    readOnly
                    value={fileResult}
                    rows={10}
                    style={{ fontFamily: "monospace", fontSize: 11, background: "#fff" }}
                  />
                  <Button icon={<CopyOutlined />} onClick={copyFileResult}>
                    复制结果
                  </Button>
                </>
              )}
            </Space>
          </Card>
        )}
      </Space>
    </Card>
  );

  return (
    <Tabs
      defaultActiveKey="text"
      items={[
        { key: "text", label: "文本模式", children: textTab },
        { key: "file", label: "文件模式", children: fileTab },
      ]}
    />
  );
}
