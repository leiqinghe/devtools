import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
  Input,
  Upload,
  message,
} from "antd";
import { AudioOutlined, DownloadOutlined, SendOutlined, UploadOutlined } from "@ant-design/icons";

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

type TtsMode = "preset" | "design" | "clone";

const MODE_OPTIONS = [
  { label: "🎙 预置音色", value: "preset" },
  { label: "🎨 音色设计", value: "design" },
  { label: "🧬 音色复刻", value: "clone" },
];

const DESIGN_PRESETS = [
  { value: "纪录片旁白：中年男性，标准普通话，嗓音低沉有磁性，轻微沙哑，沉稳有感染力" },
  { value: "年轻女声，温柔清亮，语速适中，像深夜电台主播" },
  { value: "东北口音大叔，嗓音粗犷豪爽，语速稍快，自带喜感" },
  { value: "御姐音：成熟女性，高冷慵懒，尾音上扬带一丝戏谑" },
  { value: "台湾腔少女，软萌甜美，语速轻快" },
  { value: "沧桑老先生，北方口音，语速缓慢，声音沙哑有岁月感" },
  { value: "英伦腔男声，低沉优雅，字正腔圆" },
  { value: "ASMR 女声，气声为主，极近距离耳语感，含呼吸声" },
];

const CLONE_EXAMPLE_ROLE = "克隆角色";
const CLONE_EXAMPLE_TEXT = `${CLONE_EXAMPLE_ROLE}：大家好，我就是刚才那段参考音频里的声音。现在我在说一句全新的台词，你听出来了吗？
${CLONE_EXAMPLE_ROLE}：上传你自己的声音，替换我，让任何文字都用你的声线读出来。`;

const DESIGN_EXAMPLE_TEXT = `旁白：夜幕降临，城市缓缓沉入温柔的黑暗。
少年：我一定会找到那颗星星的，哪怕走遍整片荒野！
智者：孩子，星光会指引每一个愿意抬头的人。`;

const DESIGN_EXAMPLE_DESC: Record<string, string> = {
  旁白: "纪录片旁白：中年男性，标准普通话，嗓音低沉有磁性，轻微沙哑，沉稳有感染力",
  少年: "十五岁少年，声音清亮干净，朝气蓬勃，语速偏快，热血向上",
  智者: "年迈智者，声音苍老温和，语速缓慢，字字有力，空灵悠远",
};

const EMOTION_OPTIONS = [
  { value: "开心", label: "开心（基础情绪）" },
  { value: "悲伤", label: "悲伤（基础情绪）" },
  { value: "愤怒", label: "愤怒（基础情绪）" },
  { value: "惊讶", label: "惊讶（基础情绪）" },
  { value: "兴奋", label: "兴奋（基础情绪）" },
  { value: "委屈", label: "委屈（基础情绪）" },
  { value: "平静", label: "平静（基础情绪）" },
  { value: "无奈", label: "无奈（复合情绪）" },
  { value: "欣慰", label: "欣慰（复合情绪）" },
  { value: "愧疚", label: "愧疚（复合情绪）" },
  { value: "释然", label: "释然（复合情绪）" },
  { value: "忐忑", label: "忐忑（复合情绪）" },
  { value: "温柔", label: "温柔（整体语调）" },
  { value: "高冷", label: "高冷（整体语调）" },
  { value: "活泼", label: "活泼（整体语调）" },
  { value: "慵懒", label: "慵懒（整体语调）" },
  { value: "俏皮", label: "俏皮（整体语调）" },
  { value: "深沉", label: "深沉（整体语调）" },
  { value: "磁性", label: "磁性（音色定位）" },
  { value: "醇厚", label: "醇厚（音色定位）" },
  { value: "沙哑", label: "沙哑（音色定位）" },
];

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
  style: string;
  mode: TtsMode;
  voiceDesc?: string;
  refIdx?: number;
}

interface RefAudio {
  file: File;
  url: string;
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
  const [mode, setMode] = useState<TtsMode>("preset");
  const [text, setText] = useState("");
  const [voiceOverrides, setVoiceOverrides] = useState<Record<string, string>>({});
  const [styleOverrides, setStyleOverrides] = useState<Record<string, string>>({});
  const [designOverrides, setDesignOverrides] = useState<Record<string, string>>({});
  const [refAudios, setRefAudios] = useState<Record<string, RefAudio>>({});
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TtsResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const parsed = useMemo(() => parseDialogue(text), [text]);
  const overLimit = parsed.segments.length > MAX_SEGMENTS;

