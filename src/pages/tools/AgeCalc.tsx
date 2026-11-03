import { useState, useMemo } from "react";
import { Card, DatePicker, Typography, Space, Row, Col } from "antd";
import dayjs, { Dayjs } from "dayjs";

const ZODIAC = ["猴", "鸡", "狗", "猪", "鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊"];

const WESTERN_ZODIAC: { name: string; start: [number, number]; end: [number, number] }[] = [
  { name: "水瓶座", start: [1, 20], end: [2, 18] },
  { name: "双鱼座", start: [2, 19], end: [3, 20] },
  { name: "白羊座", start: [3, 21], end: [4, 19] },
  { name: "金牛座", start: [4, 20], end: [5, 20] },
  { name: "双子座", start: [5, 21], end: [6, 21] },
  { name: "巨蟹座", start: [6, 22], end: [7, 22] },
  { name: "狮子座", start: [7, 23], end: [8, 22] },
  { name: "处女座", start: [8, 23], end: [9, 22] },
  { name: "天秤座", start: [9, 23], end: [10, 23] },
  { name: "天蝎座", start: [10, 24], end: [11, 22] },
  { name: "射手座", start: [11, 23], end: [12, 21] },
  { name: "摩羯座", start: [12, 22], end: [1, 19] },
];

function getWesternZodiac(month: number, day: number): string {
  for (const z of WESTERN_ZODIAC) {
    const [sm, sd] = z.start;
    const [em, ed] = z.end;
    if (sm <= em) {
      if (
        (month === sm && day >= sd) ||
        (month > sm && month < em) ||
        (month === em && day <= ed)
      ) {
        return z.name;
      }
    } else {
      if (
        (month === sm && day >= sd) ||
        month > sm ||
        month < em ||
        (month === em && day <= ed)
      ) {
        return z.name;
      }
    }
  }
  return "摩羯座";
}

export default function AgeCalc() {
  const [birthDate, setBirthDate] = useState<Dayjs | null>(null);
  const [targetDate, setTargetDate] = useState<Dayjs | null>(dayjs());

  const result = useMemo(() => {
    if (!birthDate) return null;
    const target = targetDate || dayjs();
    const birth = birthDate.startOf("day");
    const now = target.startOf("day");

    if (birth.isAfter(now)) {
      return { error: "出生日期不能晚于目标日期" };
    }

    let years = now.year() - birth.year();
    let months = now.month() - birth.month();
    let days = now.date() - birth.date();

    if (days < 0) {
      months -= 1;
      const prevMonth = now.subtract(1, "month");
      days += prevMonth.daysInMonth();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    const totalDays = now.diff(birth, "day");
    const totalWeeks = Math.floor(totalDays / 7);
    const totalMonths = now.diff(birth, "month");

    const nextBirthday = birth.year() < now.year()
      ? birth.year(now.year()).startOf("day")
      : birth.startOf("day");
    const nextBday = nextBirthday.isBefore(now)
      ? nextBirthday.add(1, "year")
      : nextBirthday;
    const countdown = nextBday.diff(now, "day");

    const chineseZodiac = ZODIAC[birth.year() % 12];
    const westernZodiac = getWesternZodiac(birth.month() + 1, birth.date());

    return {
      years,
      months,
      days,
      totalDays,
      totalWeeks,
      totalMonths,
      countdown,
      chineseZodiac,
      westernZodiac,
    };
  }, [birthDate, targetDate]);

  return (
    <Card title="年龄计算器">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Row gutter={16}>
          <Col>
            <Typography.Text strong>出生日期</Typography.Text>
            <br />
            <DatePicker
              value={birthDate}
              onChange={(v) => setBirthDate(v)}
              placeholder="选择出生日期"
              style={{ width: 200 }}
            />
          </Col>
          <Col>
            <Typography.Text strong>目标日期（默认今天）</Typography.Text>
            <br />
            <DatePicker
              value={targetDate}
              onChange={(v) => setTargetDate(v)}
              placeholder="选择目标日期"
              style={{ width: 200 }}
              allowClear
            />
          </Col>
        </Row>

        {result && "error" in result && (
          <Typography.Text type="danger">{result.error}</Typography.Text>
        )}

        {result && !("error" in result) && (
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Typography.Title level={5} style={{ margin: 0 }}>
                精确到天：{result.years}岁{result.months}个月{result.days}天
              </Typography.Title>
            </Col>
            <Col xs={12} sm={8}>
              <Card size="small">
                <Typography.Text type="secondary">总天数</Typography.Text>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {result.totalDays.toLocaleString()}
                </Typography.Title>
              </Card>
            </Col>
            <Col xs={12} sm={8}>
              <Card size="small">
                <Typography.Text type="secondary">总周数</Typography.Text>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {result.totalWeeks.toLocaleString()}
                </Typography.Title>
              </Card>
            </Col>
            <Col xs={12} sm={8}>
              <Card size="small">
                <Typography.Text type="secondary">总月数</Typography.Text>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {result.totalMonths.toLocaleString()}
                </Typography.Title>
              </Card>
            </Col>
            <Col xs={12} sm={8}>
              <Card size="small">
                <Typography.Text type="secondary">距下次生日</Typography.Text>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {result.countdown} 天
                </Typography.Title>
              </Card>
            </Col>
            <Col xs={12} sm={8}>
              <Card size="small">
                <Typography.Text type="secondary">生肖</Typography.Text>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {result.chineseZodiac}
                </Typography.Title>
              </Card>
            </Col>
            <Col xs={12} sm={8}>
              <Card size="small">
                <Typography.Text type="secondary">星座</Typography.Text>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {result.westernZodiac}
                </Typography.Title>
              </Card>
            </Col>
          </Row>
        )}
      </Space>
    </Card>
  );
}
