# Cloudflare 独立站预览部署

LetterBee 是独立 Worker，不复制到官网 Astro/Pages 的 `public/`。官网原有 Pages 和其他产品不变。

## 适配选择

使用 **vinext 1.4.6 + Cloudflare Vite plugin 1.x + Wrangler**，保留原 Next.js 16 开发/构建命令。
安装并阅读 `cloudflare/vinext` 的 `migrate-to-vinext` skill，运行 `vinext check`：96% compatible，5/5 next 导入支持，唯一 partial 是未使用的 Turbopack 配置。App Router、Server Actions、basePath 通过本地 workerd 实测，没有业务重写，因此不需要 OpenNext。
Next 与 vinext 会共用 `.next/types/routes.d.ts`；Worker 构建结束后脚本自动执行 `next typegen`，避免残留 Next validator 与 vinext 路由类型冲突。两个 dev 运行时不要同时运行；切回 Next 工具链时也可执行 `pnpm exec next typegen`。

Wrangler 是本项目明确的部署方式，使用官方支持的 legacy Wrangler 集成，而非 `cf` / `cloudflare.config.ts`。手动配置不增加 CDN/data cache 或 Images 服务（私有信件响应禁止共享缓存；本项目没有 next/image）。React/React DOM 升至 19.3.1，以满足 vinext 的 peer 要求。

参考：
- https://github.com/cloudflare/vinext/blob/main/.agents/skills/migrate-to-vinext/SKILL.md
- https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- https://developers.cloudflare.com/workers/wrangler/configuration/#automatic-provisioning

## 路径与会话

- 生产及 Worker 预览 basePath 固定 `/letterbee`；对外目标为 `https://beastry.app/letterbee`。
- 原 `pnpm dev` 默认根路径，本地需要前缀时用 `NEXT_PUBLIC_BASE_PATH=/letterbee pnpm dev`。
- `next/link`、框架 redirect、Server Action 重定向由框架自动加 basePath，**不能再次手工加前缀**。原生 a/fetch、媒体 src、复制邀请链接使用 `appPath()`。
- `zqc_user` 与样例信 gate Cookie 为 HttpOnly、SameSite=Lax，生产 Secure，Path=/letterbee；退出以同路径过期 Cookie 删除。邀请口令 Cookie 进一步限定到 `/letterbee/invite/<token>`。
- 用户 Cookie 新增 HMAC 完整性校验，复用 `LETTER_SESSION_SECRET`。旧未签名 Cookie 会失效，需要重新登记。MVP 仍是昵称登记，不是可恢复账号或正式身份认证。

## 存储

本地依旧 `data/mail/mail.json`，原子文件替换。Worker 显式选择 `MAIL_STORAGE_DRIVER=kv`，绑定 `MAIL_STORE`，使用 `mail:v1` 单 JSON 快照。缺少云端绑定会直接报错，绝不静默回退临时文件。

Wrangler 配置不含假 namespace ID：首次授权部署可自动创建 namespace（Worker 名前缀）。如需固定名称 `letterbee-mail`，先在该账号创建 namespace，并把真实、非秘密 ID 写到源 `wrangler.jsonc` 的 MAIL_STORE 绑定后重新构建；不要只修改 dist 的生成配置。

信笺模块的云端文档也存 KV（`letter:<slug>`），样例 JSON 打包入 Worker；示例媒体由独立应用自身 assets 提供，不碰官网。
**云端预览暂不支持媒体上传**：明确返回提示，避免把上传写进 Worker 的临时文件系统。正式媒体上传需要对象存储和受控分发，另行实现。

**重要：只适合低流量功能预览，不可当作正式信件存储。** KV 最终一致；跨 isolate 的读改写可能丢更新、重复认领或公开号冲突；进程内队列不构成分布式事务。同 key 有写频率限制，连续写入可能被限流。已经避免无变化的用户注册重复写入，但不宣称多用户并发可靠。正式服务应迁移 Durable Object/D1/数据库事务，并增加分布式限流/账号恢复。

