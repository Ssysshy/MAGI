# 前端项目方案

## 项目定位

面向 AI 动画创作场景的前端工作台，核心由 `项目列表页` 与 `创作工作台页` 两部分组成。

产品目标：

- 承载项目管理、搜索、收藏、创建
- 承载多代理创作流程展示
- 承载角色、场景、剧本、总览等资产协作
- 承载画布化编辑与资产沉淀

---

## 技术栈

- `React 18`
- `Vite 5`
- `tldraw`
- `lucide-react`
- `less`
- `shadcn/ui`

---

## 页面结构

### 1. 项目列表页

页面目标：

- 展示全部项目
- 支持搜索、筛选、收藏
- 支持新建项目

页面组成：

- 顶部全局栏
- 一级导航
- 二级导航
- 页面标题区
- 筛选区
- 吸顶筛选区
- 项目卡片区

核心模块：

- `GlobalHeader`
- `PrimaryNav`
- `SecondaryNav`
- `ProjectPageHeader`
- `ProjectFilterTabs`
- `ProjectSearch`
- `ProjectGrid`
- `ProjectCard`
- `NewProjectCard`

### 2. 创作工作台页

页面目标：

- 展示创作任务全过程
- 展示多角色 Agent 协同结果
- 展示剧本、角色、场景等资产
- 提供画布化查看与后续编辑能力

页面组成：

- 左侧工作区导航
- 中间消息流
- 右侧画布区
- 头部项目操作区
- 资产操作区
- 子导航工具条

核心模块：

- `WorkspaceSidebar`
- `WorkspaceHeader`
- `WorkspaceContent`
- `ChatMessageList`
- `UserAssetCard`
- `PlanRunnerCard`
- `TaskRunnerCard`
- `AssetCard`
- `CanvasToolbar`
- `CanvasPanel`

---

## 信息架构

### 顶层路由

```txt
/
/home
/project
/project/:projectId
/space/:spaceId
/asset
/trash
```

### 页面职责

- `/project`：项目管理中心
- `/space/:spaceId`：创作工作台
- `/asset`：资产中心
- `/trash`：回收站

---

## 组件拆分

### 通用层

- `AppShell`
- `PageContainer`
- `SectionHeader`
- `StatusBadge`
- `SearchInput`
- `EmptyState`
- `StickyBar`

### 导航层

- `GlobalHeader`
- `LanguageSwitcher`
- `CreditButton`
- `PrimaryNav`
- `SecondaryNav`
- `WorkspaceSidebar`
- `CanvasToolbar`

### 项目层

- `ProjectFilterTabs`
- `ProjectGrid`
- `ProjectCard`
- `ProjectCardCover`
- `ProjectCardFavorite`
- `NewProjectCard`

### 工作台层

- `WorkspaceHeader`
- `ChatMessageList`
- `MessageSection`
- `DocAssetCard`
- `PlanRunnerCard`
- `TaskRunnerCard`
- `AgentRoleTag`
- `AssetPreviewCard`
- `BoardTabs`
- `BoardAssetPanel`

---

## 布局方案

### 1. 全局布局

```txt
AppShell
├─ GlobalHeader
├─ PrimaryNav
├─ SecondaryNav
└─ PageContent
```

特点：

- 顶部统一承载品牌、语言、教程、资产入口、额度入口
- 主导航承载首页、项目、资产等一级入口
- 次导航承载附加入口，如回收站

### 2. 项目页布局

```txt
ProjectPage
├─ ProjectPageHeader
├─ FilterBar
│  ├─ ProjectFilterTabs
│  └─ ProjectSearch
├─ StickyFilterBar
└─ ProjectGrid
```

特点：

- 单列内容布局
- 顶部筛选与搜索并列
- 吸顶筛选栏与普通筛选栏双态复用
- 卡片流展示项目

### 3. 工作台布局

```txt
WorkspacePage
├─ WorkspaceSidebar
├─ WorkspaceMain
│  ├─ WorkspaceHeader
│  └─ ChatMessageList
└─ WorkspaceBoard
   ├─ CanvasToolbar
   └─ CanvasPanel
```

