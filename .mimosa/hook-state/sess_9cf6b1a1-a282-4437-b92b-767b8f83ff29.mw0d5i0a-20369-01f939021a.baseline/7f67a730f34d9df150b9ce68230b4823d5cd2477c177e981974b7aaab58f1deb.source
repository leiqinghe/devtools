import { useState, useCallback } from "react";
import { Card, Input, Button, Space, message, Typography, Row, Col } from "antd";
import {
  FormatPainterOutlined,
  CompressOutlined,
  CopyOutlined,
  DeleteOutlined,
} from "@ant-design/icons";

export default function JsonFormat() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [indent, setIndent] = useState(2);

  const format = useCallback(() => {
    if (!input.trim()) {
      message.warning("请输入 JSON 内容");
      return;
    }
    try {
      const obj = JSON.parse(input);
      setOutput(JSON.stringify(obj, null, indent));
      message.success("格式化成功");
    } catch (e: unknown) {
      const err = e as Error;
      message.error(`JSON 解析错误: ${err.message}`);
    }
  }, [input, indent]);

  const compress = useCallback(() => {
    if (!input.trim()) {
      message.warning("请输入 JSON 内容");
      return;
    }
    try {
      const obj = JSON.parse(input);
      setOutput(JSON.stringify(obj));
      message.success("压缩成功");
    } catch (e: unknown) {
      const err = e as Error;
      message.error(`JSON 解析错误: ${err.message}`);
    }
  }, [input]);

  const validate = useCallback(() => {
    if (!input.trim()) {
      message.warning("请输入 JSON 内容");
      return;
    }
    try {
      JSON.parse(input);
      message.success("JSON 格式正确");
    } catch (e: unknown) {
      const err = e as Error;
      message.error(`JSON 格式错误: ${err.message}`);
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

  return (
    <Card title="JSON 格式化">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space>
          <Button type="primary" icon={<FormatPainterOutlined />} onClick={format}>
            格式化
          </Button>
          <Button icon={<CompressOutlined />} onClick={compress}>
            压缩
          </Button>
          <Button onClick={validate}>校验</Button>
          <Button icon={<CopyOutlined />} onClick={copy}>
            复制结果
          </Button>
          <Button icon={<DeleteOutlined />} onClick={clear}>
            清空
          </Button>
          <Space>
            <Typography.Text>缩进空格数：</Typography.Text>
            <Input
              type="number"
              min={1}
              max={8}
              value={indent}
              onChange={(e) => setIndent(Number(e.target.value) || 2)}
              style={{ width: 60 }}
            />
          </Space>
        </Space>
        <Row gutter={16}>
          <Col xs={24} lg={12}>
            <Typography.Text strong>输入</Typography.Text>
            <Input.TextArea
              placeholder='粘贴 JSON 内容，如：{"name":"hello"}'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={18}
              style={{ fontFamily: "monospace", fontSize: 13 }}
            />
          </Col>
          <Col xs={24} lg={12}>
            <Typography.Text strong>输出</Typography.Text>
            <Input.TextArea
              readOnly
              value={output}
              rows={18}
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
}
