# Changelog / 更新记录

## 0.1.24

- CI 判定中明确失败优先于仍在运行的检查；`neutral`、未知和不可用结果保持待确认。
- 只有非空 Checks 全部完成且结果均为 `success` / `skipped` 才显示通过。
- 保留点击强制刷新、分页获取 Checks、认证诊断和状态栏提醒。
- 开源整理：补齐中英双语文档、MIT 许可证、构建脚本和开发命令；未改变扩展运行逻辑。

- Explicit CI failures take precedence over running checks; neutral, unknown, or unavailable results remain unresolved.
- A passing state requires nonempty Checks, all completed with `success` or `skipped` conclusions.
- Retains click-to-refresh, paginated Checks retrieval, authentication diagnostics, and status bar reminders.
- Open-source preparation adds bilingual documentation, the MIT license, packaging, and development commands without changing extension runtime behavior.
