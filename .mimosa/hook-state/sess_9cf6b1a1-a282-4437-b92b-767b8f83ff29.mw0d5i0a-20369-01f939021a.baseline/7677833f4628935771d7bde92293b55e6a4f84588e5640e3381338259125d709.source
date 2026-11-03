import { useState } from "react";
import {
  Card,
  InputNumber,
  Button,
  Space,
  message,
  Typography,
  Checkbox,
  Slider,
  Row,
  Col,
  Progress,
  Tag,
} from "antd";
import { CopyOutlined, ReloadOutlined } from "@ant-design/icons";

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SPECIAL = "!@#$%^&*()_+-=[]{}|;:,.<>?";

function generatePassword(
  length: number,
  useUpper: boolean,
  useLower: boolean,
  useDigits: boolean,
  useSpecial: boolean,
  avoidAmbiguous: boolean,
): string {
  let chars = "";
  if (useUpper) chars += UPPER;
  if (useLower) chars += LOWER;
  if (useDigits) chars += DIGITS;
  if (useSpecial) chars += SPECIAL;
  if (!chars) chars += LOWER + DIGITS;
  if (avoidAmbiguous) {
    chars = chars.replace(/[0O1lI]/g, "");
  }

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
}

export default function PasswordGen() {
  const [length, setLength] = useState(16);
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useDigits, setUseDigits] = useState(true);
  const [useSpecial, setUseSpecial] = useState(true);
  const [avoidAmbiguous, setAvoidAmbiguous] = useState(false);
  const [password, setPassword] = useState("");
  const [batchCount, setBatchCount] = useState(1);
  const [passwords, setPasswords] = useState<string[]>([]);

  const generate = () => {
    if (!useUpper && !useLower && !useDigits && !useSpecial) {
      message.warning("请至少选择一种字符类型");
      return;
    }
    const result = generatePassword(
      length,
      useUpper,
      useLower,
      useDigits,
      useSpecial,
      avoidAmbiguous,
    );
    setPassword(result);

    const list: string[] = [];
    const cnt = Math.min(batchCount, 50);
    for (let i = 0; i < cnt; i++) {
      list.push(
        generatePassword(length, useUpper, useLower, useDigits, useSpecial, avoidAmbiguous),
      );
    }
    setPasswords(list);
    message.success("密码生成成功");
  };

  const copyOne = (pwd: string) => {
    navigator.clipboard.writeText(pwd).then(() => message.success("已复制"));
  };

  const copyAll = () => {
    if (passwords.length === 0) {
      message.warning("请先生成密码");
      return;
    }
    navigator.clipboard.writeText(passwords.join("\n")).then(() =>
      message.success("已复制全部密码"),
    );
  };

  return (
    <Card title="随机密码生成器">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Row gutter={16} align="middle">
          <Col>
            <Typography.Text>密码长度：</Typography.Text>
          </Col>
          <Col flex="auto">
            <Slider
              min={4}
              max={64}
              value={length}
              onChange={setLength}
              marks={{ 4: "4", 16: "16", 32: "32", 48: "48", 64: "64" }}
            />
          </Col>
          <Col>
            <InputNumber
              min={4}
              max={64}
              value={length}
              onChange={(val) => setLength(val || 16)}
              style={{ width: 70 }}
            />
          </Col>
        </Row>
        <Row gutter={16} align="middle">
          <Col span={12}>
            <Typography.Text strong>字符类型：</Typography.Text>
          </Col>
          <Col span={12}>
            <Space size="middle">
              <Typography.Text>批量数量：</Typography.Text>
              <InputNumber
                min={1}
                max={50}
                value={batchCount}
                onChange={(val) => setBatchCount(val || 1)}
                size="small"
                style={{ width: 70 }}
              />
            </Space>
          </Col>
        </Row>
        <Space size="large">
          <Checkbox checked={useUpper} onChange={(e) => setUseUpper(e.target.checked)}>
            大写字母 (A-Z)
          </Checkbox>
          <Checkbox checked={useLower} onChange={(e) => setUseLower(e.target.checked)}>
            小写字母 (a-z)
          </Checkbox>
          <Checkbox checked={useDigits} onChange={(e) => setUseDigits(e.target.checked)}>
            数字 (0-9)
          </Checkbox>
          <Checkbox checked={useSpecial} onChange={(e) => setUseSpecial(e.target.checked)}>
            特殊字符 (!@#$...)
          </Checkbox>
          <Checkbox checked={avoidAmbiguous} onChange={(e) => setAvoidAmbiguous(e.target.checked)}>
            避免易混淆字符 (0O1lI)
          </Checkbox>
        </Space>
        {(() => {
          const charTypes = [useUpper, useLower, useDigits, useSpecial].filter(Boolean).length;
          let baseChars = "";
          if (useUpper) baseChars += UPPER;
          if (useLower) baseChars += LOWER;
          if (useDigits) baseChars += DIGITS;
          if (useSpecial) baseChars += SPECIAL;
          if (!baseChars) baseChars += LOWER + DIGITS;
          if (avoidAmbiguous) {
            baseChars = baseChars.replace(/[0O1lI]/g, "");
          }
          const charsetSize = baseChars.length;
          const entropy = charsetSize > 0 ? (length * Math.log2(charsetSize)).toFixed(1) : "0";
          let strength: string;
          let percent: number;
          let color: string;
          if (length >= 16 && charTypes >= 4) {
            strength = "极强";
            percent = 100;
            color = "#389e0d";
          } else if ((length >= 12 && length <= 15) || charTypes >= 3) {
            strength = "强";
            percent = 75;
            color = "#52c41a";
          } else if ((length >= 8 && length <= 11) || charTypes >= 2) {
            strength = "中";
            percent = 50;
            color = "#fa8c16";
          } else {
            strength = "弱";
            percent = 25;
            color = "#ff4d4f";
          }
          return (
            <Card type="inner" size="small" title="密码强度">
              <Space direction="vertical" style={{ width: "100%" }}>
                <Row align="middle" gutter={16}>
                  <Col>
                    <Typography.Text strong>密码强度标签：</Typography.Text>
                  </Col>
                  <Col>
                    <Tag color={color}>{strength}</Tag>
                  </Col>
                </Row>
                <Progress percent={percent} strokeColor={color} showInfo={false} />
                <Typography.Text>
                  信息熵：{entropy} bits
                </Typography.Text>
              </Space>
            </Card>
          );
        })()}
        <Space>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={generate}
            size="large"
          >
            生成密码
          </Button>
          <Button icon={<CopyOutlined />} onClick={copyAll}>
            复制全部
          </Button>
        </Space>
        {password && (
          <Card size="small" type="inner">
            <Typography.Text strong>最新生成：</Typography.Text>
            <Typography.Text
              code
              copyable
              style={{ fontSize: 18, marginLeft: 8, fontFamily: "monospace" }}
            >
              {password}
            </Typography.Text>
          </Card>
        )}
        {passwords.length > 0 && (
          <Card
            size="small"
            type="inner"
            style={{ maxHeight: 400, overflow: "auto" }}
          >
            <Typography.Text strong>
              批量密码 ({passwords.length})
            </Typography.Text>
            <Space
              direction="vertical"
              size="small"
              style={{ width: "100%", marginTop: 8 }}
            >
              {passwords.map((pwd, i) => (
                <Row key={i} justify="space-between" align="middle">
                  <Col>
                    <Typography.Text code style={{ fontFamily: "monospace" }}>
                      {i + 1}. {pwd}
                    </Typography.Text>
                  </Col>
                  <Col>
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => copyOne(pwd)}
                    />
                  </Col>
                </Row>
              ))}
            </Space>
          </Card>
        )}
      </Space>
    </Card>
  );
}
