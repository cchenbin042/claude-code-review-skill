# Daily Code Review — Claude Code Skill

一键每日代码审查：自动收集变更，并行多维度审查，生成结构化 HTML 日报。零外部依赖，纯 Claude Code 原生能力闭环。

## 架构

### 数据流

```
用户输入 /daily-review [--leader]
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  daily-review.md (Command · 编排层)                    │
│                                                      │
│  Step 0  检测 Git 仓库 + 识别模式 (Developer/Leader)    │
│  Step 1  询问审查范围 (AskUserQuestion)                 │
│  Step 2  启动 diff-collector ─────────────────────┐   │
│  Step 3  并行启动 5 个审查 Agent ───┐              │   │
│  Step 3.5 去重合并 findings          │              │   │
│  Step 4  生成 HTML 报告              │              │   │
│  Step 4f 更新 SHA 缓存               │              │   │
└──────────────────────────────────────┼──────────────┼───┘
                                      │              │
          ┌───────────────────────────┘              │
          ▼                                          ▼
┌─────────────────────────┐          ┌──────────────────────────────┐
│ diff-collector (Agent)  │          │ 5 个审查 Agent (并行)          │
│                         │          │                              │
│ Step 0 SHA 缓存检查     │          │ security-reviewer · 安全      │
│ Step 1 收集原始 diff     │          │ logic-reviewer    · 逻辑      │
│ Step 2 预过滤           │          │ style-reviewer    · 规范      │
│ → 结构化 diff 输出      │          │ perf-reviewer     · 性能      │
└─────────────────────────┘          │ test-reviewer     · 测试      │
                                     │                              │
          ┌──────────────────────────┤ 共享 code-review skill:      │
          │                          │ · 严重程度标准                │
          ▼                          │ · 审查评论格式                │
┌─────────────────────────┐          │ · 各维度 checklist            │
│ code-review (Skill)     │          └──────────────────────────────┘
│ · SKILL.md              │
│ · security-checklist.md │
│ · logic-checklist.md    │
│ · style-checklist.md    │
│ · perf-checklist.md     │
│ · test-checklist.md     │
│ · report-template.html  │
└─────────────────────────┘
```

### 组件职责矩阵

| 组件 | 类型 | 模型 | maxTurns | 职责 |
|------|------|------|----------|------|
| `daily-review.md` | Command | sonnet | — | 编排工作流、去重 findings、生成报告、维护缓存 |
| `diff-collector.md` | Agent | haiku | 5 | 收集 diff、SHA 缓存匹配、预过滤 (排除构建产物/二进制/trivial) |
| `security-reviewer.md` | Agent | sonnet | 8 | OWASP Top 10 安全审查 |
| `logic-reviewer.md` | Agent | sonnet | 8 | 边界条件、错误处理、状态一致性、并发 |
| `style-reviewer.md` | Agent | sonnet | 8 | 命名、结构、重复、语言特定规范 |
| `perf-reviewer.md` | Agent | sonnet | 8 | N+1、内存、阻塞 I/O、算法复杂度 |
| `test-reviewer.md` | Agent | sonnet | 6 | 测试覆盖、质量、隔离性、稳定性 |
| `code-review` | Skill | — | — | 严重程度分级标准 + 审查方法论，所有审查 Agent 共享 |

### 模式对比

| | Developer 模式（默认） | Leader 模式（`--leader`） |
|---|---|---|
| **触发** | `/daily-review` | `/daily-review --leader` |
| **审查 Agent** | 5 个 (含 test-reviewer) | 4 个 (跳过 test-reviewer) |
| **报告重点** | 逐行代码质量 | 全局风险分布 |
| **独有模块** | — | Executive Summary · Module Risk Table |
| **Warnings** | 全部展开 | 默认折叠 |
| **适用场景** | 提交前自查、PR 单点审查 | 每日团队巡检、发版风险评估 |

### 去重机制

跨 Agent 的 findings 会被合并，避免同一行代码被重复报告：

- **key**: `file:line` — 精确行号匹配
- **策略**: 同一行多个 Agent 的 findings → 合并为一条，category 取并集，保留最高优先级 Agent 的 risk/fix 描述
- **优先级链**: Security > Logic > Perf > Style > Test

### SHA 缓存

对每个文件计算 SHA256，缓存审查结果（7 天 TTL）。再次审查时：

- `SHA 命中 + clean` → 跳过，标记 `[cached]`
- `SHA 命中 + had_critical` → 快速复检
- `SHA 不匹配` → 正常审查

缓存文件 `.claude/code-review-cache.json` 由 Command 自动维护，已加入 `.gitignore`。

## 安装

### 项目级（仅当前项目生效）

```bash
cp -r .claude /path/to/your-project/
```

### 用户级（全局生效）

```bash
cp -r .claude/* ~/.claude/
```

重启 Claude Code 即可使用 `/daily-review`。

## 前置要求

| 依赖 | 必需 | 说明 |
|------|------|------|
| Git | 是 | `git` 命令可用 |
| GitHub CLI (`gh`) | 否 | 用于 PR/MR 信息采集，无则降级纯 Git |
| GitLab CLI (`glab`) | 否 | 同上 |

## 使用

输入 `/daily-review` 后弹出审查范围选择：

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

选择后自动执行：收集 diff → SHA 缓存匹配 → 预过滤 → 并行审查 → 去重 → 生成 HTML 报告。

