# DevTools - 开发者在线工具集

打开即用，用完即走。无需注册登录，所有数据本地处理不上传服务器。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18 | UI 框架 |
| TypeScript | 5.6 | 类型安全 |
| Vite | 5 | 构建工具 |
| Ant Design | 5 | UI 组件库 |
| react-router-dom | 6 | 前端路由 |
| qrcode | 1.5 | 二维码生成 |
| jsqr | 1.4 | 二维码解析 |
| crypto-js | 4 | 哈希/加密 |
| jsbarcode | 3 | 条形码生成 |

## 快速开始

```bash
npm install      # 安装依赖
npm run dev      # 启动开发服务器 (http://localhost:5173)
npm run build    # 生产构建
npm run preview  # 预览生产构建
```

---

## 项目结构

```
qrcode/
├── index.html                 # HTML 入口
├── vite.config.ts             # Vite 构建配置（含 chunk 拆分）
├── Dockerfile                 # Docker 多阶段构建
├── nginx.conf                 # Nginx 配置
├── docker-compose.yml         # Docker 编排
│
├── public/
│   ├── site.config.json       # 🌐 站点配置（URL/名称等）
│   └── favicon.svg            # 站点图标
│
└── src/
    ├── main.tsx               # React 入口
    ├── App.tsx                # 路由表 + 懒加载
    ├── index.css              # 全局样式
    │
    ├── data/
    │   └── tools.tsx          # 🔧 工具注册中心（所有工具定义 + 分类）
    │
    ├── layouts/
    │   └── MainLayout.tsx     # 主布局（头部/面包屑/SEO/页脚/手机二维码）
    │
    └── pages/
        ├── Home.tsx           # 首页（收藏/搜索/拖拽）
        └── tools/
            ├── Timestamp.tsx  # 时间戳转换
            ├── QRCodeGen.tsx  # 二维码生成
            ├── ...            # 28 个工具页面
            └── IdCardParse.tsx
```

---

## 如何新增一个工具

只需 **3 步**，约 5 分钟即可上线一个新工具。

### 第 1 步：注册工具定义

编辑 `src/data/tools.tsx`，在对应分类的 `tools` 数组中添加：

```tsx
{
  path: "/my-tool",                       // 路由路径（全局唯一）
  Icon: YourIconComponent,                // 从 @ant-design/icons 导入
  title: "工具名称",                       // 显示在页面标题和卡片上
  desc: "一句话描述工具功能",               // 卡片副标题
}
```

