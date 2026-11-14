# 纸短情长

[![GPL-3.0-only](https://img.shields.io/badge/license-GPL--3.0--only-blue.svg)](LICENSE)

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

## 许可证

本仓库的第一方材料以 **GPL-3.0-only** 授权：仅适用 GNU 通用公共许可证第 3 版（GNU General Public License, version 3 only）。完整、未改动的许可证文本在 [LICENSE](LICENSE)。

First-party material in this repository is licensed under the GNU General Public License, version 3 only (SPDX: `GPL-3.0-only`). You may use, copy, modify, and distribute that first-party material under the terms of version 3 of the License as published by the Free Software Foundation. This grant is version 3 only.

本程序按原样提供，不附带任何明示或默示担保，包括对适销性和特定用途适用性的担保。详见 GNU 通用公共许可证。

第三方依赖，以及各自带有许可声明的第三方素材，继续适用其原有许可证与署名。上述授权只覆盖本仓库的第一方材料。
