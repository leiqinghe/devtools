import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  Col,
  Divider,
  message,
  Row,
  Segmented,
  Slider,
  Space,
  Spin,
  Typography,
  Upload,
} from "antd";
import {
  DeleteOutlined,
  DownloadOutlined,
  InboxOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import type { UploadProps } from "antd";

const { Text, Title } = Typography;

/** 预览图长边上限：预览实时调参用小图，导出时才跑原分辨率 */
const PREVIEW_MAX = 1200;
/** 自动色阶直方图裁剪比例 */
const LEVELS_CLIP = 0.005;

type PresetKey = "auto" | "vivid" | "soft" | "bw";

interface EnhanceParams {
  /** 总强度 0-100，控制自动色阶与预设效果的施加比例 */
  strength: number;
  brightness: number;
  contrast: number;
  saturation: number;
  sharpen: number;
}

interface PresetDef extends EnhanceParams {
  label: string;
}

const PRESETS: Record<PresetKey, PresetDef> = {
  auto: { label: "自动", strength: 60, brightness: 8, contrast: 12, saturation: 8, sharpen: 30 },
  vivid: { label: "鲜艳", strength: 70, brightness: 5, contrast: 20, saturation: 30, sharpen: 35 },
  soft: { label: "柔和", strength: 50, brightness: 14, contrast: 6, saturation: 2, sharpen: 15 },
  bw: { label: "黑白照", strength: 70, brightness: 8, contrast: 22, saturation: -100, sharpen: 40 },
};

interface PhotoItem {
  id: string;
  name: string;
  /** 原图预览（已按 EXIF 归正方向） */
  srcUrl: string;
  /** 处理后预览 */
  outUrl: string;
  processing: boolean;
  /** 原始解码结果，用于全分辨率导出 */
  source: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
}

let uidCounter = 0;

/** 解码图片并按 EXIF 方向归正（手机照片关键步骤） */
async function loadOriented(file: File): Promise<{ source: ImageBitmap | HTMLImageElement; width: number; height: number }> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bmp, width: bmp.width, height: bmp.height };
  } catch {
    // 旧浏览器回退：Image 解码（现代浏览器默认会应用 EXIF 方向渲染）
    const url = URL.createObjectURL(file);
    try {
      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("图片解码失败"));
        img.src = url;
      });
      return { source: img, width: img.naturalWidth, height: img.naturalHeight };
    } finally {
      // img 已解码完成， revoke 不影响已绘制的 canvas
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}

/**
 * 计算 256 级灰度 LUT：自动色阶（直方图裁剪拉伸）→ S 曲线对比 → gamma 亮度。
 * 自动色阶基于亮度直方图，三通道共用同一 LUT，避免偏色。
 */
function buildLut(data: Uint8ClampedArray, pxCount: number, p: {
  strength: number; brightness: number; contrast: number;
}): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);

  // 1) 自动色阶：按比例裁剪黑白场后拉伸（强度混合）
  const hist = new Uint32Array(256);
  for (let i = 0; i < pxCount; i++) {
    const o = i * 4;
    hist[(data[o] * 299 + data[o + 1] * 587 + data[o + 2] * 114) / 1000 | 0]++;
  }
  const clipTotal = pxCount * LEVELS_CLIP;
  let lo = 0;
  let acc = 0;
  while (lo < 255 && acc + hist[lo] < clipTotal) { acc += hist[lo]; lo++; }
  let hi = 255;
  acc = 0;
  while (hi > lo && acc + hist[hi] < clipTotal) { acc += hist[hi]; hi--; }
  // 直方图已基本铺满全区间时不拉伸，避免伤害本身曝光良好的照片
  let autoAmt = p.strength / 100;
  if (lo < 2 && hi > 253) autoAmt *= 0.15;
  if (hi - lo < 8) hi = Math.min(255, lo + 8);

  // 2) 对比度（经典线性对比，叠加在色阶之后）
  const contrastC = p.contrast;
  const cf = (259 * (contrastC + 255)) / (255 * (259 - contrastC));

  // 3) 亮度：gamma 调整中间调（正值提亮，相纸打印普遍偏暗需要预留）
  const gamma = Math.pow(2, -p.brightness / 100);

  for (let v = 0; v < 256; v++) {
    let x = v;
    // 自动色阶拉伸
    x = (1 - autoAmt) * x + autoAmt * ((x - lo) * 255) / (hi - lo);
    // 对比
    x = cf * (x - 128) + 128;
    // gamma 亮度
    x = Math.min(255, Math.max(0, x));
    x = 255 * Math.pow(x / 255, gamma);
    lut[v] = Math.round(Math.min(255, Math.max(0, x)));
  }
  return lut;
}

