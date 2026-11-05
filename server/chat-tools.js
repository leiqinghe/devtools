// 站内工具清单（供对话机器人推荐工具用）。
// 由 scripts/sync-tool-catalog.mjs 从 src/data/tools.tsx 生成，请勿手改。
export const TOOL_CATALOG = [
  { path: "/timestamp", title: "时间戳转换", desc: "Unix 时间戳与日期互转，支持秒/毫秒" },
  { path: "/color-convert", title: "颜色格式转换", desc: "HEX / RGB / HSL / HSV 颜色互转" },
  { path: "/base-convert", title: "进制转换", desc: "二进制/八进制/十进制/十六进制互转" },
  { path: "/url-encode", title: "URL 编解码", desc: "URL 参数编码与解码" },
  { path: "/base64", title: "Base64 编解码", desc: "文本与 Base64 互转" },
  { path: "/md5", title: "MD5 加密", desc: "字符串 MD5 哈希计算" },
  { path: "/case-convert", title: "大小写转换", desc: "全大写/全小写/首字母大写/驼峰等" },
  { path: "/rmb-convert", title: "人民币大写转换", desc: "数字金额转中文大写" },
  { path: "/qrcode-gen", title: "二维码生成", desc: "将文本或链接生成二维码图片" },
  { path: "/qrcode-decode", title: "二维码解码", desc: "上传二维码图片解析内容" },
  { path: "/barcode-gen", title: "条形码生成", desc: "支持 CODE128 等格式条形码" },
  { path: "/json-format", title: "JSON 格式化", desc: "JSON 格式化、压缩、校验" },
  { path: "/text-diff", title: "文本对比", desc: "两段文本逐行差异对比" },
  { path: "/word-count", title: "字数统计", desc: "字符/单词/行数/段落统计" },
  { path: "/regex-test", title: "正则测试", desc: "正则表达式实时匹配测试" },
  { path: "/info-extract", title: "信息提取", desc: "提取邮箱/电话/网址/IP/身份证号" },
  { path: "/image-gen", title: "AI 生图", desc: "输入提示词，AI 生成图片并下载" },
  { path: "/image-convert", title: "图片格式转换", desc: "PNG / JPEG / WebP / BMP 格式互转" },
  { path: "/image-compress", title: "图片压缩", desc: "调整图片质量/尺寸，减小文件大小" },
  { path: "/image-to-base64", title: "图片转 Base64", desc: "上传图片生成 Data URL 字符串" },
  { path: "/ico-maker", title: "ICO 图标制作", desc: "图片生成 .ico 图标文件" },
  { path: "/image-rounded", title: "图片切圆角", desc: "上传图片切圆角后导出" },
  { path: "/image-to-svg", title: "图片转 SVG", desc: "位图转矢量图，适合 Logo/图标/线稿" },
  { path: "/uuid-gen", title: "UUID 生成器", desc: "批量生成 UUID/GUID" },
  { path: "/password-gen", title: "随机密码生成器", desc: "定制长度/字符集，批量生成" },
  { path: "/mortgage-calc", title: "房贷计算器", desc: "等额本息/等额本金，月供计算" },
  { path: "/age-calc", title: "年龄计算器", desc: "精确计算年龄/天数/周数" },
  { path: "/date-calc", title: "日期计算器", desc: "日期差值、N天后日期、工作日计算" },
  { path: "/unit-convert", title: "单位换算", desc: "长度/重量/温度/面积/体积换算" },
  { path: "/id-card-parse", title: "身份证信息提取", desc: "解析身份证号的省份/生日/性别" },
  { path: "/tts-gen", title: "AI 文字转语音", desc: "输入文本生成语音，多角色自动切换音色" },
  { path: "/file-share", title: "文件分享", desc: "上传文件生成短时下载链接和二维码" },
];

export function buildToolCatalogPrompt() {
  const lines = TOOL_CATALOG.map((t) => `- ${t.title}：${t.desc}（${t.path}）`);
  return [
    "站内可用的在线工具清单（推荐工具时请使用）:",
    ...lines,
    "",
    "输出规范：当回答中推荐站内工具时，必须用 markdown 相对链接格式 `[工具名](/path)`，" +
      "例如 `[JSON 格式化](/json-format)`。前端会把它渲染成可点击的工具卡片。" +
      "只使用上面清单里出现过的 path，不要编造站内地址。",
  ].join("\n");
}

// 供 widget 拉取工具元数据（用于卡片副标题），不含任何敏感信息
export function getToolMeta() {
  return TOOL_CATALOG.map((t) => ({ path: t.path, title: t.title, desc: t.desc }));
}
