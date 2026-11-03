import { useState } from "react";
import { Card, InputNumber, Button, Space, message, Typography, List, Radio } from "antd";
import { CopyOutlined, DeleteOutlined } from "@ant-design/icons";

const FORMAT_OPTIONS = [
  { value: "standard", label: "标准格式" },
  { value: "uppercase", label: "大写" },
  { value: "nohyphen", label: "无连字符" },
  { value: "guid", label: "GUID 格式" },
];

function formatUuid(uuid: string, format: string): string {
  switch (format) {
    case "uppercase":
      return uuid.toUpperCase();
    case "nohyphen":
      return uuid.replace(/-/g, "");
    case "guid":
      return `{${uuid}}`;
    default:
      return uuid;
  }
}

export default function UuidGen() {
  const [count, setCount] = useState(1);
  const [uuids, setUuids] = useState<string[]>([]);
  const [format, setFormat] = useState("standard");

  const generate = () => {
    if (count < 1 || count > 100) {
      message.warning("请设置数量为 1-100");
      return;
    }
    const list: string[] = [];
    for (let i = 0; i < count; i++) {
      list.push(formatUuid(crypto.randomUUID(), format));
    }
    setUuids(list);
    message.success(`已生成 ${count} 个 UUID`);
  };

  const copyOne = (uuid: string) => {
    navigator.clipboard.writeText(uuid).then(() => message.success("已复制"));
  };

  const copyAll = () => {
    if (uuids.length === 0) {
      message.warning("请先生成 UUID");
      return;
    }
    navigator.clipboard.writeText(uuids.join("\n")).then(() =>
      message.success(`已复制 ${uuids.length} 个 UUID`),
    );
  };

  const copyJson = () => {
    if (uuids.length === 0) {
      message.warning("请先生成 UUID");
      return;
    }
    navigator.clipboard.writeText(JSON.stringify(uuids)).then(() =>
      message.success("已复制为 JSON 数组"),
    );
  };

  const copyComma = () => {
    if (uuids.length === 0) {
      message.warning("请先生成 UUID");
      return;
    }
    navigator.clipboard.writeText(uuids.join(",")).then(() =>
      message.success("已复制为逗号分隔"),
    );
  };

  const clear = () => {
    setUuids([]);
  };

  return (
    <Card title="UUID 生成器">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space wrap>
          <Typography.Text>生成数量：</Typography.Text>
          <InputNumber
            min={1}
            max={100}
            value={count}
            onChange={(val) => setCount(val || 1)}
            size="large"
          />
          <Typography.Text>格式：</Typography.Text>
          <Radio.Group
            options={FORMAT_OPTIONS}
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            optionType="button"
            buttonStyle="solid"
            size="large"
          />
          <Button type="primary" onClick={generate} size="large">
            生成 UUID
          </Button>
          <Button icon={<CopyOutlined />} onClick={copyAll}>
            复制全部
          </Button>
          <Button icon={<CopyOutlined />} onClick={copyJson}>
            复制为 JSON 数组
          </Button>
          <Button icon={<CopyOutlined />} onClick={copyComma}>
            复制为逗号分隔
          </Button>
          <Button icon={<DeleteOutlined />} onClick={clear}>
            清空
          </Button>
        </Space>
        <Typography.Text type="secondary">
          UUID v4 基于随机数生成，碰撞概率极低
        </Typography.Text>
        {uuids.length > 0 && (
          <Card
            size="small"
            type="inner"
            style={{ maxHeight: 500, overflow: "auto" }}
          >
            <List
              dataSource={uuids}
              renderItem={(uuid, index) => (
                <List.Item
                  key={index}
                  actions={[
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => copyOne(uuid)}
                    >
                      复制
                    </Button>,
                  ]}
                  style={{ fontFamily: "monospace", fontSize: 13 }}
                >
                  {index + 1}. {uuid}
                </List.Item>
              )}
            />
          </Card>
        )}
      </Space>
    </Card>
  );
}