/** 简单可分离盒式模糊（ctx.filter 不可用时的锐化回退） */
function boxBlur(src: Uint8ClampedArray, w: number, h: number, radius: number): Uint8ClampedArray {
  const tmp = new Uint8ClampedArray(src.length);
  const out = new Uint8ClampedArray(src.length);
  const win = radius * 2 + 1;
  // 横向
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let x = -radius; x <= radius; x++) sum += src[(y * w + Math.min(w - 1, Math.max(0, x))) * 4 + c];
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * 4 + c] = sum / win;
        const add = src[(y * w + Math.min(w - 1, x + radius + 1)) * 4 + c];
        const sub = src[(y * w + Math.max(0, x - radius)) * 4 + c];
        sum += add - sub;
      }
    }
  }
  // 纵向
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let y = -radius; y <= radius; y++) sum += tmp[(Math.min(h - 1, Math.max(0, y)) * w + x) * 4 + c];
      for (let y = 0; y < h; y++) {
        out[(y * w + x) * 4 + c] = sum / win;
        const add = tmp[(Math.min(h - 1, y + radius + 1) * w + x) * 4 + c];
        const sub = tmp[(Math.max(0, y - radius) * w + x) * 4 + c];
        sum += add - sub;
      }
    }
  }
  return out;
}

/** 像素处理主流程：LUT + 饱和度 + Unsharp 锐化，返回处理后的 ImageData */
function enhanceImageData(data: Uint8ClampedArray, w: number, h: number, p: EnhanceParams) {
  const lut = buildLut(data, w * h, p);
  const sat = 1 + p.saturation / 100;
  const pxCount = w * h;

  // 单通道 LUT + 饱和度（绕亮度轴缩放色度）
  for (let i = 0; i < pxCount; i++) {
    const o = i * 4;
    let r = lut[data[o]];
    let g = lut[data[o + 1]];
    let b = lut[data[o + 2]];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    data[o] = l + (r - l) * sat;
    data[o + 1] = l + (g - l) * sat;
    data[o + 2] = l + (b - l) * sat;
  }

  // Unsharp 锐化：enhanced + amount * (enhanced - blurred)
  const amount = (p.sharpen / 100) * 0.9;
  if (amount > 0.01) {
    let blur: Uint8ClampedArray;
    const testCtx = document.createElement("canvas").getContext("2d");
    const radius = Math.max(0.8, w / 1000);
    if (testCtx && "filter" in testCtx) {
      const tmpCanvas = document.createElement("canvas");
      tmpCanvas.width = w;
      tmpCanvas.height = h;
      const tctx = tmpCanvas.getContext("2d")!;
      tctx.filter = `blur(${radius}px)`;
      // 先把当前（已增强）像素回画到临时画布上再模糊
      tctx.putImageData(new ImageData(data.slice(), w, h), 0, 0);
      blur = tctx.getImageData(0, 0, w, h).data;
    } else {
      blur = boxBlur(data, w, h, Math.max(1, Math.round(radius)));
    }
    for (let i = 0; i < pxCount; i++) {
      const o = i * 4;
      data[o] = data[o] + amount * (data[o] - blur[o]);
      data[o + 1] = data[o + 1] + amount * (data[o + 1] - blur[o + 1]);
      data[o + 2] = data[o + 2] + amount * (data[o + 2] - blur[o + 2]);
    }
  }
}

/** 把 source 绘制到指定尺寸 canvas 并执行增强管线 */
function renderEnhanced(
  source: ImageBitmap | HTMLImageElement,
  w: number,
  h: number,
  params: EnhanceParams,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source as CanvasImageSource, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  enhanceImageData(imgData.data, w, h, params);
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type = "image/jpeg", quality = 0.95): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("导出失败"))),
      type,
      quality,
    );
  });
}

