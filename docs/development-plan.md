# 纸短情长：实际开发规划

## 0. 开发目标

先做一个能上线内测的 Web App，而不是一开始做完整邮政宇宙。

第一阶段目标：

> 用户可以写一封有限字数的信，通过邀请链接让对方注册认领；双方建立通信关系；后续可以从通信簿继续寄信；信件根据城市/邮局距离延迟送达，并在送达后打开查看信纸、邮戳和内容。

## 1. 技术栈建议

### 前端 / 全栈框架

推荐：Next.js + TypeScript

原因：

- Web App 快速开发。
- 后续可做 PWA。
- 适合页面、API、服务端渲染一起管理。
- 部署到 Vercel / Cloudflare / 自己 VPS 都方便。

### UI

推荐：Tailwind CSS + shadcn/ui

原因：

- 快速搭界面。
- 组件质量高。
- 后续方便定制复古信纸、邮局、地图卡片。

### 数据库

推荐：PostgreSQL

本地开发：Docker Compose 起 Postgres。

线上：Supabase / Neon / 自建 Postgres 都可以。

### ORM

推荐：Prisma 或 Drizzle。

如果追求开发效率，先用 Prisma。

### 登录认证

推荐：Auth.js / NextAuth。

MVP 登录方式：

- 邮箱 magic link，或
- GitHub/Google 登录，或
- 微信登录后面再接。

国内用户体验上，最终应该支持微信登录，但 MVP 可以先用邮箱登录跑通。

### 地图

MVP 可选两种：

- 国内优先：高德地图 JS API
- 国际优先：Mapbox / MapLibre

如果先做产品原型，推荐先用 MapLibre + 固定城市坐标，不急着接复杂地图服务。

### 定时任务 / 信件配送

MVP 不需要真的跑物流系统。

可以用：

- 数据库字段 `delivered_at`
- 每次用户打开 App 时检查是否有应送达信件
- 后续再加 cron / queue

第二阶段再引入：

- BullMQ / Redis Queue
- pg_cron
- Vercel Cron

## 2. MVP 功能范围

### 必须做

#### 账号系统

- 用户注册/登录
- 用户资料：昵称、头像、常驻城市、默认邮局

#### 写信

- 新建信件
- 字数限制
- 实时信纸预览
- 草稿保存可选，第一版可以先不做

#### 首次邀请

- 写给一个新的人
- 生成邀请链接
- 对方打开链接注册/登录
- 对方认领信件
- 双方建立通信关系

#### 通信簿

- 已通邮的人列表
- 从通信簿选择收件人
- 后续直接寄信

#### 邮局与地图

- 城市列表
- 每个城市一个默认邮局
- 地图上显示寄件地、收件地、运输状态

#### 配送状态

- draft 草稿
- pending_invite 等待认领
- posted 已投递
- in_transit 运输中
- delivered 已送达
- opened 已打开

#### 收信

- 收件箱
- 信件送达后可打开
- 展示信纸、正文、寄件地、收件地、邮戳、时间

### 暂不做

这些先别碰，容易拖慢：

- 漂流瓶
- 陌生人笔友匹配
- 真实 GPS 强定位
- 实体打印寄送
- 复杂邮票商城
- 多语言国际邮政系统
- 微信登录/小程序
- AI 写信辅助

## 3. 页面结构

### 公共页面

- `/` 首页 / 产品介绍
- `/login` 登录
- `/invite/[token]` 收信邀请页

### 登录后页面

- `/app` 仪表盘
- `/app/write` 写信
- `/app/inbox` 收件箱
- `/app/outbox` 寄件箱
- `/app/letters/[id]` 信件详情
- `/app/contacts` 通信簿
- `/app/map` 邮政地图
- `/app/settings` 设置默认城市/邮局

## 4. 数据模型草案

### User

- id
- publicId（公开唯一短码；可选支持自定义）
- email
- name
- avatarUrl
- defaultCityId
- defaultPostOfficeId
- createdAt
- updatedAt

### City

- id
- name
- country
- latitude
- longitude

### PostOffice

- id
- cityId
- name
- latitude
- longitude

### Relationship

- id
- userAId
- userBId
- status: pending_invite / connected / blocked / archived
- createdFromInvitationId
- createdAt

### Letter

- id
- senderId
- recipientId nullable
- invitationId nullable
- senderPostOfficeId
- recipientPostOfficeId nullable
- recipientHintName
- content
- status: draft / pending_invite / posted / in_transit / delivered / opened
- wordCount
- sentAt
- deliveredAt
- openedAt
- createdAt

### Invitation

