import { useState, useCallback } from "react";
import {
  Card,
  Upload,
  Select,
  Button,
  Space,
  message,
  Typography,
  Row,
  Col,
  Alert,
  Tag,
  Statistic,
  Progress,
  Input,
} from "antd";
import {
  InboxOutlined,
  CopyOutlined,
  LinkOutlined,
  QrcodeOutlined,
  DownloadOutlined,
  KeyOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { UploadProps } from "antd";
import QRCodeLib from "qrcode";

const CODE_PATTERN = /^[a-zA-Z0-9]{3,12}$/;

interface CodePickResult {
  id: string;
  name: string;
  size: number;
  expiresAt: string;
  downloadUrl: string;
}

const TTL_OPTIONS = [
  { value: 5, label: "5 分钟" },
  { value: 10, label: "10 分钟" },
  { value: 30, label: "30 分钟" },
  { value: 60, label: "1 小时" },
  { value: 1440, label: "24 小时" },
];

const CHUNK_SIZE = 2 * 1024 * 1024;
const CONCURRENCY = 4;

function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface ShareResult {
  id: string;
  expiresAt: string;
  size: number;
}

function uploadChunk(
  file: File,
  fileId: string,
  partIndex: number,
  totalParts: number,
  ttl: number,
  code: string
): Promise<{ done: boolean; data?: ShareResult & { code?: string | null }; error?: string }> {
  return new Promise((resolve, reject) => {
    const start = partIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const blob = file.slice(start, end);

    const form = new FormData();
    form.append("file", blob, file.name);
    form.append("fileId", fileId);
    form.append("partIndex", String(partIndex));
    form.append("totalParts", String(totalParts));
    form.append("minutes", String(ttl));
    form.append("name", file.name);
    form.append("type", file.type);
    if (code) {
      form.append("code", code);
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/share/upload");
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ done: data.done === true, data: data.done ? data : undefined });
        } else {
          reject(new Error(data?.error || "分片上传失败"));
        }
      } catch {
        reject(new Error("响应解析失败"));
      }
    };
    xhr.onerror = () => reject(new Error("网络错误"));
    xhr.send(form);
  });
}