特点：

- 三栏结构
- 左窄中宽右宽
- 中间为任务流
- 右侧为 `tldraw` 画布与资产视图

---

## 核心交互

### 项目列表页

- Tab 切换：全部 / 我的收藏
- 搜索项目名称
- 新建项目
- 收藏项目
- 点击卡片进入工作台

### 工作台页

- 消息流查看创作进度
- 展开 / 折叠任务卡片
- 查看文档、角色、场景资产
- 画布切换：总览 / 剧本 / 角色 / 场景
- 将资产加入资产库

---

## 视觉与样式方案

### 样式分层

- `styles/tokens.less`：颜色、间距、圆角、阴影、层级
- `styles/mixins.less`：布局与状态混入
- `styles/reset.less`：基础重置
- `styles/global.less`：全局样式

### 视觉原则

- 工作台风格优先，弱营销感
- 卡片边界清晰，层次分明
- 状态信息前置，按钮文案直接
- 中间消息流强调纵向节奏
- 右侧画布区域强调编辑感与沉浸感

### 组件风格

- `shadcn/ui` 负责基础交互组件
- `less` 负责页面级结构样式与主题覆盖
- `lucide-react` 统一图标风格

---

## 状态管理建议

采用轻量方案，按页面拆分：

- React `useState`
- React `useReducer`
- React Context

状态边界：

- 全局状态：语言、主题、导航高亮、用户额度
- 项目页状态：筛选、搜索词、收藏态、列表数据
- 工作台状态：当前会话、消息流、选中资产、画布标签、右侧面板状态

---

## 数据模型

### Project

```ts
type Project = {
  id: string;
  name: string;
  coverUrls: string[];
  isFavorite: boolean;
  updatedAt: string;
};
```

### WorkspaceMessage

```ts
type WorkspaceMessage = {
  id: string;
  type: 'user-asset' | 'plan' | 'task' | 'agent-note';
  roleName?: string;
  title?: string;
  content: string;
  status?: 'pending' | 'running' | 'done' | 'error';
  createdAt: string;
};
```

### WorkspaceAsset

```ts
type WorkspaceAsset = {
  id: string;
  type: 'script' | 'role' | 'scene' | 'image';
  name: string;
  description?: string;
  previewUrl?: string;
};
```

---

## 目录方案

```txt
src/
├─ app/
│  ├─ router/
│  └─ providers/
├─ pages/
│  ├─ project/
│  └─ workspace/
├─ components/
│  ├─ shell/
│  ├─ nav/
│  ├─ project/
│  ├─ workspace/
│  └─ ui/
├─ features/
│  ├─ project-list/
│  └─ workspace-flow/
├─ hooks/
├─ services/
├─ types/
├─ utils/
├─ styles/
└─ lib/
```

拆分原则：

- 页面组件与业务组件分离
- 项目页与工作台页分目录
- `shadcn/ui` 放 `components/ui`
- 页面级样式与业务组件样式分开

---

## 第一期范围

### 必做

- 项目列表页
- 项目卡片
- 搜索与筛选
- 工作台三栏布局
- 消息流卡片体系
- `tldraw` 画布嵌入
- 总览 / 剧本 / 角色 / 场景切换

### 暂不做

- 真实后端联调
- 登录权限
- 多人实时协作
- 复杂拖拽编排
- 完整资产编辑器

---

## 开发顺序

1. 初始化 `React 18 + Vite 5`
2. 接入 `less`
3. 接入 `shadcn/ui`
4. 接入 `lucide-react`
5. 搭建全局 `AppShell`
6. 完成项目列表页
7. 完成工作台基础三栏布局
8. 完成消息流卡片体系
9. 接入 `tldraw`
10. 完成画布标签与资产面板

---

## 结果要求

- 页面结构与已采集页面一致
- 组件边界清晰
- 样式可扩展
- 后续可直接进入实现阶段
