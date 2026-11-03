import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Row, Col, Typography, Tag, Divider, Input, message } from "antd";
import {
  SearchOutlined,
  StarOutlined,
  StarFilled,
  CloseOutlined,
} from "@ant-design/icons";
import { toolGroups, allTools, renderIcon } from "../data/tools";
import type { ToolItem } from "../data/tools";

const STORAGE_KEY = "devtools-favorites";

function loadFavorites(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveFavorites(paths: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
}

interface DragState {
  type: "favorite" | "tool";
  sourceIndex?: number;
  path: string;
}

function matchSearch(text: string, keyword: string): boolean {
  const lower = keyword.toLowerCase();
  return text.toLowerCase().includes(lower);
}

export default function Home() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const [searchText, setSearchText] = useState("");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOverFavIndex, setDragOverFavIndex] = useState<number | null>(null);

  const favoriteTools: ToolItem[] = favorites
    .map((p) => allTools.find((t) => t.path === p))
    .filter((t): t is ToolItem => !!t);

  const isFavorited = useCallback(
    (path: string) => favorites.includes(path),
    [favorites]
  );

  const addFavorite = useCallback(
    (path: string) => {
      if (favorites.includes(path)) return;
      const next = [...favorites, path];
      setFavorites(next);
      saveFavorites(next);
      message.success("已添加到常用工具");
    },
    [favorites]
  );

  const removeFavorite = useCallback(
    (path: string) => {
      const next = favorites.filter((p) => p !== path);
      setFavorites(next);
      saveFavorites(next);
    },
    [favorites]
  );

  const reorderFavorites = useCallback(
    (fromIndex: number, toIndex: number) => {
      const next = [...favorites];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      setFavorites(next);
      saveFavorites(next);
    },
    [favorites]
  );

  const handleToolDragStart = (path: string) => {
    setDragState({ type: "tool", path });
  };

  const handleFavDragStart = (index: number, path: string) => {
    setDragState({ type: "favorite", sourceIndex: index, path });
  };

  const handleFavDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragState?.type === "favorite") {
      setDragOverFavIndex(index);
    }
  };

  const handleFavDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFavIndex(null);

    if (!dragState) return;

    if (dragState.type === "tool") {
      addFavorite(dragState.path);
    } else if (
      dragState.type === "favorite" &&
      dragState.sourceIndex !== undefined
    ) {
      const targetIndex = dragOverFavIndex ?? favorites.length - 1;
      if (targetIndex !== dragState.sourceIndex) {
        reorderFavorites(dragState.sourceIndex, targetIndex);
      }
    }
    setDragState(null);
  };

  const handleFavAreaDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFavAreaDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragState?.type === "tool") {
      addFavorite(dragState.path);
    }
    setDragState(null);
    setDragOverFavIndex(null);
  };

  const filteredGroups = searchText.trim()
    ? toolGroups
        .map((group) => ({
          ...group,
          tools: group.tools.filter(
            (t) =>
              matchSearch(t.title, searchText.trim()) ||
              matchSearch(t.desc, searchText.trim())
          ),
        }))
        .filter((g) => g.tools.length > 0)
    : toolGroups;

  const hasResults = filteredGroups.some((g) => g.tools.length > 0);

  useEffect(() => {
    saveFavorites(favorites);
  }, [favorites]);

  return (
    <div>
      {/* Hero area */}
      <div style={{ textAlign: "center", marginBottom: 40, paddingTop: 16 }}>
          <Typography.Title level={2} style={{ marginBottom: 8, fontWeight: 700 }}>
          开发者在线工具集
        </Typography.Title>
        <Typography.Paragraph
          type="secondary"
          style={{ fontSize: 16, maxWidth: 560, margin: "0 auto 24px" }}
        >
          打开即用，用完即走 &mdash; 无需注册登录，所有数据本地处理绝不<br/>上传服务器，觉得好用记得
          <span style={{ color: "#faad14" }}>收藏书签</span>
          。
        </Typography.Paragraph>
        <Input
          size="large"
          prefix={<SearchOutlined style={{ color: "#bbb" }} />}
          placeholder="搜索工具..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ maxWidth: 480, borderRadius: 10 }}
        />
      </div>

      {/* Favorites section */}
      <div
        style={{
          marginBottom: 32,
          padding: 20,
          background: "#fff",
          borderRadius: 12,
          border: "2px dashed #e8e8e8",
          minHeight: favorites.length > 0 ? undefined : 80,
          transition: "border-color 0.3s",
        }}
        onDragOver={handleFavAreaDragOver}
        onDrop={handleFavAreaDrop}
        onDragLeave={() => setDragOverFavIndex(null)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: favoriteTools.length > 0 ? 16 : 0 }}>
          <StarFilled style={{ color: "#faad14", fontSize: 18 }} />
          <Typography.Text strong style={{ fontSize: 15 }}>
            常用工具
          </Typography.Text>
          {favoriteTools.length > 0 && (
            <Tag color="gold">{favoriteTools.length}</Tag>
          )}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            拖拽卡片收藏，长按拖动排序
          </Typography.Text>
        </div>

        {favoriteTools.length > 0 ? (
          <Row gutter={[12, 12]}>
            {favoriteTools.map((tool, index) => (
              <Col xs={12} sm={8} md={6} lg={4} key={tool.path}>
                <div
                  draggable
                  onDragStart={() => handleFavDragStart(index, tool.path)}
                  onDragOver={(e) => handleFavDragOver(e, index)}
                  onDrop={handleFavDrop}
                  style={{
                    cursor: "grab",
                    opacity: dragOverFavIndex === index ? 0.5 : 1,
                    transition: "opacity 0.2s",
                    position: "relative",
                  }}
                >
                  <Card
                    size="small"
                    hoverable
                    onClick={() => navigate(tool.path)}
                    style={{
                      borderRadius: 8,
                      border:
                        dragState?.type === "favorite" && dragOverFavIndex === index
                          ? "2px solid #1677ff"
                          : undefined,
                    }}
                  >
                    <CloseOutlined
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        fontSize: 12,
                        color: "#ccc",
                        zIndex: 1,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFavorite(tool.path);
                      }}
                    />
                    <div style={{ textAlign: "center" }}>
                      <div style={{ color: "#1677ff", marginBottom: 4 }}>
                        {renderIcon(tool.Icon, 24)}
                      </div>
                      <Typography.Text strong style={{ fontSize: 13 }}>
                        {tool.title}
                      </Typography.Text>
                    </div>
                  </Card>
                </div>
              </Col>
            ))}
          </Row>
        ) : (
          <Typography.Text
            type="secondary"
            style={{
              display: "block",
              textAlign: "center",
              lineHeight: "40px",
              fontSize: 13,
            }}
          >
            点击下方工具旁的 <StarOutlined /> 图标添加常用工具，或拖拽卡片到此处
          </Typography.Text>
        )}
      </div>

      {/* Tool categories */}
      {!hasResults && (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Typography.Text type="secondary" style={{ fontSize: 16 }}>
            未找到匹配的工具
          </Typography.Text>
        </div>
      )}

      {filteredGroups.map((group) => (
        <div key={group.name} style={{ marginBottom: 32 }}>
          <Divider orientation="left" style={{ marginTop: 0 }}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              {group.name}
            </Typography.Title>
            <Tag style={{ marginLeft: 8 }}>{group.tools.length} 个</Tag>
          </Divider>
          <Row gutter={[16, 16]} align="stretch">
            {group.tools.map((tool) => (
              <Col xs={12} sm={8} md={6} lg={6} key={tool.path} style={{ display: "flex" }}>
                <div draggable onDragStart={() => handleToolDragStart(tool.path)} style={{ width: "100%" }}>
                  <Card
                    hoverable
                    onClick={() => navigate(tool.path)}
                    style={{ height: "100%", borderRadius: 8, minHeight: 170 }}
                    actions={[
                      isFavorited(tool.path) ? (
                        <StarFilled
                          key="fav"
                          style={{ color: "#faad14" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFavorite(tool.path);
                          }}
                        />
                      ) : (
                        <StarOutlined
                          key="fav"
                          style={{ color: "#999" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            addFavorite(tool.path);
                          }}
                        />
                      ),
                    ]}
                  >
                    <div style={{ textAlign: "center", color: "#1677ff" }}>
                      {renderIcon(tool.Icon, 32)}
                    </div>
                    <Card.Meta
                      title={tool.title}
                      description={<span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>{tool.desc}</span>}
                      style={{ textAlign: "center", marginTop: 8 }}
                    />
                  </Card>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      ))}
    </div>
  );
}
