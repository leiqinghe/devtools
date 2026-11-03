import type { ComponentType, CSSProperties } from "react";
import {
  ClockCircleOutlined,
  CalendarOutlined,
  BgColorsOutlined,
  SwapOutlined,
  LinkOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  FontSizeOutlined,
  DollarOutlined,
  QrcodeOutlined,
  ScanOutlined,
  BarcodeOutlined,
  CodeOutlined,
  FileTextOutlined,
  CalculatorOutlined,
  ExperimentOutlined,
  FilterOutlined,
  PictureOutlined,
  CompressOutlined,
  AppstoreOutlined,
  BorderOutlined,
  KeyOutlined,
  BankOutlined,
  IdcardOutlined,
  ColumnWidthOutlined,
  CloudUploadOutlined,
  RobotOutlined,
} from "@ant-design/icons";

export interface ToolItem {
  path: string;
  Icon: ComponentType<{ style?: CSSProperties }>;
  title: string;
  desc: string;
}

export interface CategoryGroup {
  name: string;
  tools: ToolItem[];
}

export function renderIcon(Icon: ToolItem["Icon"], size: number) {
  return <Icon style={{ fontSize: size }} />;
}

export const toolGroups: CategoryGroup[] = [
  {
    name: "编码转换",
    tools: [
      { path: "/timestamp", Icon: ClockCircleOutlined, title: "时间戳转换", desc: "Unix 时间戳与日期互转，支持秒/毫秒" },
      { path: "/color-convert", Icon: BgColorsOutlined, title: "颜色格式转换", desc: "HEX / RGB / HSL / HSV 颜色互转" },
      { path: "/base-convert", Icon: SwapOutlined, title: "进制转换", desc: "二进制/八进制/十进制/十六进制互转" },
      { path: "/url-encode", Icon: LinkOutlined, title: "URL 编解码", desc: "URL 参数编码与解码" },
      { path: "/base64", Icon: LockOutlined, title: "Base64 编解码", desc: "文本与 Base64 互转" },
      { path: "/md5", Icon: SafetyCertificateOutlined, title: "MD5 加密", desc: "字符串 MD5 哈希计算" },
      { path: "/case-convert", Icon: FontSizeOutlined, title: "大小写转换", desc: "全大写/全小写/首字母大写/驼峰等" },
      { path: "/rmb-convert", Icon: DollarOutlined, title: "人民币大写转换", desc: "数字金额转中文大写" },
    ],
  },
  {
    name: "二维码/条码",
    tools: [
      { path: "/qrcode-gen", Icon: QrcodeOutlined, title: "二维码生成", desc: "将文本或链接生成二维码图片" },
      { path: "/qrcode-decode", Icon: ScanOutlined, title: "二维码解码", desc: "上传二维码图片解析内容" },
      { path: "/barcode-gen", Icon: BarcodeOutlined, title: "条形码生成", desc: "支持 CODE128 等格式条形码" },
    ],
  },
  {
    name: "文本处理",
    tools: [
      { path: "/json-format", Icon: CodeOutlined, title: "JSON 格式化", desc: "JSON 格式化、压缩、校验" },
      { path: "/text-diff", Icon: FileTextOutlined, title: "文本对比", desc: "两段文本逐行差异对比" },
      { path: "/word-count", Icon: CalculatorOutlined, title: "字数统计", desc: "字符/单词/行数/段落统计" },
      { path: "/regex-test", Icon: ExperimentOutlined, title: "正则测试", desc: "正则表达式实时匹配测试" },
      { path: "/info-extract", Icon: FilterOutlined, title: "信息提取", desc: "提取邮箱/电话/网址/IP/身份证号" },
    ],
  },
  {
    name: "图片工具",
    tools: [
      { path: "/image-gen", Icon: RobotOutlined, title: "AI 生图", desc: "输入提示词，AI 生成图片并下载" },
      { path: "/image-convert", Icon: PictureOutlined, title: "图片格式转换", desc: "PNG / JPEG / WebP / BMP 格式互转" },
      { path: "/image-compress", Icon: CompressOutlined, title: "图片压缩", desc: "调整图片质量/尺寸，减小文件大小" },
      { path: "/image-to-base64", Icon: PictureOutlined, title: "图片转 Base64", desc: "上传图片生成 Data URL 字符串" },
      { path: "/ico-maker", Icon: AppstoreOutlined, title: "ICO 图标制作", desc: "图片生成 .ico 图标文件" },
      { path: "/image-rounded", Icon: BorderOutlined, title: "图片切圆角", desc: "上传图片切圆角后导出" },
      { path: "/image-to-svg", Icon: PictureOutlined, title: "图片转 SVG", desc: "位图转矢量图，适合 Logo/图标/线稿" },
    ],
  },
  {
    name: "生成工具",
    tools: [
      { path: "/uuid-gen", Icon: KeyOutlined, title: "UUID 生成器", desc: "批量生成 UUID/GUID" },
      { path: "/password-gen", Icon: LockOutlined, title: "随机密码生成器", desc: "定制长度/字符集，批量生成" },
    ],
  },
  {
    name: "计算工具",
    tools: [
      { path: "/mortgage-calc", Icon: BankOutlined, title: "房贷计算器", desc: "等额本息/等额本金，月供计算" },
      { path: "/age-calc", Icon: CalendarOutlined, title: "年龄计算器", desc: "精确计算年龄/天数/周数" },
      { path: "/date-calc", Icon: CalendarOutlined, title: "日期计算器", desc: "日期差值、N天后日期、工作日计算" },
      { path: "/unit-convert", Icon: ColumnWidthOutlined, title: "单位换算", desc: "长度/重量/温度/面积/体积换算" },
      { path: "/id-card-parse", Icon: IdcardOutlined, title: "身份证信息提取", desc: "解析身份证号的省份/生日/性别" },
    ],
  },
  {
    name: "文件工具",
    tools: [
      { path: "/file-share", Icon: CloudUploadOutlined, title: "文件分享", desc: "上传文件生成短时下载链接和二维码" },
    ],
  },
];

export const allTools: ToolItem[] = toolGroups.flatMap((g) => g.tools);

export function getToolByPath(path: string): ToolItem | undefined {
  return allTools.find((t) => t.path === path);
}

export function getCategoryName(path: string): string | undefined {
  for (const g of toolGroups) {
    if (g.tools.some((t) => t.path === path)) return g.name;
  }
  return undefined;
}
