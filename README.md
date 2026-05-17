# Daily Code Review — Claude Code Skill

一键每日代码审查：自动收集当日变更，并行审查安全、逻辑、规范、性能四个维度，生成结构化 HTML 日报。

**零外部依赖** — 不需要 Python、Node 或其他运行时，纯 Claude Code 原生能力闭环。

## 安装

### 项目级（只对当前项目生效）

```bash
cp -r .claude /path/to/your-project/
```

### 用户级（全局生效，所有项目可用）

```bash
cp -r .claude/* ~/.claude/
```

一条命令，重启 Claude Code 即可使用 `/daily-review`。

## 前置要求

- Git 仓库（必须）
- 以下之一（可选，用于更丰富的 PR/MR 信息）：
  - [GitHub CLI](https://cli.github.com/) (`gh`)
  - [GitLab CLI](https://gitlab.com/gitlab-org/cli) (`glab`)

纯 Git 也能用，会自动降级。

## 使用

打开 Claude Code，输入 `/daily-review`，Claude 会弹出一个选择框：

```
┌─────────────────────────────────────────────┐
│  选择审查范围                                 │
├─────────────────────────────────────────────┤
│  ○ Uncommitted changes (工作区未提交的变更)    │
│  ○ Today's changes (今天已提交的变更)          │
│  ○ Last N days (最近 N 天)                   │
│  ○ Branch/PR comparison (分支/PR 对比)        │
└─────────────────────────────────────────────┘
```

选择后 Claude 自动收集 diff → 5 个 agent 并行审查 → 生成 HTML 报告。

## 两种模式

`/daily-review` 支持两种运行模式，通过 `--leader` 参数切换：

| | Developer 模式（默认） | Leader 模式（`--leader`） |
|---|---|---|
| **触发** | `/daily-review` | `/daily-review --leader` |
| **审查维度** | 5 个 agent（安全/逻辑/规范/性能/测试） | 4 个 agent（安全/逻辑/规范/性能），跳过测试 |
| **报告重点** | 逐行代码质量 | 全局风险分布 |
| **Warnings** | 全部展开 | 默认折叠，点击展开 |
| **独有模块** | — | Executive Summary + Module Risk Table |
| **适用场景** | 提交前自查、PR 单点审查 | 每日团队回顾、发版风险评估 |

### 场景一：我是开发者，刚写完一个登录接口

**背景**：花了 2 小时写了 `src/auth.ts`，实现了用户名密码登录，还没 commit。

**操作**：
```
$ claude
> /daily-review

Claude 弹出选择框 → 选 "Uncommitted changes"
```

**Claude 自动执行**：
1. 收集 `git diff HEAD`，发现改了 3 个文件（auth.ts、user.ts、.env）
2. 5 个 agent 同时开始审查
3. 30 秒后，报告生成到 `reports/daily-review-2026-05-16.html`

**打开报告，看到**：

| 严重程度 | 内容 |
|----------|------|
| 🔴 Critical | `src/auth.ts:42` — 密码比较用了 `===`，存在时序侧信道，应改用 `crypto.timingSafeEqual()` |
| 🟡 Warning | `src/auth.ts:78` — JWT 过期时间未设置，token 永久有效 |
| 🟡 Warning | `src/user.ts:23` — 循环内逐条查库，存在 N+1 问题 |
| 🟢 Kudo | `src/auth.ts` — Zod schema 和 TypeScript 类型配合得很好 |
| ⚠️ 测试 | 新增 3 个函数均无对应测试 |

**你做的事**：按报告修掉 Critical → 补测试 → commit。全过程不到 5 分钟。

---

### 场景二：我在审别人的代码

**背景**：团队 4 个人，需要审查同事的代码。两种入口任选：

**入口 A — 扫全量**：早上站会结束，拉下同事代码快速扫描。

```
$ git pull                     # 拉下所有同事的提交
$ claude
> /daily-review
选择 "Today's changes"         # 审查今天所有 commit
```

**入口 B — 审单个 PR**：收到 @zhangsan 的 PR #128，改了支付模块。

```
$ claude
> /daily-review
选择 "Specific PR/MR" → 输入 "128"
```

两种方式 Claude 都会自动拉 diff → 5 个 agent 审查 → 出报告。你打开报告：

| 严重程度 | 内容 |
|----------|------|
| 🔴 Critical | `src/payment.ts:112` — @zhangsan 的回调没做签名校验，可被伪造 |
| 🔴 Critical | `src/order.ts:158` — @lisi 的库存扣减不在事务里，有超卖风险 |
| 🟡 Warning | `src/api/user.ts:45` — @wangwu 的接口没做频率限制 |
| 🟡 Warning | `src/utils.ts:89` — 测试文件里遗留了 `.only` |

Critical 项直接贴到 PR 评论区要求修复，Warning 记到下次迭代。

---

### 场景三：我是 Team Lead，做每日代码质量巡检

**背景**：早上站会结束，想看今天团队的代码整体质量，不需要逐行细节。

**操作**：
```
$ git pull                     # 拉下所有同事的提交
$ claude
> /daily-review --leader
选择 "Today's changes"
```

**Claude 自动执行**：
1. 收集今天所有 commit 的 diff（4 个同事、12 个文件）
2. 4 个核心 agent 并行审查（跳过测试维度）
3. 生成 Leader 专用报告

**打开报告，看到**：

| 区域 | 内容 |
|------|------|
| Executive Summary | `风险较低` badge — 无严重问题，整体良好 |
| Module Risk Table | `src/auth/` 2 严重 3 建议，`src/payment/` 0 严重 1 建议 |
| Critical | `src/payment.ts:112` — @zhangsan 的回调没做签名校验 |
| Warnings（折叠） | 点击展开 → 7 条建议，主要是命名和性能 |

**你的动作**：Critical 项直接 @对应同事要求修复，Module Risk Table 截图贴团队频道，30 秒搞定。

---

> **总结**：Developer 模式（自查/PR 审查）→ Leader 模式（团队巡检/发版评估），两种模式覆盖开发和管理的全部代码审查场景。

审查完成后，HTML 报告生成在 `reports/daily-review-YYYY-MM-DD.html`，可直接在浏览器中打开。

## 审查维度

| 维度 | Agent | 审查内容 |
|------|-------|----------|
| 安全 | security-reviewer | OWASP Top 10：注入、认证、授权、数据暴露、密钥管理、加密等 |
| 逻辑 | logic-reviewer | 边界条件、错误处理、状态一致性、并发安全、超时重试 |
| 规范 | style-reviewer | 命名、结构、重复、注释、语言特定最佳实践 |
| 性能 | perf-reviewer | N+1 查询、内存泄漏、阻塞 I/O、缓存机会、算法复杂度 |
| 测试 | test-reviewer | 测试覆盖、测试质量、隔离性、Mock 使用、稳定性风险 |

## 严重程度

| 级别 | 含义 |
|------|------|
| Critical | 安全漏洞、数据损坏风险、必现崩溃 — **合并前必须修复** |
| Warning | 潜在问题、违反最佳实践、可维护性差 — 建议后续改进 |
| Kudo | 值得推广的写法 — 团队正向激励 |

## 支持的语言

审查通过文件后缀自动识别语言并适配规则：

- TypeScript / JavaScript (.ts, .tsx, .js, .jsx)
- Python (.py)
- Go (.go)
- Java / Kotlin (.java, .kt)
- Rust (.rs)
- Ruby (.rb)
- Shell (.sh, .bash)

其他语言仍会进行通用维度审查（命名、结构、边界条件等）。

## 项目结构

```
.claude/
├── commands/
│   └── daily-review.md              # /daily-review 编排命令
├── agents/
│   ├── diff-collector.md            # 变更收集（自动检测 gh/glab/git）
│   ├── security-reviewer.md         # 安全审查
│   ├── logic-reviewer.md            # 业务逻辑审查
│   ├── style-reviewer.md            # 代码规范审查
│   ├── perf-reviewer.md             # 性能审查
│   └── test-reviewer.md             # 测试审查
└── skills/
    └── code-review/
        ├── SKILL.md                 # 审查方法论 + 严重程度分级
        ├── security-checklist.md    # 安全检查清单（OWASP 体系）
        ├── logic-checklist.md       # 逻辑检查清单
        ├── style-checklist.md       # 规范检查清单（含语言特定规则）
        ├── perf-checklist.md        # 性能检查清单
        ├── test-checklist.md       # 测试审查清单
        └── report-template.html     # HTML 报告模板
```

## 自定义

### 调整审查强度

编辑对应 Agent 的 `maxTurns` 字段（越大越细致）：

```
# .claude/agents/security-reviewer.md
maxTurns: 12    # 默认 8，增大则更细致
```

### 调整审查维度

删除不需要的 Agent 即可：

```bash
rm .claude/agents/perf-reviewer.md   # 不再审查性能
```

### 添加新语言

编辑 `.claude/skills/code-review/style-checklist.md`，在 "Language-Specific Checks" 下添加新语言的规则。

### 自定义报告样式

编辑 `.claude/skills/code-review/report-template.html` 的 CSS 变量和结构。

## License

MIT
