import { useState, useMemo } from "react";
import {
  Card,
  DatePicker,
  Typography,
  Space,
  Row,
  Col,
  InputNumber,
  Select,
  Button,
} from "antd";
import type { Dayjs } from "dayjs";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

type Mode = "diff" | "calc";

const ADD_UNITS = [
  { label: "天", value: "day" },
  { label: "周", value: "week" },
  { label: "月", value: "month" },
];

export default function DateCalc() {
  const [mode, setMode] = useState<Mode>("diff");
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [addAmount, setAddAmount] = useState<number>(0);
  const [addUnit, setAddUnit] = useState<string>("day");
  const [calcResult, setCalcResult] = useState<Dayjs | null>(null);

  const diffResult = useMemo(() => {
    if (!startDate || !endDate) return null;
    const start = startDate.startOf("day");
    const end = endDate.startOf("day");
    const absDiff = Math.abs(end.diff(start, "day"));
    const weeks = Math.floor(absDiff / 7);
    const months = Math.abs(end.diff(start, "month"));
    const years = Math.abs(end.diff(start, "year"));
    const startWeekday = WEEKDAYS[start.day()];
    const endWeekday = WEEKDAYS[end.day()];
    const startIsWorkday = start.day() !== 0 && start.day() !== 6;
    const endIsWorkday = end.day() !== 0 && end.day() !== 6;
    return {
      days: absDiff,
      weeks,
      months,
      years,
      startWeekday,
      endWeekday,
      startIsWorkday,
      endIsWorkday,
    };
  }, [startDate, endDate]);

  const handleCalc = () => {
    if (!startDate) return;
    let result: Dayjs;
    if (addUnit === "week") {
      result = startDate.add(addAmount, "week");
    } else if (addUnit === "month") {
      result = startDate.add(addAmount, "month");
    } else {
      result = startDate.add(addAmount, "day");
    }
    setCalcResult(result);
  };

  return (
    <Card title="日期计算器">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space>
          <Button
            type={mode === "diff" ? "primary" : "default"}
            onClick={() => setMode("diff")}
          >
            日期差值
          </Button>
          <Button
            type={mode === "calc" ? "primary" : "default"}
            onClick={() => setMode("calc")}
          >
            日期推算
          </Button>
        </Space>

        {mode === "diff" && (
          <>
            <Row gutter={16}>
              <Col>
                <Typography.Text strong>开始日期</Typography.Text>
                <br />
                <DatePicker
                  value={startDate}
                  onChange={(v) => setStartDate(v)}
                  placeholder="选择开始日期"
                  style={{ width: 200 }}
                />
              </Col>
              <Col>
                <Typography.Text strong>结束日期</Typography.Text>
                <br />
                <DatePicker
                  value={endDate}
                  onChange={(v) => setEndDate(v)}
                  placeholder="选择结束日期"
                  style={{ width: 200 }}
                />
              </Col>
            </Row>

            {diffResult && (
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={6}>
                  <Card size="small">
                    <Typography.Text type="secondary">相差天数</Typography.Text>
                    <Typography.Title level={4} style={{ margin: 0 }}>
                      {diffResult.days} 天
                    </Typography.Title>
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card size="small">
                    <Typography.Text type="secondary">相差周数</Typography.Text>
                    <Typography.Title level={4} style={{ margin: 0 }}>
                      {diffResult.weeks} 周
                    </Typography.Title>
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card size="small">
                    <Typography.Text type="secondary">相差月数</Typography.Text>
                    <Typography.Title level={4} style={{ margin: 0 }}>
                      {diffResult.months} 月
                    </Typography.Title>
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card size="small">
                    <Typography.Text type="secondary">相差年数</Typography.Text>
                    <Typography.Title level={4} style={{ margin: 0 }}>
                      {diffResult.years} 年
                    </Typography.Title>
                  </Card>
                </Col>
                <Col xs={24} sm={12}>
                  <Card size="small">
                    <Typography.Text type="secondary">开始日期</Typography.Text>
                    <Typography.Title level={5} style={{ margin: 0 }}>
                      周{diffResult.startWeekday}{" "}
                      {diffResult.startIsWorkday ? "工作日" : "周末"}
                    </Typography.Title>
                  </Card>
                </Col>
                <Col xs={24} sm={12}>
                  <Card size="small">
                    <Typography.Text type="secondary">结束日期</Typography.Text>
                    <Typography.Title level={5} style={{ margin: 0 }}>
                      周{diffResult.endWeekday}{" "}
                      {diffResult.endIsWorkday ? "工作日" : "周末"}
                    </Typography.Title>
                  </Card>
                </Col>
              </Row>
            )}
          </>
        )}

        {mode === "calc" && (
          <>
            <Row gutter={16} align="bottom">
              <Col>
                <Typography.Text strong>开始日期</Typography.Text>
                <br />
                <DatePicker
                  value={startDate}
                  onChange={(v) => setStartDate(v)}
                  placeholder="选择开始日期"
                  style={{ width: 200 }}
                />
              </Col>
              <Col>
                <Typography.Text>+</Typography.Text>
              </Col>
              <Col>
                <InputNumber
                  value={addAmount}
                  onChange={(v) => setAddAmount(v ?? 0)}
                  min={0}
                  style={{ width: 100 }}
                />
              </Col>
              <Col>
                <Select
                  value={addUnit}
                  onChange={(v) => setAddUnit(v)}
                  options={ADD_UNITS}
                  style={{ width: 80 }}
                />
              </Col>
              <Col>
                <Button type="primary" onClick={handleCalc}>
                  计算
                </Button>
              </Col>
            </Row>

            {calcResult && (
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <Card size="small">
                    <Typography.Text type="secondary">结果日期</Typography.Text>
                    <Typography.Title level={4} style={{ margin: 0 }}>
                      {calcResult.format("YYYY-MM-DD")}
                    </Typography.Title>
                  </Card>
                </Col>
                <Col xs={24} sm={12}>
                  <Card size="small">
                    <Typography.Text type="secondary">星期</Typography.Text>
                    <Typography.Title level={4} style={{ margin: 0 }}>
                      周{WEEKDAYS[calcResult.day()]}{" "}
                      {calcResult.day() !== 0 && calcResult.day() !== 6
                        ? "工作日"
                        : "周末"}
                    </Typography.Title>
                  </Card>
                </Col>
              </Row>
            )}
          </>
        )}
      </Space>
    </Card>
  );
}
