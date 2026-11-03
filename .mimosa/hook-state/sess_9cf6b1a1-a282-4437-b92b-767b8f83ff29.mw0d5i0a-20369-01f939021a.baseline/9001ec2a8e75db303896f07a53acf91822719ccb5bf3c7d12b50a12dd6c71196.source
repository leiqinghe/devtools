import { useState, useMemo } from "react";
import { Card, InputNumber, Select, Typography, Space, Button, message, Row, Col } from "antd";
import { CopyOutlined, SwapOutlined } from "@ant-design/icons";

type Category =
  | "长度"
  | "重量"
  | "温度"
  | "面积"
  | "体积"
  | "速度"
  | "数据存储";

type UnitInfo = { label: string; value: string; toBase: (v: number) => number; fromBase: (v: number) => number };

const UNIT_MAP: Record<Category, UnitInfo[]> = {
  长度: [
    { label: "毫米(mm)", value: "mm", toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
    { label: "厘米(cm)", value: "cm", toBase: (v) => v / 100, fromBase: (v) => v * 100 },
    { label: "米(m)", value: "m", toBase: (v) => v, fromBase: (v) => v },
    { label: "千米(km)", value: "km", toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
    { label: "英寸(in)", value: "in", toBase: (v) => v * 0.0254, fromBase: (v) => v / 0.0254 },
    { label: "英尺(ft)", value: "ft", toBase: (v) => v * 0.3048, fromBase: (v) => v / 0.3048 },
    { label: "英里(mi)", value: "mi", toBase: (v) => v * 1609.344, fromBase: (v) => v / 1609.344 },
  ],
  重量: [
    { label: "毫克(mg)", value: "mg", toBase: (v) => v / 1e6, fromBase: (v) => v * 1e6 },
    { label: "克(g)", value: "g", toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
    { label: "千克(kg)", value: "kg", toBase: (v) => v, fromBase: (v) => v },
    { label: "吨(t)", value: "t", toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
    { label: "磅(lb)", value: "lb", toBase: (v) => v * 0.453592, fromBase: (v) => v / 0.453592 },
    { label: "盎司(oz)", value: "oz", toBase: (v) => v * 0.0283495, fromBase: (v) => v / 0.0283495 },
  ],
  温度: [
    { label: "摄氏度(°C)", value: "c", toBase: (v) => v, fromBase: (v) => v },
    { label: "华氏度(°F)", value: "f", toBase: (v) => (v - 32) * (5 / 9), fromBase: (v) => v * (9 / 5) + 32 },
    { label: "开尔文(K)", value: "k", toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
  ],
  面积: [
    { label: "平方毫米", value: "mm2", toBase: (v) => v / 1e6, fromBase: (v) => v * 1e6 },
    { label: "平方厘米", value: "cm2", toBase: (v) => v / 10000, fromBase: (v) => v * 10000 },
    { label: "平方米", value: "m2", toBase: (v) => v, fromBase: (v) => v },
    { label: "公顷", value: "ha", toBase: (v) => v * 10000, fromBase: (v) => v / 10000 },
    { label: "平方公里", value: "km2", toBase: (v) => v * 1e6, fromBase: (v) => v / 1e6 },
    { label: "平方英尺", value: "ft2", toBase: (v) => v * 0.092903, fromBase: (v) => v / 0.092903 },
  ],
  体积: [
    { label: "毫升", value: "ml", toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
    { label: "升", value: "l", toBase: (v) => v, fromBase: (v) => v },
    { label: "立方米", value: "m3", toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
    { label: "加仑(us)", value: "gal", toBase: (v) => v * 3.78541, fromBase: (v) => v / 3.78541 },
    { label: "品脱(us)", value: "pt", toBase: (v) => v * 0.473176, fromBase: (v) => v / 0.473176 },
  ],
  速度: [
    { label: "m/s", value: "ms", toBase: (v) => v, fromBase: (v) => v },
    { label: "km/h", value: "kmh", toBase: (v) => v / 3.6, fromBase: (v) => v * 3.6 },
    { label: "mph", value: "mph", toBase: (v) => v * 0.44704, fromBase: (v) => v / 0.44704 },
    { label: "节(knot)", value: "knot", toBase: (v) => v * 0.514444, fromBase: (v) => v / 0.514444 },
  ],
  数据存储: [
    { label: "B", value: "B", toBase: (v) => v, fromBase: (v) => v },
    { label: "KB", value: "KB", toBase: (v) => v * 1024, fromBase: (v) => v / 1024 },
    { label: "MB", value: "MB", toBase: (v) => v * 1024 ** 2, fromBase: (v) => v / 1024 ** 2 },
    { label: "GB", value: "GB", toBase: (v) => v * 1024 ** 3, fromBase: (v) => v / 1024 ** 3 },
    { label: "TB", value: "TB", toBase: (v) => v * 1024 ** 4, fromBase: (v) => v / 1024 ** 4 },
  ],
};

const CATEGORIES: { label: string; value: Category }[] = [
  { label: "长度", value: "长度" },
  { label: "重量", value: "重量" },
  { label: "温度", value: "温度" },
  { label: "面积", value: "面积" },
  { label: "体积", value: "体积" },
  { label: "速度", value: "速度" },
  { label: "数据存储", value: "数据存储" },
];

const COMMON_CONVERSIONS: Record<Category, string[]> = {
  长度: ["1 英寸 = 2.54 厘米", "1 英尺 = 0.3048 米", "1 英里 = 1.60934 千米"],
  重量: ["1 磅 = 0.4536 千克", "1 盎司 = 28.3495 克"],
  温度: ["0 °C = 32 °F", "100 °C = 212 °F"],
  面积: ["1 平方米 = 10.7639 平方英尺"],
  体积: ["1 升 = 0.2642 加仑"],
  速度: ["1 m/s = 3.6 km/h", "1 mph = 1.60934 km/h"],
  数据存储: ["1 KB = 1024 B", "1 MB = 1024 KB"],
};

function getDefaultUnit(cat: Category): string {
  return UNIT_MAP[cat][0].value;
}

export default function UnitConvert() {
  const [category, setCategory] = useState<Category>("长度");
  const [value, setValue] = useState<number>(1);
  const [fromUnit, setFromUnit] = useState<string>(getDefaultUnit("长度"));
  const [toUnit, setToUnit] = useState<string>(UNIT_MAP["长度"][1].value);

  const fromOptions = useMemo(() => UNIT_MAP[category], [category]);
  const toOptions = useMemo(() => UNIT_MAP[category], [category]);

  const result = useMemo(() => {
    const from = UNIT_MAP[category].find((u) => u.value === fromUnit);
    const to = UNIT_MAP[category].find((u) => u.value === toUnit);
    if (!from || !to || value == null) return 0;
    const base = from.toBase(value);
    return to.fromBase(base);
  }, [category, value, fromUnit, toUnit]);

  const handleCategoryChange = (cat: Category) => {
    setCategory(cat);
    setFromUnit(getDefaultUnit(cat));
    setToUnit(UNIT_MAP[cat][1].value);
  };

  const swapUnits = () => {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
  };

  const getResultLabel = () => {
    const fromLabel = fromOptions.find((u) => u.value === fromUnit)?.label.split("(")[0] || fromUnit;
    const toLabel = toOptions.find((u) => u.value === toUnit)?.label.split("(")[0] || toUnit;
    const displayResult = Number.isInteger(result) ? result : parseFloat(result.toFixed(6));
    return `${value} ${fromLabel} = ${displayResult} ${toLabel}`;
  };

  const copyResult = () => {
    navigator.clipboard.writeText(getResultLabel()).then(() => message.success("已复制"));
  };

  return (
    <Card title="单位换算">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space>
          <Typography.Text strong>类别</Typography.Text>
          <Select
            value={category}
            onChange={handleCategoryChange}
            options={CATEGORIES}
            style={{ width: 140 }}
          />
        </Space>

        <Space align="start" wrap>
          <Space direction="vertical">
            <Typography.Text>数值</Typography.Text>
            <InputNumber
              value={value}
              onChange={(v) => setValue(v ?? 0)}
              style={{ width: 160 }}
            />
          </Space>
          <Space direction="vertical">
            <Typography.Text>源单位</Typography.Text>
            <Select
              value={fromUnit}
              onChange={(v) => setFromUnit(v)}
              options={fromOptions.map((u) => ({ label: u.label, value: u.value }))}
              style={{ width: 160 }}
            />
          </Space>
          <Space direction="vertical" style={{ justifyContent: "flex-end", paddingBottom: 0 }}>
            <Button
              icon={<SwapOutlined />}
              shape="circle"
              onClick={swapUnits}
              title="交换单位"
            />
          </Space>
          <Space direction="vertical">
            <Typography.Text>目标单位</Typography.Text>
            <Select
              value={toUnit}
              onChange={(v) => setToUnit(v)}
              options={toOptions.map((u) => ({ label: u.label, value: u.value }))}
              style={{ width: 160 }}
            />
          </Space>
        </Space>

        <Card size="small" style={{ background: "#f5f5f5" }}>
          <Space>
            <Typography.Text style={{ fontSize: 16 }}>
              {value} {fromOptions.find((u) => u.value === fromUnit)?.label.split("(")[0] || fromUnit}
            </Typography.Text>
            <Typography.Text style={{ fontSize: 16 }}>=</Typography.Text>
            <Typography.Text strong style={{ fontSize: 18, color: "#1677ff" }}>
              {Number.isInteger(result) ? result : parseFloat(result.toFixed(6))}{" "}
              {toOptions.find((u) => u.value === toUnit)?.label.split("(")[0] || toUnit}
            </Typography.Text>
          </Space>
          <div style={{ marginTop: 12 }}>
            <Button icon={<CopyOutlined />} onClick={copyResult}>
              复制结果
            </Button>
          </div>
        </Card>

        <Card size="small" title="常用换算" style={{ background: "#fafafa" }}>
          <Row gutter={[16, 8]}>
            {COMMON_CONVERSIONS[category].map((item, idx) => (
              <Col key={idx} xs={24} sm={12}>
                <Typography.Text code>{item}</Typography.Text>
              </Col>
            ))}
          </Row>
        </Card>
      </Space>
    </Card>
  );
}
