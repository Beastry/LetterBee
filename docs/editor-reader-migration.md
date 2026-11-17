# 写信 / 读信代码迁移（本地待审阅）

## 范围与出处

- 源：`neardws/bday-gy-k7q4m`，只读 checkout `7771c20`（v39）。未改源仓库，也未导入源 `content.js`、信件 JSON、R2 数据、口令、个人媒体、字体/图片素材或账号凭据。
- 目标：LetterBee 独立 Next.js 应用；从 `b438d86` 新开 `feat/full-letter-experience`，保留部署适配提交 `83964a4` / `b438d86`。
- 不是 iframe、静态镜像或样例导入。真实入口为 `/letterbee/app/write`，真实收/寄信入口为 `/letterbee/app/letters/:id`。
- 已尝试既有 Codex/sub2api CLI；当前执行环境缺 `OPENAI_API_KEY`，因此按本次授权本地实现，没有读取其他 bot 的凭据。
- **未部署、未 push、未开 PR、未 merge；当前公网预览仍是原版本。**

## 源 → 目标 → 真实流程

| 源能力/代码                                                                                                  | 目标实现                                                                                                                    | 流程入口/接线                                                                        |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `editorPage.js` 正文、段落、日期、署名、表单/纸上编辑、撤销重做、专注/预览                                   | `rich/RichComposer.tsx` + `RichPaper.tsx`；HTML-free 类型模型、双击纸上正文就地编辑、段落工具与实时纸张排版                 | 写信 → 新建私有草稿 → 保存版本；不是全局 sample                                      |
| `journal.js` / `journalEditor.js` 的照片、语音、视频、贴纸、胶带、邮戳、票根、时间线、隐藏纸条、落款卡、题头 | `rich/model.ts` 的 11 类物件；React 属性面板、媒体替换、时间线增删/调整顺序、自己的透明贴纸/落款印章                        | 写信工具面板，保存在草稿及寄出快照                                                   |
| `journalLayout.js` 几何、CJK 禁则、旋转碰撞、锚点与环绕排版                                                  | **直接移植无 DOM/资产依赖的纯引擎** `rich/layout.js`；保留 wrap/break/over、段落/物件锚点、避让、旋转碰撞检测与循环锚点保护 | 编辑器和收信纸张共用同一布局引擎                                                     |
| `journalEditor.js` / `stickerEditor.js` 拖动/缩放/旋转/层级/键盘/双指                                        | React pointer-capture 手势、缩放/旋转手柄、Shift 15°、双指捏合旋转、层级、方向键/删除/Escape                                | 右侧实时纸张；左侧提供可键盘操作的同等数值控件                                       |
| `capture.js` 图片重编码/去 EXIF、相机、录音波形、暂停/重录/试听、WAV 转换                                    | **移植为 client 模块** `rich/capture.js`/CSS，改为私有附件接口；补充组件卸载时释放相机/麦克风                               | 上传、拖放、正文粘贴图片、拍照、录音、重新压缩图片；单文件8MB，单信40文件/32MB       |
| `hiddenPara.js` 三种安静线索与墨迹展开                                                                       | React 隐藏段状态；v39 的微点/压痕/墨水线索、源墨迹 keyframes、键盘按钮、reduced-motion                                      | 收信拆封 → 发现线索 → 展开；只是阅读彩蛋，**不是加密**                               |
| `musicEngine.js` Web Audio、双音轨 equal-power 交叉淡化、裁切/单曲音量、顺序/随机、duck、后台生命周期        | **直接移植音乐引擎** `rich/music.js` + `MusicPlayer.tsx`；20首列表、淡入/出/衔接、裁切、音量；补 dispose                    | 编辑配乐 → 收信预览试听 → 拆封手势解锁播放；音/视频播放压低背景音，暂停/结束恢复     |
| `yearStyle.js` 通用火漆/纸张/信封生成器                                                                      | **移植程序纹理、Canvas 火漆生成与白名单样式** `rich/appearance.js`；不复制静态纹理/字体，改用程序纹理及系统字体             | 封缄面板 → 真实信封、火漆分开、信纸色/纹理/字体/字号/行距/横线                       |
| `visitorPage.js` 拆信刀、火漆开封、展开信纸、逐字阅读、媒体/照片灯箱                                         | 复用/扩展 LetterBee `LetterExperience`；`RichReader` + `RichPaper`；照片前后浏览/Escape、原生可访问音视频控件               | 收件箱/寄件记录 → 授权信件 → 拆封 → 信纸、隐藏段和附件；“再写一封”不会修改已寄信     |
| 源定时开启/段落时间锁                                                                                        | 整封信、段落、物件展开日期；`visibleDocument` 服务端过滤                                                                    | 上海时区；未到期正文/媒体引用/音轨不会进入读信 props，附件接口也核对过滤后的可见引用 |
| 源单站单收信人数据与保存 API                                                                                 | **不迁其账号模型**；接入现有 MailUser/publicId/relationship/invitation/delivery                                             | 本人草稿 → 通信簿/精确 publicId 或一次性邀请 → 认领/拒收 → 真实读信                  |

