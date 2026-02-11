# Intent Tracker Skill

## Description

Automatically detects user intentions from conversations and creates follow-up reminders.

## Usage

```python
from intent_tracker import IntentAwareAssistant, IntentDetector

# Detect intents
detector = IntentDetector()
intents = detector.detect("我想做个项目管理工具")
# → [{intent_type: 'project', content: '项目管理工具', confidence: 0.8, ...}]

# Process message and auto-create todos
assistant = IntentAwareAssistant()
result = assistant.process_message("用户: 我想做个AI助手")
# → {'intents': [...], 'todos_created': [...], 'should_follow_up': True}

# Get follow-up message
follow_up = assistant.get_follow_up_message()
# → "对了，你之前说想做「AI助手」，进展怎么样啦？"
```

## CLI Commands

```bash
# Detect intents in text
python intent_tracker.py detect -t "文本"

# List pending todos
python intent_tracker.py list

# Complete a todo
python intent_tracker.py complete --id todo_abc123

# Check reminder candidates
python intent_tracker.py remind
```

## Detected Intent Types

| Type | Examples | Priority |
|------|----------|----------|
| project | "我要做个项目管理工具" | High (4) |
| decision | "决定了，就用 Python" | Medium-High (3) |
| todo | "记得去配置服务器" | Medium (2) |
| schedule | "明天要开评审会" | Highest (5) |

## Files

- `intent_tracker.py` - Main module
- `demo.py` - Demo script

## Data Storage

Data stored in `/home/tars/Workspace/safeclaw/data/`:
- `intents_detected.json` - Detected intents
- `intents_todos.json` - Todo items

## Integration

### With Heartbeat

Add to `HEARTBEAT.md`:

```markdown
# Intent Follow-up
Check: `python intent_tracker.py remind`
Generate: `assistant.get_follow_up_message()`
```

## Examples

```
💬 用户: 我想做个项目管理工具
🤖 AI: 检测到项目意图！已创建待办。

💬 用户: 今天天气不错  
🤖 AI: 是的！对了，你之前说想做「项目管理工具」，进展怎么样啦？
```
