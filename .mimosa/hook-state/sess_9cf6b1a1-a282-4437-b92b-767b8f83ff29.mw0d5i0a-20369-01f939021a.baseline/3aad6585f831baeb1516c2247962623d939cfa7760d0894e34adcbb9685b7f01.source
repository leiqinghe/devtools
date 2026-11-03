import { useState, useCallback } from "react";
import {
  Card,
  Upload,
  Button,
  Slider,
  Space,
  message,
  Typography,
  Row,
  Col,
  Radio,
} from "antd";
import { DownloadOutlined, InboxOutlined, CopyOutlined } from "@ant-design/icons";
import type { UploadProps } from "antd";

function medianCutPalette(pixels: Uint8ClampedArray, colorCount: number): [number, number, number][] {
  interface Bucket { data: number[]; minR: number; maxR: number; minG: number; maxG: number; minB: number; maxB: number }
  const initBucket: Bucket = { data: [], minR: 255, maxR: 0, minG: 255, maxG: 0, minB: 255, maxB: 0 };

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    initBucket.data.push(r, g, b);
    if (r < initBucket.minR) initBucket.minR = r; if (r > initBucket.maxR) initBucket.maxR = r;
    if (g < initBucket.minG) initBucket.minG = g; if (g > initBucket.maxG) initBucket.maxG = g;
    if (b < initBucket.minB) initBucket.minB = b; if (b > initBucket.maxB) initBucket.maxB = b;
  }

  let buckets = [initBucket];
  while (buckets.length < colorCount) {
    buckets.sort((a, b) => b.data.length - a.data.length);
    const bucket = buckets.shift()!;
    if (bucket.data.length < 3) { buckets.push(bucket); continue; }

    const rRange = bucket.maxR - bucket.minR;
    const gRange = bucket.maxG - bucket.minG;
    const bRange = bucket.maxB - bucket.minB;

    let ch: 0 | 1 | 2;
    if (rRange >= gRange && rRange >= bRange) ch = 0;
    else if (gRange >= bRange) ch = 1;
    else ch = 2;

    const data = bucket.data;
    const vals: [number, number][] = [];
    for (let i = 0; i < data.length; i += 3) vals.push([data[i + ch], i]);
    vals.sort((a, b) => a[0] - b[0]);
    const mid = Math.floor(vals.length / 2);

    const mk = (): Bucket => ({ data: [], minR: 255, maxR: 0, minG: 255, maxG: 0, minB: 255, maxB: 0 });
    const b1 = mk(), b2 = mk();
    for (let vi = 0; vi < vals.length; vi++) {
      const idx = vals[vi][1];
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const t = vi < mid ? b1 : b2;
      t.data.push(r, g, b);
      if (r < t.minR) t.minR = r; if (r > t.maxR) t.maxR = r;
      if (g < t.minG) t.minG = g; if (g > t.maxG) t.maxG = g;
      if (b < t.minB) t.minB = b; if (b > t.maxB) t.maxB = b;
    }
    buckets.push(b1, b2);
  }

  return buckets.map((bk) => {
    const d = bk.data;
    let sr = 0, sg = 0, sb = 0;
    for (let i = 0; i < d.length; i += 3) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; }
    const n = d.length / 3;
    return [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)] as [number, number, number];
  });
}

function weightedDist(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const rMean = (r1 + r2) / 2;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db;
}

function posterizeImageData(imageData: ImageData, colorCount: number): ImageData {
  const pixels = imageData.data;
  const w = imageData.width, h = imageData.height;

  const palette = medianCutPalette(pixels, colorCount);

  for (let i = 0; i < pixels.length; i += 4) {
    let minDist = Infinity;
    let best = palette[0];
    for (const c of palette) {
      const d = weightedDist(pixels[i], pixels[i + 1], pixels[i + 2], c[0], c[1], c[2]);
      if (d < minDist) { minDist = d; best = c; }
    }
    pixels[i] = best[0]; pixels[i + 1] = best[1]; pixels[i + 2] = best[2];
  }

  const filtered = new Uint8ClampedArray(pixels.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const freq = new Map<string, number>();
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const o = ((y + dy) * w + (x + dx)) * 4;
          const k = `${pixels[o]},${pixels[o + 1]},${pixels[o + 2]}`;
          freq.set(k, (freq.get(k) || 0) + 1);
        }
      }
      let maxK = `${pixels[idx]},${pixels[idx + 1]},${pixels[idx + 2]}`;
      let maxV = 0;
      freq.forEach((c, k) => { if (c > maxV) { maxV = c; maxK = k; } });
      const [r, g, b] = maxK.split(",").map(Number);
      filtered[idx] = r; filtered[idx + 1] = g; filtered[idx + 2] = b; filtered[idx + 3] = 255;
    }
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      if (idx + 2 < pixels.length) { pixels[idx] = filtered[idx]; pixels[idx + 1] = filtered[idx + 1]; pixels[idx + 2] = filtered[idx + 2]; }
    }
  }

  return imageData;
}

