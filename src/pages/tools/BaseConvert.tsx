import { useState, useEffect } from "react";
import { Card, Input, Select, Space, Typography, Row, Col, Table } from "antd";

const BASE_OPTIONS = [
  { value: 2, label: "二进制 (Base 2)" },
  { value: 8, label: "八进制 (Base 8)" },
  { value: 10, label: "十进制 (Base 10)" },
  { value: 16, label: "十六进制 (Base 16)" },
];

const DIGIT_SET = "0123456789ABCDEF";

function isValidForBase(val: string, base: number): boolean {
  if (!val) return false;
  const allowed = DIGIT_SET.slice(0, base).split("");
  return val
    .toUpperCase()
    .split("")
    .every((ch) => allowed.includes(ch));
}

const BASES = [
  { base: 2, label: "二进制 (Bin)" },
  { base: 8, label: "八进制 (Oct)" },
  { base: 10, label: "十进制 (Dec)" },
  { base: 16, label: "十六进制 (Hex)" },
];

const QUICK_REF_DATA = Array.from({ length: 16 }, (_, i) => ({
  dec: i,
  bin: i.toString(2),
  oct: i.toString(8),
  hex: i.toString(16).toUpperCase(),
}));

const QUICK_REF_COLUMNS = [
  { title: "十进制", dataIndex: "dec", key: "dec" },
  { title: "二进制", dataIndex: "bin", key: "bin" },
  { title: "八进制", dataIndex: "oct", key: "oct" },
  { title: "十六进制", dataIndex: "hex", key: "hex" },
];

export default function BaseConvert() {
  const [inputVal, setInputVal] = useState("");
  const [sourceBase, setSourceBase] = useState(10);
  const [results, setResults] = useState<Record<number, string>>({});

  useEffect(() => {
    const trimmed = inputVal.trim();
    if (!trimmed || !isValidForBase(trimmed, sourceBase)) {
      setResults({});
      return;
    }
    try {
      const decimal = parseInt(trimmed, sourceBase);
      if (Number.isNaN(decimal)) {
        setResults({});
        return;
      }
      const newResults: Record<number, string> = {};
      for (const { base } of BASES) {
        newResults[base] = decimal.toString(base).toUpperCase();
      }
      setResults(newResults);
    } catch {
      setResults({});
    }
  }, [inputVal, sourceBase]);

  return (
    <Card title="进制转换">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Input
              placeholder="输入要转换的数值"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              allowClear
              size="large"
            />
          </Col>
          <Col>
            <Typography.Text>源进制</Typography.Text>
            <Select
              value={sourceBase}
              onChange={setSourceBase}
              options={BASE_OPTIONS}
              size="large"
              style={{ width: 200, marginTop: 4 }}
            />
          </Col>
        </Row>
        {Object.keys(results).length > 0 && (
          <Row gutter={[12, 12]}>
            {BASES.map(({ base, label }) => (
              <Col span={12} key={base}>
                <Card size="small" type="inner">
                  <Typography.Text strong>{label}：</Typography.Text>
                  <Typography.Text
                    copyable
                    style={{ fontSize: 16, fontFamily: "monospace", marginLeft: 8 }}
                  >
                    {results[base]}
                  </Typography.Text>
                </Card>
              </Col>
            ))}
          </Row>
        )}
        <Card size="small" title="快速参考 (0-15)" type="inner">
          <Table
            columns={QUICK_REF_COLUMNS}
            dataSource={QUICK_REF_DATA}
            size="small"
            pagination={false}
            rowKey="dec"
          />
        </Card>
      </Space>
    </Card>
  );
}
