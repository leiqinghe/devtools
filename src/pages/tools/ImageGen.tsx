import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Image,
  Input,
  InputNumber,
  Row,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import {
  DownloadOutlined,
  InboxOutlined,
  PictureOutlined,
  ReloadOutlined,
  SendOutlined,
} from "@ant-design/icons";
import type { UploadProps } from "antd";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const SIZE_OPTIONS = [
  { value: "auto", label: "自动" },
  { value: "1024x1024", label: "方图 1024x1024" },
  { value: "1536x1024", label: "横图 1536x1024" },
  { value: "1024x1536", label: "竖图 1024x1536" },
];

const QUALITY_OPTIONS = [
  { value: "", label: "自动" },
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
];

const EXAMPLE_PROMPTS = [
  "赛博朋克风格的城市夜景，霓虹灯，雨天倒影，电影感构图",
  "一只戴着宇航员头盔的橘猫漂浮在太空中，卡通风格，明亮色彩",
  "极简主义办公桌面俯视图，原木色，白色键盘，柔和自然光",
];

interface GenResult {
  prompt: string;
  images: string[];
  model: string;
  ts: number;
}

export default function ImageGen() {
  const [mode, setMode] = useState<string>("text");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("auto");
  const [count, setCount] = useState(1);
  const [quality, setQuality] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<GenResult[]>([]);
  const [refImages, setRefImages] = useState<File[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // 生成中每秒更新耗时显示
  useEffect(() => {
    if (!loading) return undefined;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [loading]);

  const download = (dataUrl: string, index: number, ts: number) => {
    const link = document.createElement("a");
    link.download = `ai-image-${ts}-${index + 1}.png`;
    link.href = dataUrl;
    link.click();
  };

  const addRefImages: UploadProps["beforeUpload"] = (file) => {
    const okTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!okTypes.includes(file.type)) {
      message.error("仅支持 PNG / JPG / WebP 图片");
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      message.error("单张图片不能超过 10MB");
      return false;
    }
    setRefImages((prev) => {
      if (prev.length >= 4) {
        message.warning("最多上传 4 张参考图");
        return prev;
      }
      return [...prev, file];
    });
    return false;
  };

  const generate = useCallback(async () => {
    if (mode === "image" && refImages.length === 0) {
      message.warning("请先上传参考图");
      return;
    }
    if (!prompt.trim()) {
      message.warning(mode === "image" ? "请输入编辑提示词" : "请输入提示词");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError("");
    try {
      let resp: Response;
      if (mode === "image") {
        const form = new FormData();
        refImages.forEach((f) => form.append("images", f));
        form.append("prompt", prompt);
        form.append("size", size);
        form.append("n", String(count));
        resp = await fetch("/api/image-gen/edits", {
          method: "POST",
          body: form,
          signal: controller.signal,
        });
      } else {
        resp = await fetch("/api/image-gen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, size, n: count, quality: quality || undefined }),
          signal: controller.signal,
        });
      }
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.error || `请求失败（${resp.status}）`);
      }
      const images: string[] = (data.images || []).map((b64: string) => `data:image/png;base64,${b64}`);
      if (images.length === 0) {
        throw new Error("未返回图片数据");
      }
      setHistory((prev) => [{ prompt, images, model: data.model || "", ts: Date.now() }, ...prev].slice(0, 10));
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        message.info("已取消生成");
      } else {
        setError((err as Error).message || "生成失败，请稍后再试");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [mode, prompt, size, count, quality, refImages]);

  const cancel = () => {
    abortRef.current?.abort();
  };

  return (
    <Card title="AI 生图" style={{ maxWidth: 1000, margin: "0 auto" }}>
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        <Segmented
          value={mode}
          onChange={(v) => setMode(v as string)}
          disabled={loading}
          options={[
            { label: "✍️ 文生图", value: "text" },
            { label: "🖼️ 图生图", value: "image" },
          ]}
        />

        {mode === "image" && (
          <div>
            <Text strong>参考图</Text>
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
              最多 4 张，单张 ≤ 10MB，PNG/JPG/WebP
            </Text>
            <div style={{ marginTop: 8 }}>
              <Upload.Dragger
                beforeUpload={addRefImages}
                multiple
                showUploadList={false}
                accept=".png,.jpg,.jpeg,.webp"
                disabled={loading || refImages.length >= 4}
                style={{ background: "#fafafa" }}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined style={{ fontSize: 36, color: "#1677ff" }} />
                </p>
                <p className="ant-upload-text" style={{ fontSize: 13 }}>
                  点击或拖拽上传参考图（上传后 AI 将参考图片进行生成）
                </p>
              </Upload.Dragger>
            </div>
            {refImages.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {refImages.map((f, i) => (
                  <Tag
                    key={i}
                    closable={!loading}
                    onClose={() => setRefImages((prev) => prev.filter((_, idx) => idx !== i))}
                    icon={<PictureOutlined />}
                  >
                    {f.name.length > 20 ? f.name.slice(0, 20) + "…" : f.name}
                  </Tag>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <Text strong>{mode === "image" ? "编辑提示词" : "提示词"}</Text>
          <TextArea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              mode === "image"
                ? "描述想要的修改，例如：把背景换成海边日落，保持人物不变"
                : "描述你想要的图片，例如：一只在草地上奔跑的柯基犬，阳光明媚，摄影风格"
            }
            maxLength={4000}
            showCount
            autoSize={{ minRows: 3, maxRows: 8 }}
            disabled={loading}
            style={{ marginTop: 8 }}
          />
          {mode === "text" && (
            <Space wrap style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                示例：
              </Text>
              {EXAMPLE_PROMPTS.map((p) => (
                <Tag key={p} style={{ cursor: "pointer" }} onClick={() => setPrompt(p)}>
                  {p.slice(0, 14)}…
                </Tag>
              ))}
            </Space>
          )}
        </div>

        <Row gutter={12} align="middle">
          <Col>
            <Space>
              <Text type="secondary">尺寸</Text>
              <Select value={size} onChange={setSize} options={SIZE_OPTIONS} style={{ width: 150 }} disabled={loading} />
            </Space>
          </Col>
          <Col>
            <Space>
              <Text type="secondary">张数</Text>
              <InputNumber min={1} max={4} value={count} onChange={(v) => setCount(v || 1)} disabled={loading} />
            </Space>
          </Col>
          {mode === "text" && (
            <Col>
              <Space>
                <Text type="secondary">质量</Text>
                <Select
                  value={quality}
                  onChange={setQuality}
                  options={QUALITY_OPTIONS}
                  style={{ width: 90 }}
                  disabled={loading}
                />
              </Space>
            </Col>
          )}
        </Row>

        <Space>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={generate}
            loading={loading}
            disabled={!prompt.trim() || (mode === "image" && refImages.length === 0)}
          >
            {loading ? `生成中 ${elapsed}s` : "生成图片"}
          </Button>
          {loading && (
            <Button onClick={cancel} danger>
              取消
            </Button>
          )}
          <Text type="secondary" style={{ fontSize: 12 }}>
            通常需要 30~120 秒，高峰期可能更久，请耐心等待
          </Text>
        </Space>

        {error && <Alert type="error" showIcon message={error} closable onClose={() => setError("")} />}
      </Space>

      {history.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Image.PreviewGroup>
            {history.map((item) => (
              <div key={item.ts} style={{ marginBottom: 20 }}>
                <Space align="center" style={{ marginBottom: 8, width: "100%", justifyContent: "space-between" }}>
                  <Paragraph style={{ margin: 0, maxWidth: 700, marginBottom: 0 }} ellipsis={{ rows: 1 }} type="secondary">
                    {item.prompt}
                  </Paragraph>
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => setPrompt(item.prompt)}
                  >
                    重用提示词
                  </Button>
                </Space>
                <Row gutter={[12, 12]}>
                  {item.images.map((url, i) => (
                    <Col key={i} xs={12} md={Math.max(24 / Math.min(item.images.length, 4), 6)}>
                      <div style={{ position: "relative" }}>
                        <Image src={url} width="100%" style={{ borderRadius: 8 }} />
                        <Button
                          size="small"
                          icon={<DownloadOutlined />}
                          onClick={() => download(url, i, item.ts)}
                          style={{ marginTop: 4 }}
                          block
                        >
                          下载
                        </Button>
                      </div>
                    </Col>
                  ))}
                </Row>
              </div>
            ))}
          </Image.PreviewGroup>
        </div>
      )}
    </Card>
  );
}