**选择图标**：从 [Ant Design 图标库](https://ant.design/components/icon-cn) 挑选，在文件顶部 import 即可。

### 第 2 步：创建工具页面

在 `src/pages/tools/` 下创建文件 `MyTool.tsx`：

```tsx
import { useState } from "react";
import { Card, Input, Button, Space, message, Typography } from "antd";
import { CopyOutlined } from "@ant-design/icons";

export default function MyTool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  const handleAction = () => {
    if (!input.trim()) {
      message.warning("请输入内容");
      return;
    }
    setOutput(input); // 你的业务逻辑
    message.success("处理成功");
  };

  return (
    <Card title="工具名称">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={6}
          placeholder="输入内容..."
          size="large"
        />
        <Space>
          <Button type="primary" onClick={handleAction}>
            执行操作
          </Button>
          <Button
            icon={<CopyOutlined />}
            onClick={() => {
              navigator.clipboard.writeText(output).then(() => message.success("已复制"));
            }}
          >
            复制结果
          </Button>
        </Space>
        {output && (
          <Card size="small" type="inner">
            <Typography.Paragraph style={{ margin: 0, wordBreak: "break-all" }}>
              {output}
            </Typography.Paragraph>
          </Card>
        )}
      </Space>
    </Card>
  );
}
```

### 第 3 步：注册路由

编辑 `src/App.tsx`：

```tsx
// 在文件顶部添加懒加载 import
const MyTool = lazy(() => import("./pages/tools/MyTool"));

// 在 <Routes> 内添加路由（按字母序插入）
<Route path="/my-tool" element={<LazyLoad><MyTool /></LazyLoad>} />
```

**完成！** 工具会自动出现在首页对应分类、顶部导航菜单、搜索索引中。面包屑、SEO title/meta、手机扫码等全部自动适配。

---

## 如何新增分类

编辑 `src/data/tools.tsx`，在 `toolGroups` 数组中添加新的分类对象：

```tsx
{
  name: "分类名称",
  tools: [
    { path: "/tool-1", Icon: ... , title: "工具1", desc: "..." },
    { path: "/tool-2", Icon: ... , title: "工具2", desc: "..." },
  ],
}
```

分类自动出现在首页和顶部导航中。

---

## SEO 说明

每个工具页面自动生成 SEO 信息（由 `MainLayout.tsx` 统一处理）：

- `<title>` 格式：`工具名称 - 在线免费 - DevTools`
- `<meta description>` 格式：`工具名称，工具描述，在线免费工具`

如果需要在某个工具页自定义 SEO header，可在工具组件中通过 `useEffect` 直接操作 `document.title` 覆盖。

搜索引擎关键优化已内置：
- 所有内容 SSR 友好（静态 HTML 入口）
- 语义化路由（`/json-format` 而非 hash 路由）
- 面包屑导航（搜索引擎可爬取层级关系）
- Nginx 配置了 Gzip + 静态资源缓存

---

## 站点配置

编辑 `public/site.config.json`：

```json
{
  "siteUrl": "http://your-domain.com:8100",   // 用于生成手机扫码二维码
  "siteName": "DevTools",
  "siteDescription": "开发者在线工具集"
}
```

部署前修改 `siteUrl` 为实际域名或 IP+端口。

---

## 上线部署

### 服务器信息

| 项目 | 值 |
|------|-----|
| IP | 101.201.56.200 |
| 用户 | root |
| 端口 | 8100 |
| 项目目录 | /opt/devtools |
| 认证方式 | SSH Key (`~/.ssh/id_ed25519`) |

### 上线步骤（完整流程）

```bash
# ===== 第 1 步：构建验证（本地） =====
npm run build        # 确保零报错

# ===== 第 2 步：修改站点配置 =====
# 编辑 public/site.config.json，确保 siteUrl 正确
# 例：{ "siteUrl": "http://101.201.56.200:8100" }

# ===== 第 3 步：上传代码到服务器 =====
scp -r src/ public/ index.html package.json package-lock.json tsconfig*.json vite.config.ts Dockerfile nginx.conf docker-compose.yml .dockerignore root@101.201.56.200:/opt/devtools/

# ===== 第 4 步：SSH 登录服务器构建并重启 =====
ssh root@101.201.56.200

cd /opt/devtools
docker compose down
docker compose up -d --build

# 验证服务正常
curl -s -o /dev/null -w "%{http_code}" http://localhost:8100
# 应返回 200

exit

# ===== 第 5 步：浏览器验证 =====
# 打开 http://101.201.56.200:8100 确认各项功能正常
```

### 一键上线命令（代码无变更时仅重启）

```bash
ssh root@101.201.56.200 "cd /opt/devtools && docker compose down && docker compose up -d --build"
```

### 常用维护命令

```bash
# 查看容器状态
ssh root@101.201.56.200 "docker compose -f /opt/devtools/docker-compose.yml ps"

# 查看实时日志
ssh root@101.201.56.200 "docker compose -f /opt/devtools/docker-compose.yml logs -f"

# 查看最近 50 行日志
ssh root@101.201.56.200 "docker compose -f /opt/devtools/docker-compose.yml logs --tail 50"

# 重启容器
ssh root@101.201.56.200 "docker compose -f /opt/devtools/docker-compose.yml restart"

# 停止容器
ssh root@101.201.56.200 "docker compose -f /opt/devtools/docker-compose.yml down"

# 进入容器 shell
ssh root@101.201.56.200 "docker exec -it devtools sh"
```

### 上线检查清单

上线前逐项确认：

- [ ] `npm run build` 通过，零 error
- [ ] `public/site.config.json` 中 `siteUrl` 为实际访问地址
- [ ] 新工具已在 `src/data/tools.tsx` 注册
- [ ] 新路由已在 `src/App.tsx` 添加
- [ ] 阿里云安全组已放行 8100 端口（TCP / 0.0.0.0/0）
- [ ] 部署后浏览器访问返回 200
- [ ] 手机扫码二维码可正常访问
- [ ] 首页搜索能找到新工具
- [ ] 新工具页 SEO title/description 正确

---

## 开发约定

| 约定 | 说明 |
|------|------|
| **组件导出** | 默认导出函数组件 `export default function ToolName()` |
| **UI 组件** | 统一使用 antd 组件，不引入其他 UI 库 |
| **样式** | 使用 inline style，不引入 CSS Modules |
| **消息提示** | 使用 `message.success()` / `message.error()` / `message.warning()` |
| **复制功能** | 统一用 `navigator.clipboard.writeText()` |
| **文件上传** | 使用 `<Upload.Dragger>` 支持点击和拖拽双模式 |
| **无注释** | 代码保持简洁，不写注释，靠命名自解释 |
| **导入顺序** | React → antd → icons → 本地模块 |
| **TypeScript** | 严禁 `any`，所有类型显式声明 |

---

## 分类规划

| 分类 | 当前工具数 | 适合添加的工具类型 |
|------|-----------|------------------|
| 编码转换 | 8 | encode/decode、格式化、进制类 |
| 二维码/条码 | 3 | 各种码制生成/解码 |
| 文本处理 | 5 | 字符串分析、转换、提取 |
| 图片工具 | 5 | 图片编辑、转换、压缩 |
| 生成工具 | 2 | 随机生成、序列生成 |
| 计算工具 | 5 | 各种计算器、换算器 |

---

## 缓存策略

| 资源类型 | 缓存时间 |
|----------|----------|
| site.config.json | 不缓存（每次更新可热生效） |
| JS/CSS/图片/字体 | 1 年（文件名含 hash，更新自动失效） |
| HTML 入口 | 不缓存（确保路由正常工作） |

---

## 浏览器兼容

- Chrome 80+
- Edge 80+
- Firefox 80+
- Safari 14+

移动端响应式布局已适配，顶部导航在 768px 以下自动隐藏。

---

## 开发路线图

基于 tool.lu、sojson.com、bejson.com 等主流工具站筛选的热门工具，按优先级排列。

### P0 - 高频刚需（下次优先开发）

| 工具 | 分类 | 说明 | 实现难度 |
|------|------|------|----------|
| **HTML/JS/CSS 格式化** | 文本处理 | 代码美化、压缩，仿 sojson 的多语言格式化 | ⭐ 低 |
| **JWT 解析器** | 编码转换 | 解析 JWT token 的 Header/Payload，验证签名 | ⭐ 低 |
| **IP 归属地查询** | 网络工具 | 查询当前 IP 或任意 IP 的归属地 | ⭐⭐ 中 |
| **UserAgent 解析** | 网络工具 | 解析浏览器 UA 信息（系统/浏览器/引擎） | ⭐ 低 |
| **Cron 表达式生成器** | 生成工具 | 可视化生成 + 校验 Cron 定时任务表达式 | ⭐⭐ 中 |
| **二维码美化** | 二维码/条码 | 加 Logo、变色、圆角、渐变风格二维码 | ⭐⭐ 中 |
| **SQL 格式化** | 文本处理 | SQL 语句美化、压缩 | ⭐ 低 |
| **手机号归属地** | 生活查询 | 查询手机号运营商/省份/城市 | ⭐⭐⭐ 高 |
| **公历农历互转** | 计算工具 | 万年历/阴历阳历互转/节气查询 | ⭐⭐⭐ 高 |

### P1 - 热门工具

| 工具 | 分类 | 说明 | 实现难度 |
|------|------|------|----------|
| **车贷计算器** | 计算工具 | 等额本息/等额本金，与房贷配套 | ⭐ 低 |
| **油耗计算器** | 计算工具 | 百公里油耗/油费计算 | ⭐ 低 |
| **BMI 计算器** | 计算工具 | 身体质量指数 + 健康建议 | ⭐ 低 |
| **图片加水印** | 图片工具 | 文字/图片水印，位置/透明度可调 | ⭐⭐ 中 |
| **图片取色器** | 图片工具 | 点击图片任意位置提取颜色值 | ⭐⭐ 中 |
| **图片 EXIF 查看** | 图片工具 | 读取照片拍摄参数（相机/焦距/时间） | ⭐⭐ 中 |
| **GIF 提取** | 图片工具 | 提取 GIF 的每一帧为单独图片 | ⭐⭐ 中 |
| **代码差异对比** | 文本处理 | 增强版文本对比，支持代码高亮 | ⭐⭐ 中 |
| **随机抽奖工具** | 娱乐工具 | 名单随机抽取，支持动画效果 | ⭐ 低 |
| **反应速度测试** | 娱乐工具 | 点击变色测试反应时间 | ⭐ 低 |
| **Morse 密码** | 编码转换 | 文本与摩斯密码互转 | ⭐ 低 |

### P2 - 有需求但非紧急

| 工具 | 分类 | 说明 | 实现难度 |
|------|------|------|----------|
| **在线秒表/倒计时** | 时间工具 | 高精度计时器，支持计次 | ⭐ 低 |
| **键盘按键测试** | 娱乐工具 | 检测键盘每个按键是否正常 | ⭐ 低 |
| **Markdown 编辑器** | 文本处理 | 实时预览 Markdown 渲染效果 | ⭐⭐ 中 |
| **文字竖排工具** | 文本处理 | 横排转竖排（古文风格） | ⭐ 低 |
| **全角半角转换** | 编码转换 | 全角/半角字符互转 | ⭐ 低 |
| **罗马数字转换** | 编码转换 | 阿拉伯数字 ↔ 罗马数字 | ⭐ 低 |
| **变量命名转换** | 文本处理 | camelCase/snake_case/kebab/Pascal 互转 | ⭐ 低 |
| **emoji 大全** | 生活工具 | 搜索和复制各种 Emoji 表情 | ⭐ 低 |
| **十二生肖/星座查询** | 生活工具 | 年份/日期查生肖星座 | ⭐ 低 |
| **手持弹幕** | 娱乐工具 | LED 滚动文字屏，演唱会应援 | ⭐ 低 |

### 分类扩展计划

当前 6 个分类，后续可扩展：

| 新分类 | 对应工具 | 说明 |
|--------|----------|------|
| **网络工具** | IP查询、UA解析、端口扫描 | 面向开发者/站长 |
| **生活计算** | BMI、车贷、油耗、汇率 | 大众日常计算 |
| **娱乐工具** | 抽奖、反应测试、弹幕、键盘测试 | 轻量互动 |
| **时间工具** | 秒表、倒计时、公历农历、时区转换 | 时间相关汇总 |

### 工具总数趋势

```
当前         28 个（6 个分类）
+ P0          37 个
+ P1          48 个
+ P2          58 个（8 个分类）
```
