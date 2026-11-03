import { useState, useCallback } from "react";
import { Card, Input, Button, Space, message, Typography, Checkbox, Row, Col } from "antd";
import { CopyOutlined, SearchOutlined } from "@ant-design/icons";

const PATTERNS: Record<string, { label: string; regex: RegExp; color: string }> = {
  email: {
    label: "邮箱地址",
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    color: "#1677ff",
  },
  mobile: {
    label: "手机号码",
    regex: /1[3-9]\d{9}/g,
    color: "#52c41a",
  },
  phone: {
    label: "电话号码",
    regex: /(?:(?:\+\d{1,3}[- ]?)?\d{3,4}[- ]?\d{7,8})|(?:\d{3,4}[- ]?\d{7,8})/g,
    color: "#fa8c16",
  },
  url: {
    label: "网址",
    regex: /https?:\/\/[^\s<>"'，。；;!]*/g,
    color: "#722ed1",
  },
  ip: {
    label: "IP地址",
    regex: /(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)/g,
    color: "#13c2c2",
  },
  idcard: {
    label: "身份证号",
    regex: /[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]/g,
    color: "#eb2f96",
  },
};

type ExtractKey = keyof typeof PATTERNS;

export default function InfoExtract() {
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<ExtractKey[]>(["email", "mobile"]);
  const [results, setResults] = useState<Record<ExtractKey, string[]>>(
    {} as Record<ExtractKey, string[]>
  );

  const toggle = useCallback((key: ExtractKey, checked: boolean) => {
    setSelected((prev) => (checked ? [...prev, key] : prev.filter((k) => k !== key)));
  }, []);

  const extract = useCallback(() => {
    if (!text.trim()) {
      message.warning("请输入文本");
      return;
    }
    if (selected.length === 0) {
      message.warning("请选择要提取的类型");
      return;
    }
    const newResults = {} as Record<ExtractKey, string[]>;
    selected.forEach((key) => {
      const matches = text.match(PATTERNS[key].regex);
      newResults[key] = matches ? [...new Set(matches)] : [];
    });
    setResults(newResults);
    const total = Object.values(newResults).reduce((sum, arr) => sum + arr.length, 0);
    if (total === 0) {
      message.info("未提取到任何信息");
    } else {
      message.success(`共提取 ${total} 条信息`);
    }
  }, [text, selected]);

  const copyItem = (value: string) => {
    navigator.clipboard.writeText(value).then(() => message.success("已复制"));
  };

  const copyAll = () => {
    const all = selected.flatMap((key) => results[key] || []).join("\n");
    if (all) {
      navigator.clipboard.writeText(all).then(() => message.success("已批量复制"));
    }
  };

  const totalCount = selected.reduce((sum, key) => sum + (results[key]?.length || 0), 0);

  return (
    <Card title="信息提取">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <div>
          <Typography.Text strong>选择提取类型</Typography.Text>
          <div style={{ marginTop: 8 }}>
            {(Object.keys(PATTERNS) as ExtractKey[]).map((key) => (
              <Checkbox
                key={key}
                checked={selected.includes(key)}
                onChange={(e) => toggle(key, e.target.checked)}
                style={{ marginRight: 16, marginBottom: 8 }}
              >
                {PATTERNS[key].label}
              </Checkbox>
            ))}
          </div>
        </div>
        <div>
          <Typography.Text strong>粘贴文本</Typography.Text>
          <Input.TextArea
            placeholder="粘贴包含信息的原始文本..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            style={{ marginTop: 8 }}
          />
        </div>
        <Space>
          <Button type="primary" icon={<SearchOutlined />} onClick={extract} size="large">
            提取
          </Button>
          {totalCount > 0 && (
            <Button icon={<CopyOutlined />} onClick={copyAll}>
              批量复制全部（{totalCount} 条）
            </Button>
          )}
        </Space>
        {selected.map((key) => {
          const items = results[key] || [];
          return (
            <Card
              key={key}
              size="small"
              title={
                <Space>
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      backgroundColor: PATTERNS[key].color,
                    }}
                  />
                  <span>{PATTERNS[key].label}</span>
                  <Typography.Text type="secondary">({items.length})</Typography.Text>
                </Space>
              }
            >
              {items.length === 0 ? (
                <Typography.Text type="secondary">暂无结果</Typography.Text>
              ) : (
                <Space direction="vertical" size="small" style={{ width: "100%" }}>
                  {items.map((item, idx) => (
                    <Row
                      key={idx}
                      justify="space-between"
                      align="middle"
                      style={{
                        padding: "4px 8px",
                        background: idx % 2 === 0 ? "#fafafa" : "#fff",
                        borderRadius: 4,
                      }}
                    >
                      <Col>
                        <Typography.Text code style={{ wordBreak: "break-all" }}>
                          {item}
                        </Typography.Text>
                      </Col>
                      <Col>
                        <Button
                          type="link"
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => copyItem(item)}
                        />
                      </Col>
                    </Row>
                  ))}
                </Space>
              )}
            </Card>
          );
        })}
      </Space>
    </Card>
  );
}