- id
- token
- inviterId
- letterId
- recipientHintName
- passphraseHash nullable
- expiresAt nullable
- status: pending / claimed / expired / rejected
- claimedByUserId
- createdAt
- claimedAt

## 5. 开发阶段安排

### Phase 0：项目骨架

目标：能跑起来。

任务：

- 初始化 Next.js + TypeScript
- 接 Tailwind + shadcn/ui
- 接 PostgreSQL + Prisma
- 配置 ESLint / Prettier
- Docker Compose 本地数据库
- 基础 README 和 env 示例

验收：

- `npm run dev` 能启动
- `npm run lint` 通过
- 数据库 migrate 成功

### Phase 1：账号与基础资料

目标：用户能注册、登录、设置城市。

任务：

- Auth.js 登录
- User 表
- City / PostOffice 种子数据
- 设置默认城市和邮局

验收：

- 新用户登录后能进入 `/app`
- 能设置默认收信邮局

### Phase 2：写信体验

目标：写信这件事先有感觉。

任务：

- `/app/write`
- 字数限制
- 实时信纸预览
- 选择“写给新的人 / 写给通信簿的人”
- 信纸 UI 初版

验收：

- 能写一封信
- 超字数不能提交
- 预览实时更新

### Phase 3：用户 ID + 邀请认领闭环（下一阶段 · Neil 已确认）

目标：公开用户 ID 可用；给未注册的人也能靠邀请链接完成收信冷启动。

任务：

- 注册时分配唯一 `publicId`（可选后续自定义短码）
- 写信给熟人：按公开 ID 或通信簿选择收件人
- 写信给新人：生成一次性 invitation token（可过期、可选口令）
- `/invite/[token]`：可先展示「有人给你写信」，再注册/登录并认领
- 认领后分配/沿用 ID，创建 Relationship，写入通信簿
- 设置信件 recipientId 与收件邮局

验收：

- 新用户注册后可见并复制自己的公开 ID
- A 用 B 的 ID 寄信成功（双方已 connected）
- A 给未注册的人生成邀请链接；B 打开 → 注册 → 认领 → 获得 ID → 双方进通信簿
- 过期或已用链接不可再次认领；可选口令校验失败不可读信
- 无广场搜人 / 无按手机号邮箱搜用户入口

### Phase 4：寄信与配送状态

目标：信真的会“在路上”。

任务：

- 寄出时锁定双方邮局
- 根据两地距离计算 deliveredAt
- 信件状态流转
- 收件箱 / 寄件箱
- 打开 App 时刷新已送达信件状态

验收：

- 信件寄出后不会立刻可读
- 到达时间后收件人能打开
- 打开后状态变为 opened

### Phase 5：地图与邮戳

目标：产品气质出来。

任务：

- 地图显示邮局点位
- 信件详情展示路径
- 邮戳组件
- 信封/信纸视觉优化

验收：

- 用户能看到信从哪里寄到哪里
- 打开信时有邮戳和仪式感

### Phase 6：内测上线

目标：小范围给真实用户试。

任务：

- 部署数据库
- 部署 Web App
- 配置域名
- 错误监控
- 基础隐私政策/用户协议
- 种子用户测试

验收：

- 两个真实用户可以完成完整寄信流程
- 手机浏览器可用
- 基本错误可追踪

## 6. 推荐开发顺序

不要先做地图。

正确顺序：

1. 项目骨架
2. 数据模型
3. 登录
4. 写信 UI
5. 邀请认领
6. 通信簿
7. 配送时间
8. 收信打开
9. 地图
10. 邮戳与视觉

地图很吸引人，但它不是第一风险。第一风险是“写信-邀请-认领-再次通信”这个关系闭环能不能顺。

## 7. 第一周任务建议

### Day 1

- 初始化项目
- 选定技术栈
- 接 Tailwind / shadcn
- 建基础页面

### Day 2

- 接数据库
- 建 Prisma schema
- City / PostOffice seed

### Day 3

- 接登录
- 用户资料页
- 默认城市/邮局设置

### Day 4

- 写信页面
- 信纸实时预览
- 字数限制

### Day 5

- Invitation 模型
- 生成邀请链接
- 邀请页

### Day 6

- 认领信件
- 创建通信关系
- 通信簿

### Day 7

- 寄件箱/收件箱
- 简单配送延迟
- 完成第一条端到端流程

## 8. 当前最应该马上做的事

骨架与信笺模块已在仓内演进；**下一阶段开发重点是 Phase 3：用户 ID + 邀请认领闭环**（见上文验收标准）。

实施前先把 Prisma `User.publicId`、Invitation 过期/口令字段与 `/invite/[token]` 流程对齐本文与[收件人关系流程](recipient-relationship-flow.md)。