export default function FileShare() {
  const [file, setFile] = useState<File | null>(null);
  const [ttl, setTtl] = useState(10);
  const [shareCode, setShareCode] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<(ShareResult & { code?: string | null }) | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  // 快捷取件
  const [pickCode, setPickCode] = useState("");
  const [pickLoading, setPickLoading] = useState(false);
  const [pickResult, setPickResult] = useState<CodePickResult | null>(null);

  const handleUpload: UploadProps["beforeUpload"] = (f) => {
    if (f.size > 500 * 1024 * 1024) {
      message.error("文件不能超过 500MB");
      return false;
    }
    setFile(f);
    setResult(null);
    setShareUrl("");
    setQrDataUrl("");
    return false;
  };

  const doShare = useCallback(async () => {
    if (!file) {
      message.warning("请先选择文件");
      return;
    }
    setUploading(true);
    setProgress(0);

    try {
      const code = shareCode.trim();
      if (code && !CODE_PATTERN.test(code)) {
        throw new Error("分享码需为 3~12 位字母或数字");
      }
      const fileId = genId();
      const totalParts = Math.ceil(file.size / CHUNK_SIZE);
      let uploadedBytes = 0;
      let nextPart = 0;
      let resultData: (ShareResult & { code?: string | null }) | null = null;

      const uploadWorker = async (): Promise<void> => {
        while (nextPart < totalParts) {
          const partIndex = nextPart++;
          const chunkBytes = Math.min(CHUNK_SIZE, file.size - partIndex * CHUNK_SIZE);
          const { data } = await uploadChunk(file, fileId, partIndex, totalParts, ttl, code);
          uploadedBytes += chunkBytes;
          setProgress(Math.min(99, Math.round((uploadedBytes / file.size) * 100)));
          if (data) resultData = data;
        }
      };

      const workers = Array.from({ length: Math.min(CONCURRENCY, totalParts) }, () => uploadWorker());
      await Promise.all(workers);

      if (!resultData) {
        throw new Error("上传未完成，请重试");
      }

      const url = `${window.location.origin}/share/${resultData.id}`;
      setResult(resultData);
      setShareUrl(url);
      const qr = await QRCodeLib.toDataURL(url, { width: 200, margin: 1 });
      setQrDataUrl(qr);
      setProgress(100);
      message.success(resultData.code ? `分享已生成，快捷码：${resultData.code}` : "分享链接已生成");
    } catch (e: unknown) {
      const err = e as Error;
      message.error(err.message || "上传失败，请重试");
    }
    setUploading(false);
  }, [file, ttl, shareCode]);

  const pickByCode = useCallback(async () => {
    const code = pickCode.trim();
    if (!code) {
      message.warning("请输入分享码");
      return;
    }
    setPickLoading(true);
    setPickResult(null);
    try {
      const resp = await fetch(`/api/share/code/${encodeURIComponent(code)}`);
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.error || `查询失败（${resp.status}）`);
      }
      setPickResult(data as CodePickResult);
    } catch (e: unknown) {
      message.error((e as Error).message || "查询失败");
    } finally {
      setPickLoading(false);
    }
  }, [pickCode]);

  const copyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl).then(() => message.success("链接已复制"));
    }
  };

  const fastDownload = async () => {
    if (!result || !shareUrl) return;
    const size = result.size;
    const parts = Math.min(4, Math.ceil(size / CHUNK_SIZE));
    if (size < CHUNK_SIZE * 2) {
      window.open(shareUrl, "_blank");
      return;
    }
    message.loading("高速下载中...", 0);
    try {
      const partSize = Math.ceil(size / parts);
      const ranges = Array.from({ length: parts }, (_, i) => ({
        start: i * partSize,
        end: Math.min((i + 1) * partSize - 1, size - 1),
      }));

      const buffers = await Promise.all(
        ranges.map((r) =>
          fetch(shareUrl, {
            headers: { Range: `bytes=${r.start}-${r.end}` },
          }).then((resp) => {
            if (!resp.ok && resp.status !== 206) throw new Error("下载失败");
            return resp.arrayBuffer();
          })
        )
      );

      const blob = new Blob(buffers);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file ? file.name : "download";
      a.click();
      URL.revokeObjectURL(url);
      message.destroy();
      message.success("下载完成");
    } catch {
      message.destroy();
      message.error("高速下载失败，请用普通链接下载");
    }
  };

  const formatSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const expiresIn = result
    ? Math.max(1, Math.round((new Date(result.expiresAt).getTime() - Date.now()) / 60000))
    : 0;

  return (
    <Card title="文件分享">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          message="短时文件分享"
          description="文件保存在服务器内存中，到期自动删除，不会持久化存储。适合临时传文件给同事/手机快速取用。可设置快捷分享码，对方输入码即可下载。"
        />

        <Card size="small" type="inner" title={<Space><KeyOutlined /> 快捷取件</Space>}>
          <Space.Compact style={{ width: "100%", maxWidth: 480 }}>
            <Input
              value={pickCode}
              onChange={(e) => setPickCode(e.target.value)}
              placeholder="输入对方给你的分享码，如 123"
              maxLength={12}
              onPressEnter={pickByCode}
              allowClear
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={pickByCode} loading={pickLoading}>
              取件
            </Button>
          </Space.Compact>
          {pickResult && (
            <div style={{ marginTop: 12, padding: "12px 16px", background: "#f0f7ff", borderRadius: 8 }}>
              <Typography.Text strong>{pickResult.name}</Typography.Text>
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                大小：{formatSize(pickResult.size)} · 有效期至 {new Date(pickResult.expiresAt).toLocaleString()}
              </div>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                href={pickResult.downloadUrl}
                target="_blank"
                rel="noreferrer"
                style={{ marginTop: 8 }}
              >
                下载文件
              </Button>
            </div>
          )}
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={14}>
            <Upload.Dragger
              beforeUpload={handleUpload}
              multiple={false}
              showUploadList={false}
              style={{ minHeight: 160 }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ fontSize: 44, color: "#1677ff" }} />
              </p>
              <p className="ant-upload-text" style={{ fontSize: 15 }}>
                点击或拖拽文件到此处上传
              </p>
              <p className="ant-upload-hint">支持任意格式，单个文件最大 500MB</p>
            </Upload.Dragger>

            {file && (
              <div style={{ marginTop: 12, padding: "12px 16px", background: "#f6ffed", borderRadius: 8 }}>
                <Typography.Text strong>已选择：{file.name}</Typography.Text>
                <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                  大小：{formatSize(file.size)}
                </div>
              </div>
            )}
          </Col>

          <Col xs={24} md={10}>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <div>
                <Typography.Text strong>有效时间</Typography.Text>
                <Select
                  value={ttl}
                  onChange={setTtl}
                  options={TTL_OPTIONS}
                  style={{ width: "100%", marginTop: 8 }}
                  size="large"
                />
              </div>
              <div>
                <Typography.Text strong>快捷分享码（可选）</Typography.Text>
                <Input
                  value={shareCode}
                  onChange={(e) => setShareCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                  placeholder="3~12 位字母数字，如 123"
                  maxLength={12}
                  allowClear
                  prefix={<KeyOutlined style={{ color: "#bbb" }} />}
                  style={{ marginTop: 8 }}
                />
                <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                  设置后，另一台设备在本页输入分享码即可直接下载
                </div>
              </div>
              <Button type="primary" onClick={doShare} loading={uploading} size="large" block>
                {uploading ? `上传中 ${progress}%` : "生成分享链接"}
              </Button>
              {uploading && (
                <Progress
                  percent={progress}
                  status="active"
                  size="small"
                  strokeColor={{ from: "#108ee9", to: "#87d068" }}
                />
              )}
            </Space>
          </Col>
        </Row>

        {result && shareUrl && (
          <Card size="small" type="inner">
            <Row gutter={16} align="middle">
              <Col xs={24} md={8}>
                <div style={{ textAlign: "center" }}>
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="分享二维码" style={{ width: 160, height: 160 }} />
                  ) : (
                    <QrcodeOutlined style={{ fontSize: 60, color: "#999" }} />
                  )}
                </div>
              </Col>
              <Col xs={24} md={16}>
                <Space direction="vertical" size="small" style={{ width: "100%" }}>
                  <Space wrap>
                    <Tag color="blue">分享链接已生成</Tag>
                    {result.code && <Tag color="green" icon={<KeyOutlined />}>快捷码：{result.code}</Tag>}
                  </Space>
                  <Typography.Text strong style={{ wordBreak: "break-all" }}>
                    <LinkOutlined /> {shareUrl}
                  </Typography.Text>
                  <Space wrap>
                    <Button icon={<CopyOutlined />} onClick={copyLink}>
                      复制链接
                    </Button>
                    <Button
                      href={shareUrl}
                      target="_blank"
                      rel="noreferrer"
                      icon={<LinkOutlined />}
                    >
                      打开链接
                    </Button>
                    <Button type="primary" onClick={fastDownload} icon={<DownloadOutlined />}>
                      高速下载
                    </Button>
                  </Space>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Statistic title="文件大小" value={formatSize(result.size)} valueStyle={{ fontSize: 16 }} />
                    </Col>
                    <Col span={8}>
                      <Statistic title="有效时间" value={`${expiresIn} 分钟`} valueStyle={{ fontSize: 16 }} />
                    </Col>
                    <Col span={8}>
                      <Statistic title="状态" value="有效" valueStyle={{ fontSize: 16, color: "#52c41a" }} />
                    </Col>
                  </Row>
                </Space>
              </Col>
            </Row>
          </Card>
        )}
      </Space>
    </Card>
  );
}
