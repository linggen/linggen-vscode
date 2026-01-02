# Linggen Frequent Prompts

## 🌀 Init Session

1. **Context Check**: Run `list_sources` and `memory_search_semantic` (query: "key conventions") to align with project standards.
2. **Anchor Awareness**: When you see `// linggen memory: <id>` in code, use `memory_fetch_by_meta(key="id", value="<id>")` or search `.linggen/memory/` for a file containing that ID to retrieve the associated knowledge.

## 💎 Crystallize Knowledge

When we reach a decision or find a "gold" pattern:

1. **Draft Memory**: Propose a `name`, `tags`, and `body`.
2. **Write File**: Create a new `.md` file in `.linggen/memory/` with YAML frontmatter (id, scope, name, summary, tags).
3. **Anchor Code**: Insert the `// linggen memory: <id>` anchor in the relevant source code.

## 🧠 Rules

- **Manage Directly**: You are responsible for creating and updating files in `.linggen/memory/`. Use your file-writing tools.
- **Cite Everything**: Always link facts to a `memory id` or `file path`.
- **Fetch on Sight**: Treat `linggen memory` comments as high-priority context.