/** 原图/效果图对比：拖动分割线 */
function CompareView({ srcUrl, outUrl }: { srcUrl: string; outUrl: string }) {
  const [pos, setPos] = useState(50);
  const boxRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const updateFromEvent = useCallback((clientX: number) => {
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  return (
    <div
      ref={boxRef}
      className="pp-compare"
      style={{ position: "relative", overflow: "hidden", cursor: "ew-resize", lineHeight: 0 }}
      onPointerDown={(e) => {
        draggingRef.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        updateFromEvent(e.clientX);
      }}
      onPointerMove={(e) => draggingRef.current && updateFromEvent(e.clientX)}
      onPointerUp={() => { draggingRef.current = false; }}
      onPointerLeave={() => { draggingRef.current = false; }}
    >
      <img src={outUrl} alt="处理后" style={{ width: "100%", display: "block" }} draggable={false} />
      <img
        src={srcUrl}
        alt="原图"
        draggable={false}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "fill",
          clipPath: `inset(0 ${100 - pos}% 0 0)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${pos}%`,
          width: 2,
          background: "#fff",
          boxShadow: "0 0 4px rgba(0,0,0,.6)",
        }}
      />
      <Text style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 12, padding: "1px 8px", borderRadius: 4 }}>
        原图
      </Text>
      <Text style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 12, padding: "1px 8px", borderRadius: 4 }}>
        处理后
      </Text>
    </div>
  );
}

