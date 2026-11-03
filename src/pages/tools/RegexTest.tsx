import { useState, useEffect, useMemo } from "react";
import {
  Card,
  Input,
  Button,
  Space,
  message,
  Typography,
  Row,
  Col,
  Select,
} from "antd";
import { ClearOutlined, CopyOutlined } from "@ant-design/icons";

interface MatchItem {
  index: number;
  value: string;
  groups: string[];
}

export default function RegexTest() {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("g");
  const [text, setText] = useState("");
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [matchCount, setMatchCount] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!pattern || !text) {
      setMatches([]);
      setMatchCount(0);
      setError("");
      return;
    }

    try {
      const regex = new RegExp(pattern, flags);
      const results: MatchItem[] = [];
      let match;

      if (flags.includes("g")) {
        while ((match = regex.exec(text)) !== null) {
          results.push({
            index: match.index,
            value: match[0],
            groups: match.slice(1),
          });
          if (match.index === regex.lastIndex) {
            regex.lastIndex++;
          }
        }
      } else {
        match = regex.exec(text);
        if (match) {
          results.push({
            index: match.index,
            value: match[0],
            groups: match.slice(1),
          });
        }
      }

      setMatches(results);
      setMatchCount(results.length);
      setError("");
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message);
      setMatches([]);
      setMatchCount(0);
    }
  }, [pattern, flags, text]);

  const flagOptions = useMemo(
    () => [
      { value: "g", label: "g (全局)" },
      { value: "i", label: "i (忽略大小写)" },
      { value: "m", label: "m (多行)" },
      { value: "s", label: "s (点匹配换行)" },
      { value: "u", label: "u (Unicode)" },
    ],
    []
  );

  const copy = () => {
    if (matches.length > 0) {
      const content = matches
        .map((m, i) => `[${i + 1}] index=${m.index}: "${m.value}"`)
        .join("\n");
      navigator.clipboard.writeText(content).then(
        () => message.success("已复制匹配结果"),
        () => message.error("复制失败")
      );
    }
  };

  const clear = () => {
    setPattern("");
    setFlags("g");
    setText("");
    setMatches([]);
    setMatchCount(0);
    setError("");
  };

  return (
    <Card title="正则表达式测试">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Typography.Text strong>正则表达式</Typography.Text>
            <Input
              placeholder="例如：\\d+"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              style={{ fontFamily: "monospace" }}
              allowClear
            />
          </Col>
          <Col span={8}>
            <Typography.Text strong>标志 (Flags)</Typography.Text>
            <Select
              mode="multiple"
              value={flags.split("").filter(Boolean)}
              onChange={(values: string[]) => setFlags(values.join(""))}
              options={flagOptions}
              style={{ width: "100%" }}
              placeholder="选择标志"
            />
          </Col>
          <Col span={8}>
            <Space style={{ marginTop: 22 }}>
              <Button onClick={copy} icon={<CopyOutlined />} disabled={matches.length === 0}>
                复制结果
              </Button>
              <Button onClick={clear} icon={<ClearOutlined />}>
                清空
              </Button>
            </Space>
          </Col>
        </Row>

        <div>
          <Typography.Text strong>测试文本</Typography.Text>
          <Input.TextArea
            rows={8}
            placeholder="输入要测试的文本..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ fontFamily: "monospace", fontSize: 13 }}
          />
        </div>

        {error && (
          <Typography.Text type="danger">
            正则表达式错误：{error}
          </Typography.Text>
        )}

        {!error && pattern && text && (
          <Row gutter={16}>
            <Col span={8}>
              <div
                style={{
                  padding: 16,
                  border: "1px solid #d9d9d9",
                  borderRadius: 8,
                  background: "#fafafa",
                }}
              >
                <Typography.Text strong>匹配数量：</Typography.Text>
                <Typography.Text style={{ fontSize: 24, marginLeft: 8 }}>
                  {matchCount}
                </Typography.Text>
              </div>
            </Col>
            <Col span={16}>
              <div
                style={{
                  padding: 16,
                  border: "1px solid #d9d9d9",
                  borderRadius: 8,
                  maxHeight: 400,
                  overflowY: "auto",
                }}
              >
                <Typography.Text strong>匹配结果</Typography.Text>
                {matches.length === 0 && pattern && text && (
                  <div style={{ marginTop: 8 }}>
                    <Typography.Text type="secondary">
                      无匹配
                    </Typography.Text>
                  </div>
                )}
                {matches.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "6px 0",
                      borderBottom: "1px solid #f0f0f0",
                      fontFamily: "monospace",
                      fontSize: 13,
                    }}
                  >
                    <Typography.Text type="secondary">
                      [{i + 1}] index={m.index}:
                    </Typography.Text>{" "}
                    <Typography.Text code>
                      {m.value || "(空字符串)"}
                    </Typography.Text>
                    {m.groups.length > 0 && (
                      <Typography.Text type="secondary">
                        {" "}
                        groups: {JSON.stringify(m.groups)}
                      </Typography.Text>
                    )}
                  </div>
                ))}
              </div>
            </Col>
          </Row>
        )}
      </Space>
    </Card>
  );
}
