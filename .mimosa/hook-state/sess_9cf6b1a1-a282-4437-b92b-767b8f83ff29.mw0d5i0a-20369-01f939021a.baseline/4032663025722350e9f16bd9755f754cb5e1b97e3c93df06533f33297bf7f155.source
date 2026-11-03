import { useState, useCallback } from "react";
import { Card, Input, Button, Space, message, Typography } from "antd";
import { CopyOutlined } from "@ant-design/icons";

const DIGITS = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
const UNITS_SMALL = ["", "拾", "佰", "仟"];
const UNITS_BIG = ["", "万", "亿", "万亿"];

function formatFourDigits(num: string): string {
  if (num === "0000") return "";
  num = num.padStart(4, "0");
  let result = "";
  let hasValue = false;
  for (let i = 0; i < 4; i++) {
    const d = parseInt(num[i]);
    if (d !== 0) {
      if (i > 0 && num[i - 1] === "0" && hasValue) {
        result += "零";
      }
      result += DIGITS[d] + UNITS_SMALL[3 - i];
      hasValue = true;
    }
  }
  return result;
}

function numberToChinese(num: number): string {
  if (num === 0) return "零元整";
  const str = Math.floor(num).toString();
  const groups: string[] = [];
  let temp = str;
  while (temp.length > 0) {
    groups.unshift(temp.slice(-4));
    temp = temp.slice(0, -4);
  }
  let result = "";
  for (let i = 0; i < groups.length; i++) {
    const groupStr = formatFourDigits(groups[i]);
    if (groupStr) {
      result += groupStr + UNITS_BIG[groups.length - 1 - i];
    } else if (i === groups.length - 1 && result === "") {
      result = "零";
    }
  }
  result += "元";
  const decimal = Math.round((num - Math.floor(num)) * 100);
  const jiao = Math.floor(decimal / 10);
  const fen = decimal % 10;
  if (jiao === 0 && fen === 0) {
    result += "整";
  } else {
    if (jiao > 0) result += DIGITS[jiao] + "角";
    if (fen > 0) result += DIGITS[fen] + "分";
  }
  return result;
}

function formatWithCommas(num: number): string {
  const parts = num.toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

export default function RmbConvert() {
  const [input, setInput] = useState("");
  const [chinese, setChinese] = useState("");
  const [formatted, setFormatted] = useState("");

  const handleChange = useCallback((value: string) => {
    setInput(value);
    const num = parseFloat(value);
    if (isNaN(num) || num < 0 || num > 999999999999.99) {
      setChinese("");
      setFormatted("");
      return;
    }
    setChinese(numberToChinese(num));
    setFormatted(formatWithCommas(num));
  }, []);

  const copy = () => {
    if (chinese) {
      navigator.clipboard.writeText(chinese).then(() => message.success("已复制"));
    }
  };

  return (
    <Card title="人民币大写转换">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <div>
          <Typography.Text strong>输入金额（0 - 999999999999.99）</Typography.Text>
          <Input
            placeholder="请输入数字金额，如 12345.67"
            value={input}
            onChange={(e) => handleChange(e.target.value)}
            size="large"
            style={{ marginTop: 8 }}
            allowClear
          />
        </div>
        {chinese && (
          <>
            <div>
              <Typography.Text strong>中文大写</Typography.Text>
              <Input.TextArea
                readOnly
                value={chinese}
                rows={2}
                style={{
                  fontFamily: "monospace",
                  fontSize: 18,
                  background: "#f5f5f5",
                  marginTop: 8,
                  fontWeight: "bold",
                  color: "#d4380d",
                }}
              />
              <Button
                icon={<CopyOutlined />}
                onClick={copy}
                style={{ marginTop: 8 }}
              >
                复制大写金额
              </Button>
            </div>
            <div>
              <Typography.Text strong>格式化数字</Typography.Text>
              <Input
                readOnly
                value={formatted}
                style={{
                  fontFamily: "monospace",
                  fontSize: 16,
                  background: "#f5f5f5",
                  marginTop: 8,
                }}
              />
            </div>
          </>
        )}
      </Space>
    </Card>
  );
}
