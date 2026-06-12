---
name: requirements-exploration
description: Use only when the user explicitly asks to run demand exploration or requirements refinement, invokes $requirements-exploration, or asks to create/update confirmed requirement docs before prototype work. Do not trigger automatically for ordinary prototype generation, vague briefs, local edits, or bug fixes.
---

# 需求探索

This is an explicit demand exploration workflow. Only enter it after the user clearly asks for demand exploration / requirements refinement, uses `$requirements-exploration`, or chooses this workflow from the product UI.

If the current request is an ordinary prototype generation or edit request, do not start this workflow just because the brief is incomplete. Ask at most the blocking questions needed to proceed, or state reasonable assumptions and implement.

Explore the plan until there is a shared understanding of the product goal, scope, users, scenarios, terms, constraints, and acceptance criteria. Walk down only the branches that materially affect scope, cost, or validation. For each question, provide your recommended answer.

Ask the questions one at a time, waiting for feedback on each question before continuing. Closely related 2-3 parameters can be grouped into one question.

If a question can be answered by exploring the project, explore the project instead.

## 项目感知

During project exploration, also look for existing documentation:

- `AGENTS.md`、`README.md`、`rules/`
- `src/resources/`
- `src/prototypes/<prototype-id>/.spec/`
- `.axhub/make/project.json`

## 探索过程

### Challenge against existing language

When the user uses a term that conflicts with existing project language, call it out immediately. "Your docs define '发布' as X, but you seem to mean Y - which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying '项目' - do you mean the Make project, the prototype, or the business initiative?"

### Discuss concrete scenarios

When product relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with project

When the user states how something works, check whether the prototype, resources, specs, or metadata agree. If you find a contradiction, surface it.

### Recording cadence

Do not update files after every question.

Update the exploration snapshot only at these checkpoints:

- after every 10 answered questions;
- when the user asks to pause, stop, summarize, or proceed to implementation;
- when the exploration naturally ends;
- when a major irreversible decision is confirmed and waiting would risk losing the decision.

Use Markdown. Keep it lean and decision-focused. Record only confirmed decisions, explicit user choices, unresolved open questions, and important assumptions.

### Long-session reminder

Keep a rough count of answered questions in this exploration session.

At every 50 answered questions, remind the user that the exploration has reached another 50-question checkpoint. Ask whether they want to continue exploring, pause and record the current snapshot, or enter wrap-up.

If the user wants to stop, switch to wrap-up mode:

- ask up to 5 final high-impact questions, prioritizing blockers and validation risks;
- do not force all remaining branches to close;
- record the confirmed decisions plus open questions;
- summarize the recommended next implementation step.

If the user says to stop immediately, skip the final questions and record the current confirmed snapshot.

## 存储位置

All written exploration and requirements snapshot files must live under the target prototype's `.spec/` directory:

```text
src/prototypes/<prototype-id>/.spec/YYYY-MM-DD-<topic>.md
```

If no target prototype is identified, do not write a file yet. Ask the user to choose the prototype, or first create / identify the target prototype and then write into its `.spec/` directory.

Do not write confirmed exploration docs under root `docs/`, `src/resources/requirements/`, or `.axhub/make/`.
Do not create `.axhub/make/exploration/`, `sessions/<session-id>.json`, or `index.json` for this workflow.

## 文档内容

Only record confirmed exploration decisions:

- resolved terms
- scope and non-goals
- concrete scenarios and edge cases
- decisions and trade-offs
- open questions

Do not treat the document as a scratch pad. Do not add implementation detail unless it affects the product decision.