原源编辑器实际是纯文字 `contentEditable`，粘贴去 HTML，并非任意 HTML 的粗体/斜体富文本。这里的“富编辑”指信纸排版、物件、媒体和阅读仪式；没有虚构源不存在的 HTML WYSIWYG 能力。React UI 做了适配，不声称像素级复刻。音视频阅读使用原生控件，录音面板保留源波形工具。

## 保存 / 寄出 / 邀请安全边界

- 新 API：`/api/mail-drafts`、`/:id`、`/:id/media`、`/:id/send`、`/api/mail-media/:id`，所有 raw fetch/media URL 经 `appPath()` 添加 `/letterbee`；Next Link/页面 redirect 继续由 basePath 处理；Server Action 的 HTTP 303 显式经 `appRedirect()` 处理。真实 HTTP 回归发现原生 Next 的表单303不会自行加前缀，已修复登录/设置/邀请/旧写信 actions；已核对 vinext 的重复前缀保护。
- 草稿带 ownerId / revision；冲突返回409，非本人404。**保存与寄出沿用同一 mail-store 更新事务**，寄出冻结 document、关联 letterId，重复寄出/编辑/新增附件均拒绝。云端 KV 不提供跨 isolate 事务，见下方限制。
- 沿用现有通信关系、公开号精确匹配、屏蔽、邀请口令、一次性认领、双方邮局快照与即时投递 MVP 行为。未擅自实现地理慢递；概念文档中的地图寄信/真实运输仍是后续阶段。
- 富信邀请认领前只显示元信息，完整信纸/媒体在认领后按账号授权打开。原纯文字信兼容原展示。收/寄记录可从 `/app` 进入。
- JSON 白名单、800字总正文/物件文字限制、Origin 校验、大小限制、MIME signature 检查；不接受外站/生日站 URL 或跨草稿媒体。附件必须是本草稿上传的对象。
- 附件每次读取核对本人草稿或已投递的收/寄身份及服务端时间锁；`private,no-store` / `nosniff`，支持音视频 byte range。未把用户文件放进 public/static。
- Cookie 继续使用已有签名会话，生产 path `/letterbee` + Secure/HttpOnly/SameSite=Lax；删除 path 不变。本次未触碰 secret、域名路由或账号权限。

## 独立媒体存储（没有开通资源）

- 本地：`data/mail-media/`（可用 `MAIL_MEDIA_DIR` 覆盖），文件0600、目录0700，已 gitignore；媒体元信息及草稿在原 `data/mail/mail.json`。
- 云端：`MAIL_STORAGE_DRIVER=kv` 时只接受可选绑定 **`LETTER_MEDIA`（R2Bucket）**；对象键 `v1/<随机UUID>`，不设公共 bucket URL、不需要浏览器 CORS/任何新凭据。
- **尚需 Neil 批准开通/绑定 LetterBee 自己的私有 R2 bucket（建议 `letterbee-media`）**。本次没有创建 bucket、修改 Worker/资源/路由；没有借生日站 bucket。当前 wrangler 配置不自动添加/开通 R2。
- 审阅批准后才可在源 `wrangler.jsonc` 添加 `r2_buckets: [{ binding: "LETTER_MEDIA", bucket_name: "letterbee-media" }]` 并 regenerate types/build/deploy。参考 https://developers.cloudflare.com/r2/api/workers/workers-api-usage/ 。
- 缺绑定会明确显示不可上传，服务端503且不写回 fs。文字、排版、程序贴纸/封缄仍可用；不能说当前云端完整媒体已经可用。

## 不迁项目 / 原因

- 真实信件、生日固定文案/年份默认内容、口令、私人媒体和 R2 数据：本次明确排除。
- 生日蛋糕、吹蜡烛、年龄/年份生日入口、生日天空/星座及其联动场景：生日专属，不适合通用邮件。
- 源全站管理员/访客口令及全局内容管理、年份集合：不替换 LetterBee 的账号/联系人/收件机制；改为本人草稿与已寄记录。
- 源内置贴纸/照片/纸纹素材库、个人封面、打包字体及第三方素材：不复制其内容或潜在授权负担；保留中性符号贴纸、私有自带图片与程序纹理。没有跨用户/跨草稿公共媒体库。
- 第三方音乐 iframe/链接解析：不引入额外追踪、跨域播放器和授权问题，保留独立上传配乐完整播放链。
- 未照搬整个字符串 HTML/全局 DOM 事件架构；交互转为 React，纯算法/采集/音乐/外观生成器保留源实现。没有把生日站嵌成 iframe。

