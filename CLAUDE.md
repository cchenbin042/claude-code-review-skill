# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个 Claude Code 技能/命令配置项目，提供一键每日代码审查能力。不是传统软件项目 — 由 YAML frontmatter 配置的 Agent、Command、Skill 文件组成，无需构建/测试/lint。

## 架构

```
/daily-review (command)
  → diff-collector (agent)        收集变更（自动检测 gh/glab/git）
  → 5 个并行审查 agent:
      security-reviewer           安全审查 OWASP Top 10
      logic-reviewer              业务逻辑、边界条件、错误处理
      style-reviewer              命名、结构、重复、语言特定规范
      perf-reviewer               性能 N+1、内存、阻塞 I/O、算法复杂度
      test-reviewer               测试覆盖、测试质量、隔离性、稳定性
  → 直接生成 HTML 报告（零外部依赖，纯 Claude Code 闭环）
```

所有 agent 共享 `code-review` skill 中定义的严重程度标准和审查方法论。

## 关键文件

| 文件 | 作用 |
|------|------|
| `.claude/commands/daily-review.md` | `/daily-review` 命令编排逻辑，定义完整工作流 |
| `.claude/agents/diff-collector.md` | 变更收集 agent（haiku 模型，maxTurns: 5） |
| `.claude/agents/security-reviewer.md` | 安全审查 agent（sonnet，maxTurns: 8） |
| `.claude/agents/logic-reviewer.md` | 逻辑审查 agent（sonnet，maxTurns: 8） |
| `.claude/agents/style-reviewer.md` | 规范审查 agent（sonnet，maxTurns: 8） |
| `.claude/agents/perf-reviewer.md` | 性能审查 agent（sonnet，maxTurns: 8） |
| `.claude/agents/test-reviewer.md` | 测试审查 agent（sonnet，maxTurns: 6） |
| `.claude/skills/code-review/SKILL.md` | 严重程度分级标准 + 审查评论格式规范 |
| `.claude/skills/code-review/security-checklist.md` | 安全检查清单（OWASP 体系 10 类） |
| `.claude/skills/code-review/logic-checklist.md` | 逻辑检查清单（7 类） |
| `.claude/skills/code-review/style-checklist.md` | 规范检查清单（含 7 种语言特定规则） |
| `.claude/skills/code-review/perf-checklist.md` | 性能检查清单（8 类） |
| `.claude/skills/code-review/test-checklist.md` | 测试审查清单（8 类） |
| `.claude/skills/code-review/report-template.html` | HTML 报告模板，含完整 CSS 样式 |

## 部署

**项目级**：`cp -r .claude /path/to/your-project/`
**用户级**（全局）：`cp -r .claude/* ~/.claude/`

重启 Claude Code 后 `/daily-review` 命令可用。零外部依赖（不需要 Python、Node 等）。

## 自定义

- **调整审查强度**：修改对应 agent frontmatter 中的 `maxTurns`（默认 8）
- **增删审查维度**：添加/删除 `.claude/agents/` 下的 agent 文件
- **添加新语言支持**：编辑 `style-checklist.md`，在 "Language-Specific Checks" 下追加
- **调整报告样式**：编辑 `report-template.html` 的 CSS 和结构

## 报告生成流程

1. 4 个审查 agent 并行完成，返回结构化 markdown
2. Command 解析 agent 输出，提取 findings
3. 读取 `report-template.html`，做占位符替换 + finding HTML 生成
4. Write 工具直接写出最终 HTML（零外部依赖）

## 支持的语言

TypeScript/JavaScript、Python、Go、Java/Kotlin、Rust、Ruby、Shell。通过文件后缀自动识别，其他语言只做通用维度审查。

## 严重程度标准

- **Critical**：安全漏洞/数据损坏/必现崩溃 — 合并前必须修复
- **Warning**：潜在问题/违反最佳实践 — 建议后续改进
- **Kudo**：值得推广的写法 — 正向激励
