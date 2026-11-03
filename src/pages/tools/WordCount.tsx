import { useState, useMemo } from "react";
import { Card, Input, Typography, Row, Col, Space } from "antd";

interface Stats {
  totalChars: number;
  charsNoSpaces: number;
  totalWords: number;
  totalLines: number;
  paragraphs: number;
  chineseChars: number;
  englishWords: number;
  numbers: number;
  punctuation: number;
}

function countStats(text: string): Stats {
  const lines = text.split("\n");
  const totalLines = lines.length;
  const paragraphs = text
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 0).length;

  const totalChars = text.length;
  const charsNoSpaces = (text.match(/\S/g) || []).length;

  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = (
    text.match(/[a-zA-Z]+/g) || []
  ).length;
  const numbers = (text.match(/\d+/g) || []).length;
  const punctuation = (
    text.match(
      /[，。；：？！""''「」『』【】、《》…—～,.?!;:'"()\[\]{}\-]|[\p{P}\p{S}]/gu
    ) || []
  ).length;

  const totalWords = chineseChars + englishWords;

  return {
    totalChars,
    charsNoSpaces,
    totalWords,
    totalLines,
    paragraphs,
    chineseChars,
    englishWords,
    numbers,
    punctuation,
  };
}

function StatItem({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      style={{
        padding: "16px 12px",
        border: "1px solid #d9d9d9",
        borderRadius: 8,
        background: "#fafafa",
        textAlign: "center",
      }}
    >
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Typography.Text>
      <div>
        <Typography.Text strong style={{ fontSize: 22 }}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </Typography.Text>
      </div>
    </div>
  );
}

export default function WordCount() {
  const [text, setText] = useState("");
  const stats = useMemo(() => countStats(text), [text]);

  return (
    <Card title="字数统计">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <div>
          <Typography.Text strong>输入文本</Typography.Text>
          <Input.TextArea
            rows={12}
            placeholder="输入或粘贴文本..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ fontFamily: "monospace", fontSize: 13 }}
          />
        </div>

        <Row gutter={[12, 12]}>
          <Col xs={12} sm={8} md={6}>
            <StatItem label="总字符（含空格）" value={stats.totalChars} />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <StatItem label="总字符（不含空格）" value={stats.charsNoSpaces} />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <StatItem label="总字数" value={stats.totalWords} />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <StatItem label="总行数" value={stats.totalLines} />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <StatItem label="段落数" value={stats.paragraphs} />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <StatItem label="中文字符" value={stats.chineseChars} />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <StatItem label="英文单词" value={stats.englishWords} />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <StatItem label="数字个数" value={stats.numbers} />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <StatItem label="标点符号" value={stats.punctuation} />
          </Col>
        </Row>
      </Space>
    </Card>
  );
}