## 验证与待验收

- 自动化：`pnpm test`（67 tests / 20 files）；包含真实 route handlers 的新建/上传/保存/冲突/邀请寄出/认领/收信/附件 range，已通邮 publicId/联系人、拒收、所有11类物件快照、跨草稿/跨用户访问、旧快照兼容、时间锁、音乐裁切/duck/交叉淡化/随机/后台暂停/释放及源几何排版。
- `pnpm exec tsc --noEmit`、`pnpm lint`、`pnpm build`、`pnpm build:cloudflare`、`wrangler deploy --dry-run --config dist/server/wrangler.json`：本轮均退出0。dry-run 只检查打包，不代表远程资源或设备兼容通过。
- 本地浏览器地址：`http://localhost:3025/letterbee/app/write`（本轮已启动，临时独立数据与随机会话密钥；请使用 localhost 而非 127.0.0.1，避免 Next dev 的 canonical-origin 检查差异）；不自动更新公网。若自行启动：`NEXT_PUBLIC_BASE_PATH=/letterbee pnpm dev --port 3025`。
- 请由父 agent 安排浏览器：甲/乙两个独立会话，以中性昵称登记；甲建草稿→输入段落/隐藏段→拖放11类物件/媒体→录音拍照→改封缄/配乐→保存刷新→预览；甲生成邀请，乙核对口令认领并拆封；乙从收信箱读图/音/视频、发现隐藏段，检查未来段/物件；甲验证寄出后不可编辑；乙回信并验证通信簿/publicId；再检查手机双指/Shift/键盘与 reduced-motion。
- **浏览器设备权限、iOS/Safari 自动播放、相机/录音/HEIC、手势与视觉/灯箱焦点行为仍需人工设备验收**；自动化通过不等于这些已验收。

## 必须保留的预览限制

`mail:v1` 仍是 Cloudflare KV **单 JSON 快照**：最终一致性、每键写入频率/容量、跨 isolate 并发丢更新风险未解决；revision/本地串行队列不是分布式锁。图片文件独立存 R2 并不能解决信件/草稿元数据的一致性。现有登录仍是开发昵称会话、不是正式身份认证。尚无附件垃圾回收/长期配额、恶意内容扫描或端到端加密；废弃/替换附件仍占本草稿限额。上线真实私信前必须设计强一致存储和正式认证/隐私策略。页面继续明确标为预览，不可存真实私信或个人媒体。

### 本轮实际验证记录

| 检查                     | 结果                                                                                                                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 全量 Vitest              | 67/67，20文件通过；无真实信件/媒体 fixture                                                                                                                                                                                                   |
| ESLint                   | 退出0，无 error/warning                                                                                                                                                                                                                      |
| 独立 tsc                 | Next 构建后、vinext + next typegen 后均退出0                                                                                                                                                                                                 |
| Next16 production build  | 退出0；保留 Turbopack 动态 fs/NFT 警告；显式排除 mail/media/env 后检查4523个 trace 条目，私有运行时路径0个                                                                                                                                   |
| vinext/Cloudflare build  | 退出0；上游 sourcemap 与路由静态分类提示仍存在                                                                                                                                                                                               |
| Wrangler dry-run         | 退出0；69个 assets，1360.59KiB / gzip407.84KiB；只打包，未上传/部署/改路由                                                                                                                                                                   |
| 真实 localhost HTTP 回归 | 首页200、17个引用静态资源均200；匿名写信307→带prefix登录；真实登录action303+scoped cookie；编辑器SSR200、私有上传201、保存200；真实邀请认领action303→带prefix读信200，未来正文未泄漏；音视频range路径206、已寄草稿修改409；通信簿图文回信200 |
| 源与旧部署提交           | 源7771c20的 tracked diff为空，包含其他bot未跟踪文件的 status 与开工前一致；83964a4/b438d86仍是新分支祖先                                                                                                                                     |

真实 HTTP 驱动与脱敏结果在 `/workspace/letterbee-migration/local-http-regression.mjs`、`local-preview/http-results.json`；仅日志/临时 fixture 留在 box，不加入仓库。没有浏览器视觉或设备权限验收，也没有本轮公网部署验收。

迁移后预览配额为60段、80个 journal 物件、20首配乐；源 journal 上限200。本轮基于800字产品限制与 KV 单快照收紧物件数量；如必须保留原容量，应在切强一致存储时一起评审。外部音乐 iframe 与跨草稿公共贴纸库没有移入，需要 Neil 决定是否另做通用且有授权边界的方案。
