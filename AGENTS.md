Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.
 
**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.
 
## 1. Think Before Coding
 
**Don't assume. Don't hide confusion. Surface tradeoffs.**
 
Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.
 
## 2. Simplicity First
 
**Minimum code that solves the problem. Nothing speculative.**
 
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.
## 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**
When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.
 
When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.
 
## 4. Goal-Driven Execution
 
**Define success criteria. Loop until verified.**
 
Transform tasks into verifiable goals:
- "Add validation" -> "Write tests for invalid inputs, then make them pass"
- "Fix the bug" -> "Write a test that reproduces it, then make it pass"
- "Refactor X" -> "Ensure tests pass before and after"
 
For multi-step tasks, state a brief plan:
```
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
```


##  5. 开发原则
请不要把实现都堆在入口文件里。先识别项目已有结构，再按真实职责拆分：
1. 入口文件只保留应用装配、路由/命令注册、全局 provider。
2. 业务模型放 models/types。
3. 外部系统调用放 services 或 platform。
4. 数据读写放 database/repository/store。
5. 纯工具函数放 utils。
6. UI 组件按页面、面板、弹窗、菜单、复用控件拆到 components。
7. 组件私有样式放回对应 .vue 的 <style scoped>。
8. 跨组件主题、布局、响应式规则保留全局 CSS。
9. 高耦合状态按 composable 拆，并保留清晰输入输出。
 
Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
 