  const voiceFor = (role: string) =>
    voiceOverrides[role] ?? defaultVoiceFor(role, parsed.roleOrder);

  const missingRefs = useMemo(
    () => (mode === "clone" ? parsed.roleOrder.filter((r) => !refAudios[r]) : []),
    [mode, parsed.roleOrder, refAudios]
  );

  const effectiveSegments: TtsSegment[] = useMemo(() => {
    if (mode === "clone") {
      return parsed.segments.map((seg) => ({
        text: seg.text,
        voice: "",
        style: (styleOverrides[seg.role] || "").trim(),
        mode: "clone",
        refIdx: parsed.roleOrder.indexOf(seg.role),
      }));
    }
    if (mode === "design") {
      return parsed.segments.map((seg) => ({
        text: seg.text,
        voice: "",
        style: (styleOverrides[seg.role] || "").trim(),
        mode: "design",
        voiceDesc: (designOverrides[seg.role] || "").trim(),
      }));
    }
    return parsed.segments.map((seg) => ({
      text: seg.text,
      voice: voiceOverrides[seg.role] ?? defaultVoiceFor(seg.role, parsed.roleOrder),
      style: (styleOverrides[seg.role] || "").trim(),
      mode: "preset",
    }));
  }, [mode, parsed, voiceOverrides, styleOverrides, designOverrides]);

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
    if (mode === "clone" && missingRefs.length > 0) {
      message.warning(`角色「${missingRefs.join("、")}」还没上传参考音频`);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError("");
    try {
      let resp: Response;
      if (mode === "clone") {
        const form = new FormData();
        form.append("segments", JSON.stringify(effectiveSegments));
        parsed.roleOrder.forEach((role, i) => {
          const ref = refAudios[role];
          if (ref) form.append(`ref_${i}`, ref.file, ref.file.name);
        });
        resp = await fetch("/api/tts", { method: "POST", body: form, signal: controller.signal });
      } else {
        resp = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ segments: effectiveSegments }),
          signal: controller.signal,
        });
      }
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
  }, [effectiveSegments, mode, missingRefs, parsed.roleOrder, refAudios]);

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

  const changeStyle = (role: string, style: string) => {
    setStyleOverrides((prev) => ({ ...prev, [role]: style }));
  };

  const addRefAudio = (role: string) => (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".mp3") && !name.endsWith(".wav")) {
      message.error("仅支持 MP3 / WAV 参考音频");
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      message.error("参考音频不能超过 10MB");
      return false;
    }
    setRefAudios((prev) => {
      const old = prev[role];
      if (old) URL.revokeObjectURL(old.url);
      return { ...prev, [role]: { file, url: URL.createObjectURL(file) } };
    });
    return false;
  };

  const removeRefAudio = (role: string) => {
    setRefAudios((prev) => {
      const old = prev[role];
      if (old) URL.revokeObjectURL(old.url);
      const next = { ...prev };
      delete next[role];
      return next;
    });
  };

  const loadDesignExample = () => {
    setText(DESIGN_EXAMPLE_TEXT);
    setDesignOverrides((prev) => ({ ...prev, ...DESIGN_EXAMPLE_DESC }));
  };

  const loadCloneExample = async () => {
    setText(CLONE_EXAMPLE_TEXT);
    try {
      const resp = await fetch(`${import.meta.env.BASE_URL}tts-sample/voice-ref-sample.wav`);
      if (!resp.ok) throw new Error("示例音频加载失败");
      const blob = await resp.blob();
      const file = new File([blob], "示例参考音频.wav", { type: "audio/wav" });
      setRefAudios((prev) => {
        const old = prev[CLONE_EXAMPLE_ROLE];
        if (old) URL.revokeObjectURL(old.url);
        return { ...prev, [CLONE_EXAMPLE_ROLE]: { file, url: URL.createObjectURL(file) } };
      });
      message.success("已载入示例参考音频，点击生成即可试听克隆效果");
    } catch {
      message.error("示例音频加载失败，请手动上传参考音频");
    }
  };

  return (
    <Card title="AI 文字转语音" style={{ maxWidth: 1000, margin: "0 auto" }}>
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        <Segmented
          value={mode}
          onChange={(v) => setMode(v as TtsMode)}
          disabled={loading}
          options={MODE_OPTIONS}
          block
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {mode === "preset" && "预置音色：8 种官方音色，支持对话体多角色自动分配，每角色可调情感指令。"}
          {mode === "design" && "音色设计：用一句话描述想要的音色（性别/年龄/口音/音质/语速/气质），AI 全新生成，无需参考音频。"}
          {mode === "clone" && "音色复刻：每个角色上传几秒参考音频（MP3/WAV ≤10MB），高保真克隆声线；情感指令同样生效。"}
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
            {mode === "design" && (
              <Tag style={{ cursor: "pointer" }} color="purple" onClick={loadDesignExample}>
                🎨 音色设计一键示例
              </Tag>
            )}
            {mode === "clone" && (
              <Tag style={{ cursor: "pointer" }} color="geekblue" onClick={loadCloneExample}>
                🧬 音色复刻一键示例（含示例音频）
              </Tag>
            )}
          </Space>
        </div>

        {parsed.roleOrder.length > 0 && (
          <Card type="inner" size="small" title={`角色配置（${parsed.roleOrder.length} 个角色）`}>
            <Space direction="vertical" style={{ width: "100%" }} size="small">
              {parsed.roleOrder.map((role) => {
                const ref = refAudios[role];
                return (
                  <div key={role} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <Tag color={TAG_COLORS[parsed.roleOrder.indexOf(role) % TAG_COLORS.length]} style={{ minWidth: 72, textAlign: "center", marginTop: 0 }}>
                      {role}
                    </Tag>
                    {mode === "preset" && (
                      <Select
                        value={voiceFor(role)}
                        onChange={(v) => changeVoice(role, v)}
                        options={VOICE_OPTIONS}
                        style={{ width: 150 }}
                        disabled={loading}
                      />
                    )}
                    {mode === "design" && (
                      <AutoComplete
                        value={designOverrides[role] || ""}
                        onChange={(v) => setDesignOverrides((prev) => ({ ...prev, [role]: v }))}
                        options={DESIGN_PRESETS}
                        filterOption={(input, option) => (option?.value as string).includes(input)}
                        placeholder="描述音色：性别/年龄/口音/音质/语速/气质"
                        maxLength={300}
                        disabled={loading}
                        style={{ flex: 1, minWidth: 220 }}
                      />
                    )}
                    {mode === "clone" && (
                      <>
                        {ref ? (
                          <Space wrap style={{ flex: 1 }}>
                            <Tag
                              closable={!loading}
                              onClose={() => removeRefAudio(role)}
                              icon={<UploadOutlined />}
                            >
                              {(ref.file.name.length > 16 ? ref.file.name.slice(0, 16) + "…" : ref.file.name)}
                            </Tag>
                            <audio controls src={ref.url} style={{ height: 32, maxWidth: 240 }} />
                          </Space>
                        ) : (
                          <Upload accept=".mp3,.wav" showUploadList={false} beforeUpload={addRefAudio(role)} disabled={loading}>
                            <Button size="small" icon={<UploadOutlined />}>
                              上传参考音频（几秒 MP3/WAV）
                            </Button>
                          </Upload>
                        )}
                      </>
                    )}
                    <AutoComplete
                      value={styleOverrides[role] || ""}
                      onChange={(v) => changeStyle(role, v)}
                      options={EMOTION_OPTIONS}
                      filterOption={(input, option) => (option?.value as string).includes(input)}
                      placeholder="情感指令（可选）"
                      maxLength={200}
                      disabled={loading}
                      style={{ flex: 2, minWidth: 180 }}
                    />
                  </div>
                );
              })}
              {mode === "clone" && missingRefs.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  message={`角色「${missingRefs.join("、")}」还没上传参考音频`}
                />
              )}
              <Text type="secondary" style={{ fontSize: 12 }}>
                情感指令不会读出（仅控制语气）；也可在正文内嵌标签：段首 (开心)（慵懒）[东北话]，句间 (呼吸) (长叹一口气) (提高音量喊话) (紧张，深呼吸)
              </Text>
            </Space>
          </Card>
        )}

        {parsed.segments.length > 0 && (
          <Card
            type="inner"
            size="small"
            title={`分段预览（${parsed.segments.length} 段）`}
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
            disabled={parsed.segments.length === 0 || overLimit || (mode === "clone" && missingRefs.length > 0)}
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

