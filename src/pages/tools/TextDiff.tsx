import { useState } from "react";
import {
  Card,
  Input,
  Button,
  Space,
  message,
  Typography,
  Row,
  Col,
} from "antd";
import { SwapOutlined, ClearOutlined } from "@ant-design/icons";

interface DiffLine {
  text: string;
  type: "same" | "added" | "removed";
  lineNum: number;
}

function computeDiff(leftLines: string[], rightLines: string[]): DiffLine[] {
  const m = leftLines.length;
  const n = rightLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (leftLines[i - 1] === rightLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = m;
  let j = n;

  const reversed: DiffLine[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && leftLines[i - 1] === rightLines[j - 1]) {
      reversed.push({ text: leftLines[i - 1], type: "same", lineNum: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      reversed.push({ text: rightLines[j - 1], type: "added", lineNum: j });
      j--;
    } else {
      reversed.push({ text: leftLines[i - 1], type: "removed", lineNum: i });
      i--;
    }
  }

  return reversed.reverse();
}

export default function TextDiff() {
  const [leftText, setLeftText] = useState("");
  const [rightText, setRightText] = useState("");
  const [diffLines, setDiffLines] = useState<DiffLine[]>([]);

  const diff = () => {
    const leftLines = leftText.split("\n");
    const rightLines = rightText.split("\n");

    if (leftLines.length === 0 && rightLines.length === 0) {
      message.warning("请输入文本内容");
      return;
    }

    const result = computeDiff(leftLines, rightLines);
    setDiffLines(result);
  };

  const clear = () => {
    setLeftText("");
    setRightText("");
    setDiffLines([]);
  };

  const swap = () => {
    setLeftText(rightText);
    setRightText(leftText);
    setDiffLines([]);
  };

  const stats = {
    added: diffLines.filter((l) => l.type === "added").length,
    removed: diffLines.filter((l) => l.type === "removed").length,
    same: diffLines.filter((l) => l.type === "same").length,
  };

  return (
    <Card title="文本对比">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space>
          <Button type="primary" onClick={diff}>
            对比
          </Button>
          <Button icon={<SwapOutlined />} onClick={swap}>
            交换
          </Button>
          <Button icon={<ClearOutlined />} onClick={clear}>
            清空
          </Button>
        </Space>

        <Row gutter={16}>
          <Col xs={24} lg={12}>
            <Typography.Text strong>原始文本</Typography.Text>
            <Input.TextArea
              rows={12}
              placeholder="输入原始文本..."
              value={leftText}
              onChange={(e) => setLeftText(e.target.value)}
              style={{ fontFamily: "monospace", fontSize: 13 }}
            />
          </Col>
          <Col xs={24} lg={12}>
            <Typography.Text strong>修改后文本</Typography.Text>
            <Input.TextArea
              rows={12}
              placeholder="输入修改后文本..."
              value={rightText}
              onChange={(e) => setRightText(e.target.value)}
              style={{ fontFamily: "monospace", fontSize: 13 }}
            />
          </Col>
        </Row>

        {diffLines.length > 0 && (
          <>
            <Row gutter={16}>
              <Col span={8}>
                <div
                  style={{
                    padding: 12,
                    border: "1px solid #d9d9d9",
                    borderRadius: 8,
                    background: "#fafafa",
                    textAlign: "center",
                  }}
                >
                  <Typography.Text strong>
                    新增 {stats.added}
                  </Typography.Text>
                </div>
              </Col>
              <Col span={8}>
                <div
                  style={{
                    padding: 12,
                    border: "1px solid #d9d9d9",
                    borderRadius: 8,
                    background: "#fafafa",
                    textAlign: "center",
                  }}
                >
                  <Typography.Text strong>
                    删除 {stats.removed}
                  </Typography.Text>
                </div>
              </Col>
              <Col span={8}>
                <div
                  style={{
                    padding: 12,
                    border: "1px solid #d9d9d9",
                    borderRadius: 8,
                    background: "#fafafa",
                    textAlign: "center",
                  }}
                >
                  <Typography.Text strong>
                    未变 {stats.same}
                  </Typography.Text>
                </div>
              </Col>
            </Row>

            <div>
              <Typography.Text strong>对比结果</Typography.Text>
              <div
                style={{
                  marginTop: 8,
                  border: "1px solid #d9d9d9",
                  borderRadius: 8,
                  maxHeight: 400,
                  overflowY: "auto",
                  fontFamily: "monospace",
                  fontSize: 13,
                }}
              >
                {diffLines.map((line, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "2px 12px",
                      backgroundColor:
                        line.type === "added"
                          ? "#d4edda"
                          : line.type === "removed"
                          ? "#f8d7da"
                          : "transparent",
                      borderBottom: "1px solid #f0f0f0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    <Typography.Text
                      type="secondary"
                      style={{
                        display: "inline-block",
                        width: 40,
                        textAlign: "right",
                        marginRight: 12,
                      }}
                    >
                      {line.type === "added"
                        ? "+"
                        : line.type === "removed"
                        ? "-"
                        : " "}
                    </Typography.Text>
                    {line.text || "\u00A0"}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </Space>
    </Card>
  );
}