## 本地验证

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm cf:typegen
pnpm test
pnpm exec tsc --noEmit
pnpm build                  # 保留的 Next.js 构建
pnpm build:cloudflare       # dist/server/wrangler.json + dist/client
pnpm exec wrangler deploy --config dist/server/wrangler.json --dry-run
```

本地生产 Worker 预览需要测试用随机 `LETTER_SESSION_SECRET`。把它安全写入忽略的 `dist/server/.dev.vars`（不要提交；重新构建可能清除），再运行：

```bash
pnpm exec wrangler dev --config dist/server/wrangler.json --port 18874
curl -i http://localhost:18874/letterbee
curl -i http://localhost:18874/letterbee/app
```

匿名工作台应 307 到 `/letterbee/login`，首页/登录/样例为 200，CSS/JS/font 路径带 `/letterbee`。生产 Secure Cookie 不会被普通 HTTP cookie jar 自动回传；本地测试可仅在测试客户端手工回传，而不能关掉生产 Secure。

## 授权后部署

账号 `6d03d35ec17b9be9e4febd16c6799b50`，Worker `letterbee`。现有其他 Worker 不修改、不删除。
先用 `pnpm exec wrangler whoami` 验证已有认证；CI 使用安全注入的 `CLOUDFLARE_API_TOKEN`。缺认证时停止，不在代理会话发起交互式登录、不读取浏览器凭据、不把 MCP 凭据导出给 CLI。
最小所需权限包括目标账号 Workers Scripts Edit、Workers KV Storage Edit；若只发布 workers.dev，不需要 zone routes edit。

```bash
pnpm deploy:cloudflare
# 使用安全的 stdin/交互输入设置至少 32 随机字节的稳定 secret，不要放在 argv、Git 或聊天中
pnpm exec wrangler secret put LETTER_SESSION_SECRET --config dist/server/wrangler.json
```

首个 deploy 到 secret 设置完成之前，登录/开信将 fail closed。需要无窗口首发时应由部署人员用受支持的部署 secrets-file 流程一次注入，或先限制预览访问。更改该 secret 会使既有用户/开信 Cookie 失效。
预期公开预览地址：`https://letterbee.neardws.workers.dev/letterbee`；以实际 Wrangler 返回 URL 为准。预览默认公开，不放真实私信或个人资料。

验证远程首页、静态资源、匿名登录跳转，再用两份浏览器 Cookie 测试登记→设置→带口令邀请→认领→通信簿→按公开号寄信→退出及刷新。curl 本地通过不等于远端通过。

## 仅在 Worker 验证后接官网路径

源配置暂不含 routes，因此不会修改官网路由。zone 为 `abd87577fde0182b6c9ca431725a2865`。仅可绑定这两个 pattern 到 letterbee：

- `beastry.app/letterbee*`
- `www.beastry.app/letterbee*`

**绝不添加覆盖官网全部路径的 wildcard route，不修改 Pages 项目/官网 DNS。** 可由已授权 Cloudflare MCP 添加以上精确路由。若路由由 MCP 管理，应继续保持 wrangler 无 routes；以后切换到 Wrangler 管理时先核对已存在配置，避免覆盖。

## 本次验证记录（2026-11-17 Asia/Shanghai）

52 个单测通过；TypeScript 通过（先生成 Prisma Client）；Next 构建、vinext Worker 构建和 Wrangler dry-run 通过。
本地 workerd 实测首页/登录/样例/静态资源、匿名 307、Server Action 303、Secure scoped signed Cookie、KV 登记、样例口令、带口令邀请、认领、通信簿及按公开号发送。
未执行远程部署：CLI `wrangler whoami` 显示未认证，环境没有 CLOUDFLARE_API_TOKEN。未创建远程 KV、未设置远程 secret、未绑定 zone route。
