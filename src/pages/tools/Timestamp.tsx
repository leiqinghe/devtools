import { useState, useCallback, useEffect } from "react";
import { Card, Input, Select, Button, Space, Typography, message, Row, Col } from "antd";
import { CopyOutlined } from "@ant-design/icons";

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

export default function Timestamp() {
  const [unit, setUnit] = useState<"seconds" | "milliseconds">("seconds");
  const [inputVal, setInputVal] = useState("");
  const [result, setResult] = useState("");
  const [currentTs, setCurrentTs] = useState(nowSeconds);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTs(nowSeconds());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const convertToDate = useCallback(() => {
    const val = inputVal.trim();
    if (!val) {
      message.warning("请输入时间戳");
      return;
    }
    const num = Number(val);
    if (!Number.isFinite(num)) {
      message.error("请输入有效的时间戳数字");
      return;
    }
    const ms = unit === "seconds" ? num * 1000 : num;
    try {
      const date = new Date(ms);
      if (isNaN(date.getTime())) {
        message.error("无效的时间戳");
        return;
      }
      setResult(formatDate(date));
    } catch {
      message.error("转换失败");
    }
  }, [inputVal, unit]);

  const convertToTimestamp = useCallback(() => {
    const val = inputVal.trim();
    if (!val) {
      message.warning("请输入日期");
      return;
    }
    try {
      const date = new Date(val);
      if (isNaN(date.getTime())) {
        message.error("无效的日期格式（如 2024-01-01 12:00:00）");
        return;
      }
      const ms = date.getTime();
      setResult(unit === "seconds" ? String(Math.floor(ms / 1000)) : String(ms));
    } catch {
      message.error("转换失败");
    }
  }, [inputVal, unit]);

  const fillNow = () => {
    const ts = unit === "seconds" ? nowSeconds() : Date.now();
    setInputVal(String(ts));
  };

  const copyResult = () => {
    if (result) {
      navigator.clipboard.writeText(result).then(() => message.success("已复制"));
    }
  };

  return (
    <Card title="时间戳转换">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Row gutter={16} align="middle">
          <Col>
            <Typography.Text>当前时间：</Typography.Text>
            <Typography.Text code>{formatDate(new Date())}</Typography.Text>
          </Col>
          <Col>
            <Typography.Text>当前秒时间戳：</Typography.Text>
            <Typography.Text code>{currentTs}</Typography.Text>
          </Col>
        </Row>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Input
              placeholder="输入时间戳或日期"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              allowClear
              size="large"
            />
          </Col>
          <Col>
            <Select
              value={unit}
              onChange={setUnit}
              size="large"
              options={[
                { value: "seconds", label: "秒" },
                { value: "milliseconds", label: "毫秒" },
              ]}
            />
          </Col>
        </Row>
        <Space>
          <Button type="primary" onClick={convertToDate}>
            时间戳 → 日期
          </Button>
          <Button onClick={convertToTimestamp}>日期 → 时间戳</Button>
          <Button onClick={fillNow}>填入当前时间戳</Button>
        </Space>
        {result && (
          <Card size="small" type="inner">
            <Space>
              <Typography.Text strong>结果：</Typography.Text>
              <Typography.Text copyable style={{ fontSize: 16 }}>
                {result}
              </Typography.Text>
              <Button size="small" icon={<CopyOutlined />} onClick={copyResult} />
            </Space>
          </Card>
        )}
      </Space>
    </Card>
  );
}
