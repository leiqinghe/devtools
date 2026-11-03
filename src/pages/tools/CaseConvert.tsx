import { useState, useCallback } from "react";
import { Card, Button, Space, message, Input, Typography } from "antd";
import { CopyOutlined, DeleteOutlined } from "@ant-design/icons";

function toTitleCase(str: string): string {
  return str.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function toSentenceCase(str: string): string {
  return str
    .split(/([.!?]\s+)/)
    .map((part, i) =>
      i % 2 === 0 ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part,
    )
    .join("");
}

function toggleCase(str: string): string {
  return str
    .split("")
    .map((ch) => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()))
    .join("");
}

function toCamelCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join("");
}

function toSnakeCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .join("_");
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .join("-");
}

export default function CaseConvert() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  const convert = useCallback(
    (fn: (s: string) => string, label: string) => {
      if (!input.trim()) {
        message.warning("请输入文本");
        return;
      }
      setOutput(fn(input));
      message.success(`已转换为 ${label}`);
    },
    [input],
  );

  const copy = () => {
    const text = output || input;
    if (text) {
      navigator.clipboard.writeText(text).then(() => message.success("已复制"));
    }
  };

  const clear = () => {
    setInput("");
    setOutput("");
  };

  return (
    <Card title="文本大小写转换">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Typography.Text strong>输入文本</Typography.Text>
        <Input.TextArea
          placeholder="输入要转换的文本..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={6}
          style={{ fontFamily: "monospace", fontSize: 13 }}
        />
        <Space wrap>
          <Button onClick={() => convert((s) => s.toUpperCase(), "全部大写")}>
            全部大写
          </Button>
          <Button onClick={() => convert((s) => s.toLowerCase(), "全部小写")}>
            全部小写
          </Button>
          <Button onClick={() => convert(toTitleCase, "首字母大写")}>
            首字母大写
          </Button>
          <Button onClick={() => convert(toSentenceCase, "句首大写")}>
            句首大写
          </Button>
          <Button onClick={() => convert(toggleCase, "大小写反转")}>
            大小写反转
          </Button>
          <Button onClick={() => convert(toCamelCase, "驼峰命名")}>
            驼峰命名
          </Button>
          <Button onClick={() => convert(toSnakeCase, "下划线命名")}>
            下划线命名
          </Button>
          <Button onClick={() => convert(toKebabCase, "中划线命名")}>
            中划线命名
          </Button>
        </Space>
        <Space>
          <Button icon={<CopyOutlined />} onClick={copy}>
            复制结果
          </Button>
          <Button icon={<DeleteOutlined />} onClick={clear}>
            清空
          </Button>
        </Space>
        <Typography.Text strong>转换结果</Typography.Text>
        <Input.TextArea
          readOnly
          value={output}
          rows={6}
          style={{ fontFamily: "monospace", fontSize: 13, background: "#f5f5f5" }}
        />
      </Space>
    </Card>
  );
}
