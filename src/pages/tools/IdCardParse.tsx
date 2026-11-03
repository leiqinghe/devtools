import { useState, useEffect } from "react";
import { Card, Input, Typography, Row, Col, Tag, Space } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";

const PROVINCES: Record<string, string> = {
  "11": "北京", "12": "天津", "13": "河北", "14": "山西", "15": "内蒙古",
  "21": "辽宁", "22": "吉林", "23": "黑龙江",
  "31": "上海", "32": "江苏", "33": "浙江", "34": "安徽", "35": "福建", "36": "江西", "37": "山东",
  "41": "河南", "42": "湖北", "43": "湖南", "44": "广东", "45": "广西", "46": "海南",
  "50": "重庆", "51": "四川", "52": "贵州", "53": "云南", "54": "西藏",
  "61": "陕西", "62": "甘肃", "63": "青海", "64": "宁夏", "65": "新疆",
  "71": "台湾", "81": "香港", "82": "澳门",
};

const ZODIAC = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"];

function getZodiac(year: number): string {
  return ZODIAC[(year - 4) % 12];
}

function getConstellation(month: number, day: number): string {
  const dates = [20, 19, 21, 20, 21, 22, 23, 23, 23, 24, 23, 22];
  const signs = [
    "水瓶座", "双鱼座", "白羊座", "金牛座", "双子座", "巨蟹座",
    "狮子座", "处女座", "天秤座", "天蝎座", "射手座", "摩羯座",
  ];
  return day <= dates[month - 1] ? signs[month - 1] : signs[month % 12];
}

function validateCheckDigit(id: string): boolean {
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkMap = "10X98765432";
  const sum = id
    .slice(0, 17)
    .split("")
    .reduce((acc, digit, i) => acc + parseInt(digit) * weights[i], 0);
  const expected = checkMap[sum % 11];
  return expected === id[17].toUpperCase();
}

function getAge(birthStr: string): number {
  const birth = new Date(
    parseInt(birthStr.slice(0, 4)),
    parseInt(birthStr.slice(4, 6)) - 1,
    parseInt(birthStr.slice(6, 8))
  );
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export default function IdCardParse() {
  const [input, setInput] = useState("");
  const [info, setInfo] = useState<Record<string, string> | null>(null);
  const [valid, setValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (input.length >= 18) {
      const id = input.replace(/\s/g, "");
      if (id.length === 18 && /^[1-9]\d{5}(19|20)\d{10}[\dXx]$/.test(id)) {
        const province = PROVINCES[id.slice(0, 2)] || "未知";
        const year = id.slice(6, 10);
        const month = id.slice(10, 12);
        const day = id.slice(12, 14);
        const birthStr = year + month + day;
        const birth = `${year}-${month}-${day}`;
        const gender = parseInt(id[16]) % 2 === 1 ? "男" : "女";
        const age = getAge(birthStr);
        const zodiac = getZodiac(parseInt(year));
        const constellation = getConstellation(parseInt(month), parseInt(day));
        const checkOk = validateCheckDigit(id);
        setValid(checkOk);
        setInfo({
          province,
          birth,
          gender,
          age: String(age),
          zodiac,
          constellation,
          check: checkOk ? "校验正确" : "校验错误",
        });
        return;
      }
    }
    setInfo(null);
    setValid(null);
  }, [input]);

  return (
    <Card title="身份证信息提取">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <div>
          <Typography.Text strong>输入18位身份证号码</Typography.Text>
          <Input
            placeholder="请输入18位身份证号码"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={18}
            size="large"
            style={{ marginTop: 8 }}
            allowClear
          />
        </div>
        {info && valid !== null && (
          <Card size="small">
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Typography.Text type="secondary">省份/地区</Typography.Text>
                <div>
                  <Typography.Text strong style={{ fontSize: 16 }}>
                    {info.province}
                  </Typography.Text>
                </div>
              </Col>
              <Col span={8}>
                <Typography.Text type="secondary">性别</Typography.Text>
                <div>
                  <Tag color={info.gender === "男" ? "blue" : "pink"}>{info.gender}</Tag>
                </div>
              </Col>
              <Col span={8}>
                <Typography.Text type="secondary">年龄</Typography.Text>
                <div>
                  <Typography.Text strong style={{ fontSize: 16 }}>
                    {info.age} 岁
                  </Typography.Text>
                </div>
              </Col>
              <Col span={8}>
                <Typography.Text type="secondary">出生日期</Typography.Text>
                <div>
                  <Typography.Text strong style={{ fontSize: 16 }}>
                    {info.birth}
                  </Typography.Text>
                </div>
              </Col>
              <Col span={8}>
                <Typography.Text type="secondary">星座</Typography.Text>
                <div>
                  <Typography.Text strong style={{ fontSize: 16 }}>
                    {info.constellation}
                  </Typography.Text>
                </div>
              </Col>
              <Col span={8}>
                <Typography.Text type="secondary">生肖</Typography.Text>
                <div>
                  <Typography.Text strong style={{ fontSize: 16 }}>
                    {info.zodiac}
                  </Typography.Text>
                </div>
              </Col>
              <Col span={24}>
                <Typography.Text type="secondary">校验位</Typography.Text>
                <div>
                  <Space>
                    <Typography.Text strong style={{ fontSize: 16 }}>
                      {info.check}
                    </Typography.Text>
                    {valid ? (
                      <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 18 }} />
                    ) : (
                      <CloseCircleOutlined style={{ color: "#ff4d4f", fontSize: 18 }} />
                    )}
                  </Space>
                </div>
              </Col>
            </Row>
          </Card>
        )}
      </Space>
    </Card>
  );
}