export default function ImageToSvg() {
  const [srcImg, setSrcImg] = useState("");
  const [srcName, setSrcName] = useState("");
  const [svgContent, setSvgContent] = useState("");
  const [svgBlobUrl, setSvgBlobUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [colors, setColors] = useState(12);
  const [quality, setQuality] = useState<"standard" | "high">("high");
  const [outputScale, setOutputScale] = useState(2);

  const handleUpload: UploadProps["beforeUpload"] = (file) => {
    setSrcName(file.name);
    setSvgContent("");
    const reader = new FileReader();
    reader.onload = (e) => setSrcImg(e.target?.result as string);
    reader.readAsDataURL(file);
    return false;
  };

  const convertToSvg = useCallback(() => {
    if (!srcImg) { message.warning("请先上传图片"); return; }
    setLoading(true);

    const img = new window.Image();
    img.onload = async () => {
      try {
        const ImageTracer = await import("imagetracerjs");

        const upscale = quality === "high" ? 2 : 1;
        const srcW = img.naturalWidth;
        const srcH = img.naturalHeight;

        const canvas = document.createElement("canvas");
        canvas.width = srcW * upscale;
        canvas.height = srcH * upscale;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        const w = imageData.width;
        const h = imageData.height;

        const palette = medianCutPalette(pixels, colors);

        const posterized = posterizeImageData(imageData, colors);

        const allPaths: string[] = [];

        for (let ci = 0; ci < palette.length; ci++) {
          const [pr, pg, pb] = palette[ci];
          const layerData = new ImageData(w, h);
          const lp = layerData.data;

          for (let i = 0; i < pixels.length; i += 4) {
            const matched =
              pixels[i] === palette[ci][0] &&
              pixels[i + 1] === palette[ci][1] &&
              pixels[i + 2] === palette[ci][2];
            if (matched) {
              lp[i] = 255; lp[i + 1] = 255; lp[i + 2] = 255;
            }
            lp[i + 3] = 255;
          }

          let hasWhite = false;
          for (let i = 0; i < lp.length; i += 1024) {
            if (lp[i] === 255) { hasWhite = true; break; }
          }
          if (!hasWhite) continue;

          try {
            const td = ImageTracer.imagedataToTracedata(layerData, {
              numberofcolors: 2,
              scale: outputScale / upscale,
              ltres: quality === "high" ? 0.5 : 1,
              qtres: quality === "high" ? 0.5 : 1,
              pathomit: quality === "high" ? 1 : 6,
              colorsampling: 0,
              blurradius: 0,
            });

            const layerSvg = ImageTracer.getsvgstring(td, {
              viewbox: true,
              desc: false,
              scale: outputScale / upscale,
            });

            const parser = new DOMParser();
            const doc = parser.parseFromString(layerSvg, "image/svg+xml");
            const paths = doc.querySelectorAll("path");

            paths.forEach((p) => {
              const fill = (p.getAttribute("fill") || "").toLowerCase();
              if (fill === "none" || fill === "#000000" || fill === "black") return;
              const hex = "#" + pr.toString(16).padStart(2, "0") + pg.toString(16).padStart(2, "0") + pb.toString(16).padStart(2, "0");
              p.setAttribute("fill", hex);
              p.setAttribute("stroke", "none");
              allPaths.push(p.outerHTML);
            });
          } catch { continue; }
        }

        if (allPaths.length === 0) {
          const tracedata = ImageTracer.imagedataToTracedata(posterized, {
            numberofcolors: colors,
            scale: outputScale / upscale,
            ltres: quality === "high" ? 0.5 : 1,
            qtres: quality === "high" ? 0.5 : 1,
            pathomit: quality === "high" ? 1 : 6,
            colorsampling: 0,
            blurradius: 0,
          });
          const svg = ImageTracer.getsvgstring(tracedata, { viewbox: true, desc: false, scale: outputScale / upscale });
          setSvgContent(svg);
          if (svgBlobUrl) URL.revokeObjectURL(svgBlobUrl);
          setSvgBlobUrl(URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })));
        } else {
          const combined = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${srcW * upscale} ${srcH * upscale}" width="${srcW * upscale}" height="${srcH * upscale}">\n${allPaths.join("\n")}\n</svg>`;
          setSvgContent(combined);
          if (svgBlobUrl) URL.revokeObjectURL(svgBlobUrl);
          setSvgBlobUrl(URL.createObjectURL(new Blob([combined], { type: "image/svg+xml" })));
        }

        message.success("转换成功");
      } catch { message.error("转换失败，请尝试调整参数或更换图片"); }
      setLoading(false);
    };
    img.onerror = () => { message.error("图片加载失败"); setLoading(false); };
    img.src = srcImg;
  }, [srcImg, colors, quality, outputScale, svgBlobUrl]);

  const downloadSvg = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.download = srcName.replace(/\.[^.]+$/, "") + ".svg";
    a.href = url; a.click();
    URL.revokeObjectURL(url);
  };

  const copySvg = () => {
    if (!svgContent) return;
    navigator.clipboard.writeText(svgContent).then(() => message.success("SVG 代码已复制"));
  };

  return (
    <Card title="图片转 SVG 矢量图">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={8}>
            <Card size="small" title="上传图片" style={{ height: "100%" }}>
              <Upload.Dragger beforeUpload={handleUpload} accept="image/*" showUploadList={false} style={{ minHeight: 180 }}>
                <p className="ant-upload-drag-icon">
                  <InboxOutlined style={{ fontSize: 40, color: "#1677ff" }} />
                </p>
                <p className="ant-upload-text">点击或拖拽图片</p>
                <p className="ant-upload-hint">支持 PNG / JPG / WebP，Logo 图标效果最佳</p>
              </Upload.Dragger>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card size="small" title="原图" style={{ height: "100%" }}>
              <div style={{ minHeight: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {srcImg ? (
                  <img src={srcImg} alt="原图" style={{ maxWidth: "100%", maxHeight: 240 }} />
                ) : (
                  <Typography.Text type="secondary">等待上传</Typography.Text>
                )}
              </div>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card size="small" title={svgBlobUrl ? "SVG 预览" : "SVG 预览"} style={{ height: "100%" }}>
              <div style={{ minHeight: 180, display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa" }}>
                {svgBlobUrl ? (
                  <img src={svgBlobUrl} alt="SVG预览" style={{ maxWidth: "100%", maxHeight: 240 }} />
                ) : (
                  <Typography.Text type="secondary">点击「转换为 SVG」生成预览</Typography.Text>
                )}
              </div>
            </Card>
          </Col>
        </Row>

        <Card size="small">
          <Row gutter={[16, 12]} align="middle">
            <Col xs={24} sm={8}>
              <Typography.Text>颜色数：{colors}</Typography.Text>
              <Slider min={2} max={32} step={2} value={colors} onChange={setColors} />
            </Col>
            <Col xs={12} sm={8}>
              <Typography.Text>画质模式</Typography.Text>
              <Radio.Group value={quality} onChange={(e) => setQuality(e.target.value)} style={{ display: "block", marginTop: 4 }}>
                <Radio.Button value="standard">标准</Radio.Button>
                <Radio.Button value="high">高清 2x</Radio.Button>
              </Radio.Group>
            </Col>
            <Col xs={12} sm={8}>
              <Typography.Text>输出缩放：{outputScale}x</Typography.Text>
              <Slider min={1} max={4} step={0.5} value={outputScale} onChange={setOutputScale} />
            </Col>
            <Col span={24}>
              <Button type="primary" onClick={convertToSvg} loading={loading} size="large" block>
                转换为 SVG
              </Button>
            </Col>
          </Row>
        </Card>

        {svgContent && (
          <Space style={{ width: "100%", justifyContent: "center" }}>
            <Button type="primary" icon={<DownloadOutlined />} onClick={downloadSvg} size="large">
              下载 SVG
            </Button>
            <Button icon={<CopyOutlined />} onClick={copySvg} size="large">
              复制 SVG 代码
            </Button>
          </Space>
        )}
      </Space>
    </Card>
  );
}
