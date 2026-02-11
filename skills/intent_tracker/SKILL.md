# Project-Aware Intent Tracker

## Description

Automatically detects project intents, generates phase-based plans, tracks progress, and provides adaptive follow-ups.

## Features

- **Auto Project Planning**: Generates multi-phase plans from simple intent
- **Progress Tracking**: Detects completion signals and advances phases
- **Smart Follow-ups**: Natural reminders at conversation opportunities
- **Adaptive Suggestions**: AI-powered phase suggestions

## Usage

```python
from project_tracker import ProjectAwareAssistant

assistant = ProjectAwareAssistant()

# Process message
result = assistant.process_message("我想做个项目管理工具")

print(result['response'])
# → "好的！我来帮你规划「项目管理工具」..."
```

## CLI Commands

```bash
# Create project / track progress
python project_tracker.py create -t "我想做个XX"

# List all projects
python project_tracker.py list

# Generate follow-ups
python project_tracker.py followup

# Run demo
python project_tracker.py demo
```

## Project Phases

| Template | Phases |
|----------|--------|
| Web 应用 | 需求分析 → 原型设计 → 后端开发 → 前端开发 → 测试 → 部署上线 |
| API 服务 | API 设计 → 接口开发 → 文档编写 → 测试 → 部署 |
| 移动应用 | 需求分析 → UI/UX设计 → 前端开发 → 后端开发 → 测试 → 上架 |

## How It Works

```
1. User: "我想做个项目管理工具"
   → Detect project intent
   → Generate 6-phase plan
   → Create project record

2. User: "原型图画完了"
   → Detect progress
   → Advance to next phase
   → Generate encouragement + suggestion

3. User: "今天天气不错"
   → Detect follow-up opportunity
   → Natural reminder: "「XX」有什么进展吗？"
```

## Data Storage

Projects stored in: `/home/tars/Workspace/safeclaw/data/projects.json`

## Integration

### With Heartbeat

Add to `HEARTBEAT.md`:

```markdown
# Project Follow-up
Check: `python project_tracker.py followup`
```

### With Memory

Projects are automatically saved and persisted across sessions.