export default function PhotoPrint() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [preset, setPreset] = useState<PresetKey>("auto");
  const [params, setParams] = useState<EnhanceParams>({ ...PRESETS.auto });
  const [printLayout, setPrintLayout] = useState<"one" | "flow">("one");
  const [exporting, setExporting] = useState(false);
  const previewTimer = useRef<number | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const applyPreset = (key: PresetKey) => {
    setPreset(key);
    setParams({ ...PRESETS[key] });
  };

  const setParam = (key: keyof EnhanceParams, value: number) => {
    setParams((p) => ({ ...p, [key]: value }));
  };

  /** 参数变化后重新生成所有预览（防抖） */
  useEffect(() => {
    if (!photos.length) return;
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(async () => {
      const p = paramsRef.current;
      setPhotos((list) => list.map((it) => ({ ...it, processing: true })));
      for (const item of photos) {
        const scale = Math.min(1, PREVIEW_MAX / Math.max(item.width, item.height));
        const w = Math.max(1, Math.round(item.width * scale));
        const h = Math.max(1, Math.round(item.height * scale));
        const canvas = renderEnhanced(item.source, w, h, p);
        const url = canvas.toDataURL("image/jpeg", 0.9);
        setPhotos((list) =>
          list.map((it) => (it.id === item.id ? { ...it, outUrl: url, processing: false } : it)),
        );
        await new Promise((r) => requestAnimationFrame(r));
      }
    }, 250);
    return () => {
      if (previewTimer.current) window.clearTimeout(previewTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, photos.length]);

  const handleUpload: UploadProps["beforeUpload"] = async (file) => {
    try {
      const { source, width, height } = await loadOriented(file);
      const scale = Math.min(1, PREVIEW_MAX / Math.max(width, height));
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));
      const srcCanvas = document.createElement("canvas");
      srcCanvas.width = w;
      srcCanvas.height = h;
      srcCanvas.getContext("2d")!.drawImage(source as CanvasImageSource, 0, 0, w, h);
      const srcUrl = srcCanvas.toDataURL("image/jpeg", 0.9);
      const item: PhotoItem = {
        id: `pp-${++uidCounter}`,
        name: file.name,
        srcUrl,
        outUrl: srcUrl,
        processing: true,
        source,
        width,
        height,
      };
      setPhotos((list) => [...list, item]);
      // 新增图片立即用当前参数生成一次预览
      const canvas = renderEnhanced(source, w, h, paramsRef.current);
      const outUrl = canvas.toDataURL("image/jpeg", 0.9);
      setPhotos((list) => list.map((it) => (it.id === item.id ? { ...it, outUrl, processing: false } : it)));
    } catch {
      message.error(`图片 ${file.name} 解码失败`);
    }
    return false;
  };

  const removePhoto = (id: string) => {
    setPhotos((list) => list.filter((it) => it.id !== id));
  };

  const clearAll = () => setPhotos([]);

  /** 全分辨率导出（保持原始像素，不缩小尺寸，打印质量关键） */
  const generateFull = async (item: PhotoItem): Promise<Blob> => {
    const canvas = renderEnhanced(item.source, item.width, item.height, paramsRef.current);
    return canvasToBlob(canvas);
  };

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const downloadOne = async (item: PhotoItem) => {
    const key = `dl-${item.id}`;
    message.loading({ content: "正在生成高清图…", key, duration: 0 });
    try {
      const blob = await generateFull(item);
      const base = item.name.replace(/\.[^.]+$/, "");
      downloadBlob(blob, `${base}-打印增强.jpg`);
      message.success({ content: "已下载", key });
    } catch {
      message.error({ content: "生成失败", key });
    }
  };

  const downloadAll = async () => {
    if (!photos.length) return;
    setExporting(true);
    const key = "dl-all";
    message.loading({ content: `正在生成 0/${photos.length} 张…`, key, duration: 0 });
    try {
      for (let i = 0; i < photos.length; i++) {
        const blob = await generateFull(photos[i]);
        const base = photos[i].name.replace(/\.[^.]+$/, "");
        downloadBlob(blob, `${base}-打印增强.jpg`);
        message.loading({ content: `正在生成 ${i + 1}/${photos.length} 张…`, key, duration: 0 });
        await new Promise((r) => setTimeout(r, 350));
      }
      message.success({ content: "全部下载完成", key });
    } catch {
      message.error({ content: "批量下载失败", key });
    } finally {
      setExporting(false);
    }
  };

  /** 打印：生成高清图写入隐藏 iframe（独立打印文档，与页面样式隔离），唤起系统打印对话框 */
  const printAll = async () => {
    if (!photos.length) return;
    setExporting(true);
    const key = "print";
    message.loading({ content: "正在生成打印图…", key, duration: 0 });
    let iframe: HTMLIFrameElement | null = null;
    const urls: string[] = [];
    try {
      for (const item of photos) {
        const blob = await generateFull(item);
        urls.push(URL.createObjectURL(blob));
      }
      iframe = document.createElement("iframe");
      iframe.setAttribute("aria-hidden", "true");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0;";
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument;
      if (!doc) throw new Error("无法创建打印文档");
      doc.open();
      doc.write(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@page { margin: 8mm; }
html, body { margin: 0; padding: 0; background: #fff; }
img { display: block; margin: 0 auto 6mm; max-width: 100%; }
body.one img { max-height: 95vh; page-break-after: always; break-after: page; }
body.one img:last-child { page-break-after: auto; break-after: auto; }
body.flow img { max-height: 42vh; }
</style></head><body class="${printLayout}">${urls.map((u) => `<img src="${u}">`).join("")}</body></html>`,
      );
      doc.close();
      // 等全部图片加载完成再唤起打印
      await Promise.all(
        [...doc.images].map((img) =>
          img.complete ? Promise.resolve() : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); }),
        ),
      );
      message.success({ content: "请在打印对话框中选择打印机和纸张", key });
      setTimeout(() => {
        iframe?.contentWindow?.focus();
        iframe?.contentWindow?.print();
        // 打印对话框关闭后延迟清理（无法可靠探测关闭时机，保留 60s）
        setTimeout(() => {
          iframe?.remove();
          urls.forEach((u) => URL.revokeObjectURL(u));
        }, 60000);
      }, 200);
    } catch {
      message.error({ content: "生成打印图失败", key });
      iframe?.remove();
      urls.forEach((u) => URL.revokeObjectURL(u));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <Card>
        <Upload.Dragger
          multiple
          accept="image/*"
          showUploadList={false}
          beforeUpload={handleUpload}
          disabled={exporting}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或拖入照片，支持一次选择多张</p>
          <p className="ant-upload-hint">
            手机照片自动提亮、增艳、锐化，适配相纸打印；图片仅在本地浏览器处理，不会上传
          </p>
        </Upload.Dragger>
      </Card>

      {photos.length > 0 && (
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col xs={24} md={8}>
            <Card title="增强参数" size="small">
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary">预设（针对相纸打印调校）</Text>
              </div>
              <Segmented
                block
                value={preset}
                onChange={(v) => applyPreset(v as PresetKey)}
                options={Object.entries(PRESETS).map(([k, v]) => ({ label: v.label, value: k }))}
              />
              <Divider style={{ margin: "16px 0 8px" }} />
              <Text type="secondary">总强度：{params.strength}</Text>
              <Slider min={0} max={100} value={params.strength} onChange={(v) => setParam("strength", v)} />
              <Text type="secondary">亮度：{params.brightness > 0 ? `+${params.brightness}` : params.brightness}</Text>
              <Slider min={-50} max={50} value={params.brightness} onChange={(v) => setParam("brightness", v)} />
              <Text type="secondary">对比度：{params.contrast > 0 ? `+${params.contrast}` : params.contrast}</Text>
              <Slider min={-50} max={50} value={params.contrast} onChange={(v) => setParam("contrast", v)} />
              <Text type="secondary">饱和度：{params.saturation > 0 ? `+${params.saturation}` : params.saturation}</Text>
              <Slider min={-100} max={100} value={params.saturation} onChange={(v) => setParam("saturation", v)} />
              <Text type="secondary">锐化：{params.sharpen}</Text>
              <Slider min={0} max={100} value={params.sharpen} onChange={(v) => setParam("sharpen", v)} />
              <Divider style={{ margin: "12px 0 8px" }} />
              <Text type="secondary">打印布局</Text>
              <div style={{ marginTop: 4, marginBottom: 12 }}>
                <Segmented
                  block
                  value={printLayout}
                  onChange={(v) => setPrintLayout(v as "one" | "flow")}
                  options={[
                    { label: "每页一张", value: "one" },
                    { label: "连续排版", value: "flow" },
                  ]}
                />
              </div>
              <Space wrap>
                <Button type="primary" icon={<PrinterOutlined />} loading={exporting} onClick={printAll}>
                  直接打印（{photos.length} 张）
                </Button>
                <Button icon={<DownloadOutlined />} loading={exporting} onClick={downloadAll}>
                  全部下载
                </Button>
                <Button danger type="text" icon={<DeleteOutlined />} onClick={clearAll}>
                  清空
                </Button>
              </Space>
              <Divider style={{ margin: "12px 0 8px" }} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                导出保持原始分辨率（如 {photos[0].width}×{photos[0].height}），JPEG 质量 95%。
                打印建议在系统对话框中关闭"适应页面"以外的缩放，相纸选择对应尺寸。
              </Text>
            </Card>
          </Col>

          <Col xs={24} md={16}>
            <Row gutter={[16, 16]}>
              {photos.map((item) => (
                <Col xs={24} sm={12} key={item.id}>
                  <Card
                    size="small"
                    title={<span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>}
                    extra={
                      <Space size={4}>
                        <Button size="small" type="link" icon={<DownloadOutlined />} onClick={() => downloadOne(item)}>
                          下载
                        </Button>
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removePhoto(item.id)} />
                      </Space>
                    }
                    styles={{ body: { padding: 8 } }}
                  >
                    {item.processing ? (
                      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                        <Spin tip="处理中…" />
                      </div>
                    ) : (
                      <CompareView srcUrl={item.srcUrl} outUrl={item.outUrl} />
                    )}
                    <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.width}×{item.height}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        拖动图片上的分割线对比
                      </Text>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Col>
        </Row>
      )}

      {photos.length === 0 && (
        <Card style={{ marginTop: 16 }}>
          <Title level={5} style={{ marginTop: 0 }}>使用说明</Title>
          <Text type="secondary">
            <p>1. 上传手机拍摄的照片（支持批量），工具自动完成 EXIF 方向归正与画质增强。</p>
            <p>2. 自动增强包含：直方图自动色阶（去灰）、中间调提亮（补偿相纸偏暗）、轻度提饱和、Unsharp 锐化补偿打印柔化。</p>
            <p>3. 拖动预览图上的分割线对比原图与效果图，可切换预设或手动微调参数。</p>
            <p>4. 满意后点击「下载」保存增强图，或「直接打印」在系统打印对话框中选择打印机与相纸尺寸。</p>
          </Text>
        </Card>
      )}
    </div>
  );
}
