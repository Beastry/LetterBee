# 纸短情长

一个 Web 端慢通讯 App：模拟八九十年代写信、寄信、等信、收信的完整邮政体验。

## 开发

```bash
pnpm install
pnpm dev
```

样例信在 `/letters/sample`，本地口令见[信笺模块说明](docs/letter-kit.md)。编辑在登录后的 `/app/write`。

```bash
pnpm test
```

## 文档

- [产品概念](docs/product-concept.md)
- [信笺模块：开封、按日解锁与编辑](docs/letter-kit.md)
- [上线前关键问题](docs/product-open-questions.md)
- [收件人关系与后续寄信流程](docs/recipient-relationship-flow.md)（公开用户 ID + 邀请认领）
- [开发规划](docs/development-plan.md)
