import { useState, useCallback } from "react";
import {
  Card,
  Input,
  Space,
  Typography,
  Row,
  Col,
  ColorPicker,
  Divider,
} from "antd";
import type { Color } from "antd/es/color-picker";

interface ColorValues {
  hex: string;
  rgb: string;
  hsl: string;
  hsv: string;
}

function rgbToHsl(
  r: number,
  g: number,
  b: number
): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, Math.round(l * 100)];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    case b:
      h = ((r - g) / d + 4) / 6;
      break;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function rgbToHsv(
  r: number,
  g: number,
  b: number
): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;

  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(v * 100)];
}

function parseHex(hex: string): [number, number, number] | null {
  const match = hex.match(/^#?([a-fA-F0-9]{3,8})$/)?.[1];
  if (!match) return null;
  let r: number, g: number, b: number;
  if (match.length === 3) {
    r = parseInt(match[0] + match[0], 16);
    g = parseInt(match[1] + match[1], 16);
    b = parseInt(match[2] + match[2], 16);
  } else if (match.length >= 6) {
    r = parseInt(match.slice(0, 2), 16);
    g = parseInt(match.slice(2, 4), 16);
    b = parseInt(match.slice(4, 6), 16);
  } else {
    return null;
  }
  return [r, g, b];
}

function parseRgb(rgb: string): [number, number, number] | null {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function computeAll(r: number, g: number, b: number): ColorValues {
  const [h, s, l] = rgbToHsl(r, g, b);
  const [hv, sv, v] = rgbToHsv(r, g, b);
  const hex =
    "#" +
    r.toString(16).padStart(2, "0") +
    g.toString(16).padStart(2, "0") +
    b.toString(16).padStart(2, "0");
  return {
    hex: hex.toUpperCase(),
    rgb: `rgb(${r}, ${g}, ${b})`,
    hsl: `hsl(${h}, ${s}%, ${l}%)`,
    hsv: `hsv(${hv}, ${sv}%, ${v}%)`,
  };
}

export default function ColorConvert() {
  const [colors, setColors] = useState<ColorValues>({
    hex: "#1677FF",
    rgb: "rgb(22, 119, 255)",
    hsl: "hsl(215, 100%, 54%)",
    hsv: "hsv(215, 91%, 100%)",
  });
  const [currentColor, setCurrentColor] = useState("#1677ff");

  const handlePickerChange = (_: Color, hex: string) => {
    setCurrentColor(hex);
    const rgb = parseHex(hex);
    if (rgb) setColors(computeAll(rgb[0], rgb[1], rgb[2]));
  };

  const handleHexInput = useCallback((value: string) => {
    const rgb = parseHex(value);
    if (rgb) {
      setCurrentColor("#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join(""));
      setColors(computeAll(rgb[0], rgb[1], rgb[2]));
    }
  }, []);

  const handleRgbInput = useCallback((value: string) => {
    const rgb = parseRgb(value);
    if (rgb) {
      setColors(computeAll(rgb[0], rgb[1], rgb[2]));
    }
  }, []);

  return (
    <Card title="颜色格式转换">
      <Row gutter={24}>
        <Col xs={24} md={12}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <div>
              <Typography.Text strong>颜色选择器</Typography.Text>
              <div style={{ marginTop: 8 }}>
                <ColorPicker
                  value={currentColor}
                  onChange={handlePickerChange}
                  showText
                  size="large"
                />
              </div>
            </div>
            <div
              style={{
                width: "100%",
                height: 120,
                borderRadius: 8,
                backgroundColor: colors.hex,
                border: "1px solid #d9d9d9",
              }}
            />
          </Space>
        </Col>
        <Col xs={24} md={12}>
          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            <div>
              <Typography.Text strong>HEX</Typography.Text>
              <Input
                value={colors.hex}
                onChange={(e) => handleHexInput(e.target.value)}
                style={{ fontFamily: "monospace" }}
                allowClear
              />
            </div>
            <Divider style={{ margin: "8px 0" }} />
            <div>
              <Typography.Text strong>RGB</Typography.Text>
              <Input
                value={colors.rgb}
                onChange={(e) => handleRgbInput(e.target.value)}
                style={{ fontFamily: "monospace" }}
                allowClear
              />
            </div>
            <Divider style={{ margin: "8px 0" }} />
            <div>
              <Typography.Text strong>HSL</Typography.Text>
              <Input
                readOnly
                value={colors.hsl}
                style={{ fontFamily: "monospace", background: "#f5f5f5" }}
              />
            </div>
            <Divider style={{ margin: "8px 0" }} />
            <div>
              <Typography.Text strong>HSV</Typography.Text>
              <Input
                readOnly
                value={colors.hsv}
                style={{ fontFamily: "monospace", background: "#f5f5f5" }}
              />
            </div>
          </Space>
        </Col>
      </Row>
    </Card>
  );
}
