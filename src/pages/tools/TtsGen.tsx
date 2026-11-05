import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Select,
  Space,
  Tag,
  Typography,
  Input,
  message,
} from "antd";
import { AudioOutlined, DownloadOutlined, SendOutlined } from "@ant-design/icons";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const VOICE_OPTIONS = [
  { value: "茉莉", label: "茉莉（中文·女）" },
  { value: "冰糖", label: "冰糖（中文·女）" },
  { value: "苏打", label: "苏打（中文·男）" },
  { value: "白桦", label: "白桦（中文·男）" },
  { value: "Mia", label: "Mia（英文·女）" },
  { value: "Chloe", label: "Chloe（英文·女）" },
  { value: "Milo", label: "Milo（英文·男）" },
  { value: "Dean", label: "Dean（英文·男）" },
];

const NARRATION_ROLE = "旁白";
const ROLE_VOICE_POOL = ["苏打", "冰糖", "白桦", "Mia", "Chloe", "Milo", "Dean"];
const MAX_SEGMENTS = 30;
const MAX_SEGMENT_LENGTH = 480;
const TAG_COLORS = ["blue", "green", "orange", "purple", "cyan", "magenta", "gold", "volcano"];

const EXAMPLE_TEXT = `旁白：夜色渐深，城市的霓虹开始闪烁。
小明：今天加了一天班，累死了。
小红：那快回去休息吧，别熬坏了身体。
小明：好，那我先下了，明天见。`;

interface ParsedSegment {
  role: string;
  text: string;
}

interface ParseResult {
  segments: ParsedSegment[];
  roleOrder: string[];
}

interface TtsSegment {
  text: string;
  voice: string;
}

interface TtsResult {
  audioUrl: string;
  durationSec: number;
  segmentCount: number;
  ts: number;
}

