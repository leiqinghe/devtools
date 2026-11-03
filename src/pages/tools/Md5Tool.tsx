import { useState, useCallback } from "react";
import { Card, Input, Button, Space, message, Typography, Row, Col, Select, Tabs, Upload } from "antd";
import { CopyOutlined, DeleteOutlined, InboxOutlined } from "@ant-design/icons";
import CryptoJS from "crypto-js";

const { Dragger } = Upload;

const ALGORITHMS = [
  { label: "MD5", value: "MD5" },
  { label: "SHA-1", value: "SHA1" },
  { label: "SHA-256", value: "SHA256" },
  { label: "SHA-512", value: "SHA512" },
];

function hashText(text: string, algo: string): string {
  switch (algo) {
    case "MD5":
      return CryptoJS.MD5(text).toString();
    case "SHA1":
      return CryptoJS.SHA1(text).toString();
    case "SHA256":
      return CryptoJS.SHA256(text).toString();
    case "SHA512":
      return CryptoJS.SHA512(text).toString();
    default:
      return CryptoJS.MD5(text).toString();
  }
}

export default function Md5Tool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [uppercase, setUppercase] = useState(false);
  const [algorithm, setAlgorithm] = useState("MD5");
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);

  const compute = useCallback(() => {
    if (!input) {
      message.warning("请输入文本");
      return;
    }
    try {
      const hash = hashText(input, algorithm);
      setOutput(uppercase ? hash.toUpperCase() : hash);
      message.success(`${algorithm} 计算成功`);
    } catch {
      message.error("计算失败");
    }
  }, [input, uppercase, algorithm]);

  const computeFileHash = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
      let hash: string;
      switch (algorithm) {
        case "MD5":
          hash = CryptoJS.MD5(wordArray).toString();
          break;
        case "SHA1":
          hash = CryptoJS.SHA1(wordArray).toString();
          break;
        case "SHA256":
          hash = CryptoJS.SHA256(wordArray).toString();
          break;
        case "SHA512":
          hash = CryptoJS.SHA512(wordArray).toString();
          break;
        default:
          hash = CryptoJS.MD5(wordArray).toString();
      }
      const result = uppercase ? hash.toUpperCase() : hash;
      setOutput(result);
      setFileInfo({ name: file.name, size: file.size });
      message.success(`文件 ${algorithm} 计算成功`);
    };
    reader.onerror = () => message.error("文件读取失败");
    reader.readAsArrayBuffer(file);
    return false;
  };

  const toggleCase = () => {
    setUppercase(!uppercase);
    if (output) {
      setOutput(uppercase ? output.toLowerCase() : output.toUpperCase());
    }
  };

  const copy = () => {
    if (output) {
      navigator.clipboard.writeText(output).then(() => message.success("已复制"));
    }
  };

  const clear = () => {
    setInput("");
    setOutput("");
    setFileInfo(null);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const algorithmSelector = (
    <Select
      value={algorithm}
      onChange={(v) => setAlgorithm(v)}
      options={ALGORITHMS}
      style={{ width: 120 }}
    />
  );

  const textTab = (
    <Card title="文本哈希">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space wrap>
          {algorithmSelector}
          <Button type="primary" onClick={compute}>
            计算 {algorithm}
          </Button>
          <Button onClick={toggleCase}>
            {uppercase ? "切换为小写" : "切换为大写"}
          </Button>
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
              placeholder="输入要计算哈希的文本"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={16}
              style={{ fontFamily: "monospace", fontSize: 13 }}
            />
          </Col>
          <Col xs={24} lg={12}>
            <Typography.Text strong>{algorithm} 结果{uppercase ? " (大写)" : " (小写)"}</Typography.Text>
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
    <Card title="文件哈希">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space wrap>
          {algorithmSelector}
        </Space>
        <Dragger
          accept="*/*"
          beforeUpload={computeFileHash}
          showUploadList={false}
          multiple={false}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">将计算文件的 {algorithm} 哈希值</p>
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
              {output && (
                <>
                  <Typography.Text strong>{algorithm} 结果：</Typography.Text>
                  <Input.TextArea
                    readOnly
                    value={output}
                    rows={4}
                    style={{ fontFamily: "monospace", fontSize: 13, background: "#fff" }}
                  />
                  <Space>
                    <Button icon={<CopyOutlined />} onClick={copy}>
                      复制结果
                    </Button>
                    <Button onClick={toggleCase}>
                      {uppercase ? "切换为小写" : "切换为大写"}
                    </Button>
                  </Space>
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
        { key: "text", label: "文本哈希", children: textTab },
        { key: "file", label: "文件哈希", children: fileTab },
      ]}
    />
  );
}