### 场景一：开发者提交前自查

**状态**：刚完成 `src/auth.ts` 登录功能，尚未 commit。

```bash
$ claude
> /daily-review
# 选择 "Uncommitted changes"
```

**执行过程**：收集 `git diff HEAD` → 5 个 Agent 并行审查 → 30 秒出报告。

**报告中可能发现**：

| 级别 | 示例 |
|------|------|
| Critical | `src/auth.ts:42` — 密码比较用了 `===`，存在时序侧信道 |
| Warning | `src/auth.ts:78` — JWT 缺少过期时间，token 永久有效 |
| Warning | `src/user.ts:23` — 循环内逐条查库，N+1 问题 |
| Kudo | `src/auth.ts` — Zod schema 和 TypeScript 类型配合优秀 |

按报告修复 → 补测试 → commit。全过程 5 分钟内。

### 场景二：审查同事代码

**入口 A — 扫全量**：

```bash
$ git pull                          # 拉取所有提交
$ claude
> /daily-review
# 选择 "Today's changes"            # 审查今天全部 commit
```

**入口 B — 审单个 PR**：

```bash
$ claude
> /daily-review
# 选择 "Branch/PR comparison" → 输入 "128"
```

报告中找到 Critical 直接贴 PR 评论区，Warning 记入下次迭代。

### 场景三：Team Lead 每日巡检

```bash
$ git pull
$ claude
> /daily-review --leader
# 选择 "Today's changes"
```

报告提供 Executive Summary（风险等级）和 Module Risk Table（模块风险分布），Critical 直接 @对应同事，30 秒完成巡检。

## 审查维度

| 维度 | Agent | 覆盖范围 |
|------|-------|----------|
| 安全 | security-reviewer | OWASP Top 10：注入、认证、授权、数据暴露、密钥管理、加密、日志 |
| 逻辑 | logic-reviewer | 边界条件、错误处理、状态一致性、并发安全、超时重试、硬编码 |
| 规范 | style-reviewer | 命名一致性、函数/文件尺寸、重复代码、注释质量、语言特定最佳实践 |
| 性能 | perf-reviewer | N+1 查询、内存泄漏、阻塞 I/O、缓存机会、算法复杂度、启动开销 |
| 测试 | test-reviewer | 测试覆盖、断言质量、隔离性、Mock 使用、稳定性风险 |

## 严重程度

| 级别 | 含义 | 处理策略 |
|------|------|----------|
| **Critical** | 安全漏洞、数据损坏风险、必现崩溃 | 合并前必须修复 |
| **Warning** | 潜在问题、违反最佳实践、可维护性差 | 下个迭代修复 |
| **Kudo** | 值得推广的优秀写法 | 团队正向激励 |

## 项目结构

```
.claude/
├── commands/
│   └── daily-review.md                # 编排命令（工作流 + 去重 + 报告生成 + 缓存维护）
├── agents/
│   ├── diff-collector.md              # 变更收集 + SHA 缓存 + 预过滤
│   ├── security-reviewer.md           # 安全审查 Agent
│   ├── logic-reviewer.md              # 业务逻辑审查 Agent
│   ├── style-reviewer.md              # 代码规范审查 Agent
│   ├── perf-reviewer.md               # 性能审查 Agent
│   └── test-reviewer.md               # 测试审查 Agent
└── skills/
    └── code-review/
        ├── SKILL.md                   # 严重程度标准 + 审查方法论
        ├── security-checklist.md      # 安全检查清单（OWASP 10 类）
        ├── logic-checklist.md         # 逻辑检查清单（7 类）
        ├── style-checklist.md         # 规范检查清单（7 语言特定规则）
        ├── perf-checklist.md          # 性能检查清单（8 类）
        ├── test-checklist.md          # 测试审查清单（8 类）
        └── report-template.html       # HTML 报告模板（CSS 变量 + 响应式 + 打印样式）
```

## 支持的语言

通过文件后缀自动识别并适配对应语言规则：

| 语言 | 后缀 |
|------|------|
| TypeScript / JavaScript | `.ts` `.tsx` `.js` `.jsx` |
| Python | `.py` |
| Go | `.go` |
| Java / Kotlin | `.java` `.kt` |
| Rust | `.rs` |
| Ruby | `.rb` |
| Shell | `.sh` `.bash` |

未匹配的语言仍进行通用维度审查（命名、结构、边界条件等）。

## 自定义

### 调整审查强度

修改对应 Agent frontmatter 中的 `maxTurns`：

```yaml
# .claude/agents/security-reviewer.md
maxTurns: 12   # 默认 8，越大越细致
```

### 调整审查维度

```bash
# 删除不需要的维度
rm .claude/agents/perf-reviewer.md
# 添加自定义维度
cp .claude/agents/style-reviewer.md .claude/agents/accessibility-reviewer.md
```

### 添加新语言规则

编辑 `.claude/skills/code-review/style-checklist.md`，在 "Language-Specific Checks" 下追加。

### 自定义报告样式

编辑 `.claude/skills/code-review/report-template.html`，修改 CSS 变量：

```css
:root {
  --bg-root: #080c12;    /* 背景色 */
  --accent: #e2b04a;     /* 强调色 */
  --critical: #e0556a;   /* 严重问题色 */
  /* ... */
}
```

## License

MIT