function splitLongText(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    let cut = -1;
    for (const p of ["。", "！", "？", "；", ".", "!", "?", ";", "，", ","]) {
      const idx = rest.lastIndexOf(p, limit);
      if (idx > 0) {
        cut = idx + 1;
        break;
      }
    }
    if (cut <= 0) cut = limit;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function parseDialogue(text: string): ParseResult {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const merged: ParsedSegment[] = [];
  for (const line of lines) {
    let role = NARRATION_ROLE;
    let content = line;
    const bracket = line.match(/^【([^】]{1,12})】\s*(.*)$/);
    const speaker = line.match(/^([^：:【\n]{1,12})[：:]\s*(.*)$/);
    if (bracket) {
      role = bracket[1].trim();
      content = bracket[2];
    } else if (speaker) {
      role = speaker[1].trim();
      content = speaker[2];
    }
    if (!content) continue;
    const last = merged[merged.length - 1];
    if (last && last.role === role) {
      last.text = `${last.text}${last.text.endsWith("。") ? "" : "。"}${content}`;
      continue;
    }
    merged.push({ role, text: content });
  }
  const segments: ParsedSegment[] = [];
  for (const seg of merged) {
    for (const chunk of splitLongText(seg.text, MAX_SEGMENT_LENGTH)) {
      segments.push({ role: seg.role, text: chunk });
    }
  }
  const roleOrder: string[] = [];
  for (const seg of segments) {
    if (!roleOrder.includes(seg.role)) roleOrder.push(seg.role);
  }
  return { segments, roleOrder };
}

function defaultVoiceFor(role: string, roleOrder: string[]): string {
  if (role === NARRATION_ROLE) return "茉莉";
  const idx = roleOrder.filter((r) => r !== NARRATION_ROLE).indexOf(role);
  return ROLE_VOICE_POOL[idx % ROLE_VOICE_POOL.length] || "苏打";
}

export default function TtsGen() {
  const [text, setText] = useState("");
  const [voiceOverrides, setVoiceOverrides] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TtsResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const parsed = useMemo(() => parseDialogue(text), [text]);
  const overLimit = parsed.segments.length > MAX_SEGMENTS;

  const effectiveSegments: TtsSegment[] = useMemo(
    () =>
      parsed.segments.map((seg) => ({
        text: seg.text,
        voice: voiceOverrides[seg.role] ?? defaultVoiceFor(seg.role, parsed.roleOrder),
      })),
    [parsed, voiceOverrides]
  );

  useEffect(() => {
    if (!loading) return undefined;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [loading]);

  const generate = useCallback(async () => {
    if (effectiveSegments.length === 0) {
      message.warning("请输入要转换的文本");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const resp = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments: effectiveSegments }),
        signal: controller.signal,
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.error || `请求失败（${resp.status}）`);
      }
      const audio: string = data.audio;
      if (!audio) {
        throw new Error("未返回音频数据");
      }
      setResult({
        audioUrl: `data:audio/wav;base64,${audio}`,
        durationSec: Number(data.durationSec) || 0,
        segmentCount: effectiveSegments.length,
        ts: Date.now(),
      });
      message.success("生成完成");
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
  }, [effectiveSegments]);

  const cancel = () => {
    abortRef.current?.abort();
  };

  const download = () => {
    if (!result) return;
    const link = document.createElement("a");
    link.download = `ai-tts-${result.ts}.wav`;
    link.href = result.audioUrl;
    link.click();
  };

  const changeVoice = (role: string, voice: string) => {
    setVoiceOverrides((prev) => ({ ...prev, [role]: voice }));
  };

  return (
    <Card title="AI 文字转语音" style={{ maxWidth: 1000, margin: "0 auto" }}>
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        <Text type="secondary" style={{ fontSize: 12 }}>
          支持对话体多角色：每行「角色名：内容」或「【角色】内容」会自动分配音色；无角色前缀的行按旁白朗读。生成前可在下方分段预览中调整每个角色的音色。
        </Text>

        <div>
          <Text strong>文本内容</Text>
          <TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLE_TEXT}
            maxLength={8000}
            showCount
            autoSize={{ minRows: 5, maxRows: 12 }}
            disabled={loading}
            style={{ marginTop: 8 }}
          />
          <Space wrap style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              示例：
            </Text>
            <Tag style={{ cursor: "pointer" }} onClick={() => setText(EXAMPLE_TEXT)}>
              多角色对话示例
            </Tag>
            <Tag style={{ cursor: "pointer" }} onClick={() => setText("在信息的海洋里，工具是我们最好的船桨。DevTools，打开即用，用完即走。")}>
              单人朗读示例
            </Tag>
          </Space>
        </div>

        {parsed.segments.length > 0 && (
          <Card
            type="inner"
            size="small"
            title={`分段预览（${parsed.segments.length} 段 · ${parsed.roleOrder.length} 个角色）`}
          >
            {overLimit && (
              <Alert
                type="warning"
                showIcon
                message={`分段数超过 ${MAX_SEGMENTS} 段上限，请缩短文本`}
                style={{ marginBottom: 12 }}
              />
            )}
            <Space direction="vertical" style={{ width: "100%" }} size="small">
              {parsed.segments.map((seg, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <Tag color={TAG_COLORS[parsed.roleOrder.indexOf(seg.role) % TAG_COLORS.length]} style={{ minWidth: 72, textAlign: "center", marginTop: 4 }}>
                    {seg.role}
                  </Tag>
                  <Select
                    value={effectiveSegments[i].voice}
                    onChange={(v) => changeVoice(seg.role, v)}
                    options={VOICE_OPTIONS}
                    size="small"
                    style={{ width: 150, marginTop: 2 }}
                    disabled={loading}
                  />
                  <Paragraph style={{ margin: 0, flex: 1, fontSize: 13, color: "#666" }}>
                    {seg.text}
                  </Paragraph>
                </div>
              ))}
            </Space>
          </Card>
        )}

        <Space>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={generate}
            loading={loading}
            disabled={parsed.segments.length === 0 || overLimit}
          >
            {loading ? `生成中 ${elapsed}s` : "生成音频"}
          </Button>
          {loading && (
            <Button onClick={cancel} danger icon={<AudioOutlined />}>
              取消
            </Button>
          )}
          <Text type="secondary" style={{ fontSize: 12 }}>
            每段独立合成后自动拼接，通常几秒到几十秒
          </Text>
        </Space>

        {error && <Alert type="error" showIcon message={error} closable onClose={() => setError("")} />}

        {result && (
          <Card
            type="inner"
            size="small"
            title={`生成结果（${result.segmentCount} 段 · 约 ${result.durationSec} 秒）`}
            extra={
              <Button size="small" icon={<DownloadOutlined />} onClick={download}>
                下载 WAV
              </Button>
            }
          >
            <audio controls src={result.audioUrl} style={{ width: "100%" }} />
          </Card>
        )}
      </Space>
    </Card>
  );
}

