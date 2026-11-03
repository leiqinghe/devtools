import { useState, useCallback, useEffect } from "react";
import { Card, Input, Button, Space, message, Typography, Row, Col, Table, Tag } from "antd";
import { CopyOutlined, DeleteOutlined } from "@ant-design/icons";

export default function UrlEncode() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [urlParts, setUrlParts] = useState<Record<string, string> | null>(null);
  const [searchParams, setSearchParams] = useState<{ key: string; value: string }[]>([]);

  const encode = useCallback(() => {
    if (!input.trim()) {
      message.warning("请输入文本");
      return;
    }
    try {
      setOutput(encodeURIComponent(input));
      message.success("编码成功");
    } catch {
      message.error("编码失败");
    }
  }, [input]);

  const decode = useCallback(() => {
    if (!input.trim()) {
      message.warning("请输入文本");
      return;
    }
    try {
      setOutput(decodeURIComponent(input));
      message.success("解码成功");
    } catch {
      message.error("解码失败，请检查输入是否为合法的 URL 编码字符串");
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
    setUrlParts(null);
    setSearchParams([]);
  };

  useEffect(() => {
    if (!input.trim()) {
      setUrlParts(null);
      setSearchParams([]);
      return;
    }
    try {
      const url = new URL(input.trim());
      setUrlParts({
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || "-",
        pathname: url.pathname,
        search: url.search || "-",
        hash: url.hash || "-",
      });
    } catch {
      setUrlParts(null);
    }
  }, [input]);

  const parseQueryParams = () => {
    if (!urlParts?.search || urlParts.search === "-") {
      message.warning("没有查询参数");
      return;
    }
    try {
      const params = new URLSearchParams(urlParts.search);
      const entries: { key: string; value: string }[] = [];
      params.forEach((value, key) => {
        entries.push({ key, value });
      });
      setSearchParams(entries);
      if (entries.length === 0) {
        message.warning("没有查询参数");
      }
    } catch {
      message.error("查询参数解析失败");
    }
  };

  return (
    <Card title="URL 编解码">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space>
          <Button type="primary" onClick={encode}>
            编码 (encodeURIComponent)
          </Button>
          <Button onClick={decode}>
            解码 (decodeURIComponent)
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
        {urlParts && (
          <Card type="inner" title="URL 组成部分解析" size="small">
            <Row gutter={[16, 8]}>
              <Col span={4}><Typography.Text strong>协议</Typography.Text></Col>
              <Col span={20}><Tag>{urlParts.protocol}</Tag></Col>
              <Col span={4}><Typography.Text strong>主机</Typography.Text></Col>
              <Col span={20}><Tag>{urlParts.hostname}</Tag></Col>
              <Col span={4}><Typography.Text strong>端口</Typography.Text></Col>
              <Col span={20}><Tag>{urlParts.port}</Tag></Col>
              <Col span={4}><Typography.Text strong>路径</Typography.Text></Col>
              <Col span={20}><Tag>{urlParts.pathname}</Tag></Col>
              <Col span={4}><Typography.Text strong>查询参数</Typography.Text></Col>
              <Col span={20}><Tag>{urlParts.search}</Tag></Col>
              <Col span={4}><Typography.Text strong>哈希</Typography.Text></Col>
              <Col span={20}><Tag>{urlParts.hash}</Tag></Col>
            </Row>
            <Space style={{ marginTop: 12 }}>
              <Button size="small" onClick={parseQueryParams}>解析查询参数</Button>
            </Space>
            {searchParams.length > 0 && (
              <Table
                dataSource={searchParams}
                columns={[
                  { title: "参数名", dataIndex: "key", key: "key" },
                  { title: "参数值", dataIndex: "value", key: "value" },
                ]}
                rowKey="key"
                pagination={false}
                size="small"
                style={{ marginTop: 8 }}
              />
            )}
          </Card>
        )}
      </Space>
    </Card>
  );
}
