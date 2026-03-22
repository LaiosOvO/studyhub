"""Agent Loop — the core execution engine.

Implements a Plan → Approve → Execute workflow inspired by Kuse Cowork.
Each execution is fully logged and emits events via an async callback.

Flow:
  1. Load skill → build system prompt with research context
  2. Planning phase: LLM generates a structured plan
  3. Wait for user approval (or auto-approve)
  4. Execution phase: iterate through plan steps, calling tools
  5. Assemble final document from sections
"""

import json
import logging
import uuid
from collections.abc import Callable, Coroutine
from datetime import datetime, timezone
from typing import Any

import litellm
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.agent_run import AgentLog, AgentRun
from app.services.agent.skill_loader import Skill, load_skill
from app.services.agent.tools import TOOL_DEFINITIONS, execute_tool
from app.services.agent.types import (
    AgentEvent,
    AgentEventType,
    AgentPlan,
    PlanStep,
    RunStatus,
    ToolResult,
)

logger = logging.getLogger(__name__)

MAX_TURNS = 25
MAX_TOOL_OUTPUT_LEN = 6000

# Type alias for event callback
EventCallback = Callable[[AgentEvent], Coroutine[Any, Any, None]]


class AgentLoop:
    """Stateful agent execution loop.

    Usage:
        loop = AgentLoop(session, user_id, skill_name, task_id, on_event)
        run_id = await loop.start()
        # ... user approves plan ...
        await loop.execute()
    """

    def __init__(
        self,
        session: AsyncSession,
        user_id: str,
        skill_name: str,
        task_id: str | None = None,
        on_event: EventCallback | None = None,
        auto_approve: bool = False,
    ):
        self.session = session
        self.user_id = user_id
        self.skill_name = skill_name
        self.task_id = task_id
        self.on_event = on_event
        self.auto_approve = auto_approve

        self.run_id: str = ""
        self.skill: Skill | None = None
        self.plan: AgentPlan | None = None
        self.context: dict[str, Any] = {"task_id": task_id, "output_sections": []}
        self.total_cost: float = 0.0

    async def start(self) -> str:
        """Initialize the run: load skill, generate plan.

        Returns:
            The run_id for this agent execution.
        """
        self.run_id = str(uuid.uuid4())

        # Load skill
        self.skill = load_skill(self.skill_name)
        if not self.skill:
            raise ValueError(f"Skill not found: {self.skill_name}")

        # Create DB record
        run = AgentRun(
            id=self.run_id,
            user_id=self.user_id,
            skill_name=self.skill_name,
            task_id=self.task_id,
            status=RunStatus.PLANNING.value,
            input_context={"task_id": self.task_id},
        )
        self.session.add(run)
        await self.session.flush()

        await self._emit(AgentEventType.TEXT, "加载技能配置...", data={"skill": self.skill.display_name})

        # Generate plan
        await self._generate_plan()

        if self.auto_approve and self.plan:
            await self._update_status(RunStatus.EXECUTING)
            await self._emit(AgentEventType.USER_ACTION, "自动审批：计划已批准")
            await self.execute()

        return self.run_id

    async def approve_plan(self) -> None:
        """User approves the plan. Transition to executing."""
        run = await self.session.get(AgentRun, self.run_id)
        if not run or run.status != RunStatus.AWAITING_APPROVAL.value:
            raise ValueError(f"Run {self.run_id} is not awaiting approval (status: {run.status if run else 'N/A'})")

        await self._update_status(RunStatus.EXECUTING)
        await self._emit(AgentEventType.USER_ACTION, "用户已批准计划")
        await self.execute()

    async def reject_plan(self, reason: str = "") -> None:
        """User rejects the plan."""
        await self._update_status(RunStatus.CANCELLED)
        await self._emit(AgentEventType.USER_ACTION, f"用户拒绝计划: {reason}")

    async def execute(self) -> None:
        """Execute the approved plan step by step."""
        if not self.plan:
            await self._fail("No plan to execute")
            return

        run = await self.session.get(AgentRun, self.run_id)
        if not run:
            return

        run.started_at = datetime.now(timezone.utc)
        await self.session.flush()

        try:
            for step in self.plan.steps:
                await self._execute_step(step)
                if step.status == "failed":
                    # Non-fatal: log and continue
                    logger.warning("Step %d failed, continuing: %s", step.id, step.description)

            # Assemble final document
            document = self._assemble_document()

            # Save output
            run = await self.session.get(AgentRun, self.run_id)
            if run:
                run.output_artifact = document
                run.output_format = self.skill.output_format if self.skill else "md"
                run.total_cost = self.total_cost
                run.total_steps = len(self.plan.steps)
                run.status = RunStatus.COMPLETED.value
                run.completed_at = datetime.now(timezone.utc)
                await self.session.flush()

            await self._emit(
                AgentEventType.COMPLETE,
                f"文档生成完成，共 {len(document)} 字",
                data={"length": len(document), "sections": len(self.context.get("output_sections", []))},
            )

        except Exception as e:
            await self._fail(str(e))
            raise

    # ── Plan Generation ──────────────────────────────────────────────────────

    async def _generate_plan(self) -> None:
        """Use LLM to generate an execution plan."""
        assert self.skill is not None

        # Build context by fetching research summary
        research_context = ""
        if self.task_id:
            summary_result = await execute_tool(
                "get_research_summary", {"task_id": self.task_id}, self.session, self.context,
            )
            if summary_result.success:
                research_context = summary_result.output

            gaps_result = await execute_tool(
                "get_gaps_and_trends", {"task_id": self.task_id}, self.session, self.context,
            )
            if gaps_result.success:
                research_context += "\n\n" + gaps_result.output

        plan_prompt = f"""你是一个学术研究 AI 助手。根据以下技能描述和研究上下文，生成一个执行计划。

## 技能
{self.skill.system_prompt}

## 研究上下文
{research_context or '(无上下文)'}

## 可用工具
{self._format_tools()}

## 输出要求
以 JSON 格式返回执行计划，格式如下：
```json
{{
  "goal": "计划目标描述",
  "steps": [
    {{"id": 1, "description": "步骤描述", "tool": "tool_name", "args": {{}}}},
    ...
  ],
  "estimated_sections": 8
}}
```

重要：
- 每个步骤必须明确指定要调用的工具或设为 null（纯文本生成步骤）
- 步骤应该按逻辑顺序排列
- 包含数据获取步骤（get_papers, get_paper_analyses）和写入步骤（write_section）
- 最终输出是一篇完整的学术文档
"""

        messages = [
            {"role": "system", "content": "你是 StudyHub 的文档生成 Agent。请用 JSON 格式返回计划。"},
            {"role": "user", "content": plan_prompt},
        ]

        settings = get_settings()
        try:
            response = await litellm.acompletion(
                model=settings.default_llm_model,
                messages=messages,
                max_tokens=2048,
                temperature=0.3,
            )
            content = response.choices[0].message.content or ""
            self._track_cost(response)

            # Parse plan from response
            self.plan = self._parse_plan(content)

            if self.plan:
                plan_dict = {
                    "goal": self.plan.goal,
                    "steps": [
                        {"id": s.id, "description": s.description, "tool": s.tool, "args": s.args}
                        for s in self.plan.steps
                    ],
                    "estimated_sections": self.plan.estimated_sections,
                }

                # Save plan to DB
                run = await self.session.get(AgentRun, self.run_id)
                if run:
                    run.plan = plan_dict
                    run.status = RunStatus.AWAITING_APPROVAL.value
                    await self.session.flush()

                await self._emit(
                    AgentEventType.PLAN,
                    f"计划生成完成：{self.plan.goal}（{len(self.plan.steps)} 个步骤）",
                    data=plan_dict,
                )
                await self._update_status(RunStatus.AWAITING_APPROVAL)
            else:
                await self._fail("Failed to parse plan from LLM response")

        except Exception as e:
            await self._fail(f"Plan generation failed: {e}")
            raise

    def _parse_plan(self, content: str) -> AgentPlan | None:
        """Extract JSON plan from LLM response."""
        # Try to find JSON block
        json_str = content
        if "```json" in content:
            start = content.index("```json") + 7
            end = content.index("```", start)
            json_str = content[start:end].strip()
        elif "```" in content:
            start = content.index("```") + 3
            end = content.index("```", start)
            json_str = content[start:end].strip()

        try:
            data = json.loads(json_str)
        except json.JSONDecodeError:
            # Try to find any JSON object in the content
            for i, c in enumerate(content):
                if c == "{":
                    try:
                        data = json.loads(content[i:])
                        break
                    except json.JSONDecodeError:
                        continue
            else:
                logger.error("Could not parse plan JSON from: %s", content[:500])
                return None

        steps = [
            PlanStep(
                id=s.get("id", i + 1),
                description=s.get("description", ""),
                tool=s.get("tool"),
                args=s.get("args", {}),
            )
            for i, s in enumerate(data.get("steps", []))
        ]

        return AgentPlan(
            goal=data.get("goal", ""),
            steps=steps,
            estimated_sections=data.get("estimated_sections", 0),
        )

    # ── Step Execution ───────────────────────────────────────────────────────

    async def _execute_step(self, step: PlanStep) -> None:
        """Execute a single plan step."""
        step.status = "running"
        await self._emit(
            AgentEventType.STEP_START,
            f"步骤 {step.id}: {step.description}",
            step_number=step.id,
            data={"tool": step.tool, "args": step.args},
        )

        if step.tool:
            # Tool-based step
            await self._emit(
                AgentEventType.TOOL_CALL,
                f"调用工具: {step.tool}",
                step_number=step.id,
                data={"tool": step.tool, "args": step.args},
            )

            result = await execute_tool(step.tool, step.args, self.session, self.context)

            await self._emit(
                AgentEventType.TOOL_RESULT,
                f"工具返回: {'成功' if result.success else '失败'}",
                step_number=step.id,
                data={
                    "success": result.success,
                    "output": result.output[:MAX_TOOL_OUTPUT_LEN],
                },
            )

            if not result.success:
                step.status = "failed"
            else:
                step.status = "done"

                # If this is a data-gathering step, use the result for LLM generation
                if step.tool != "write_section" and result.output:
                    await self._llm_generate_section(step, result)
        else:
            # Pure LLM generation step (no tool)
            await self._llm_generate_section(step, ToolResult(success=True, output=""))

        await self._emit(
            AgentEventType.STEP_DONE,
            f"步骤 {step.id} {'完成' if step.status == 'done' else '失败'}",
            step_number=step.id,
        )

    async def _llm_generate_section(self, step: PlanStep, tool_result: ToolResult) -> None:
        """Use LLM to generate a document section based on step + tool output."""
        assert self.skill is not None

        existing_sections = self.context.get("output_sections", [])
        existing_outline = "\n".join(
            f"  {s['order']}. {s['title']}" for s in sorted(existing_sections, key=lambda x: x["order"])
        )

        prompt = f"""根据以下信息，生成文档的一个章节。

## 当前步骤
{step.description}

## 数据/上下文
{tool_result.output[:MAX_TOOL_OUTPUT_LEN] if tool_result.output else '(无额外数据)'}

## 已完成章节
{existing_outline or '(尚无已完成章节)'}

## 要求
- 用中文撰写，学术风格
- 包含引用标记 [1], [2] 等（如果有论文数据）
- 只输出章节内容（Markdown 格式），不要输出 JSON
- 章节标题用 ## 开头
"""

        settings = get_settings()
        try:
            response = await litellm.acompletion(
                model=settings.default_llm_model,
                messages=[
                    {"role": "system", "content": self.skill.system_prompt},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=4096,
                temperature=0.4,
            )
            content = response.choices[0].message.content or ""
            self._track_cost(response)

            # Extract section title from content
            lines = content.strip().split("\n")
            section_title = step.description
            if lines and lines[0].startswith("##"):
                section_title = lines[0].lstrip("#").strip()

            # Write section to context
            section_order = len(existing_sections) + 1
            await execute_tool(
                "write_section",
                {"section_title": section_title, "content": content, "section_order": section_order},
                self.session,
                self.context,
            )

            await self._emit(
                AgentEventType.TEXT,
                f"章节 '{section_title}' 已生成 ({len(content)} 字)",
                step_number=step.id,
                data={"section_title": section_title, "length": len(content)},
            )
            step.status = "done"

        except Exception as e:
            logger.exception("LLM section generation failed for step %d", step.id)
            step.status = "failed"
            await self._emit(AgentEventType.ERROR, f"章节生成失败: {e}", step_number=step.id)

    # ── Document Assembly ────────────────────────────────────────────────────

    def _assemble_document(self) -> str:
        """Assemble all sections into a final document."""
        sections = sorted(self.context.get("output_sections", []), key=lambda s: s["order"])
        if not sections:
            return "# 文档生成失败\n\n未能生成任何章节。"

        parts = []
        for section in sections:
            parts.append(section["content"])

        return "\n\n---\n\n".join(parts)

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _format_tools(self) -> str:
        lines = []
        for td in TOOL_DEFINITIONS:
            lines.append(f"- **{td.name}**: {td.description}")
            if td.parameters:
                for k, v in td.parameters.items():
                    lines.append(f"  - {k}: {v}")
        return "\n".join(lines)

    def _track_cost(self, response: Any) -> None:
        """Track LLM cost from response usage."""
        usage = getattr(response, "usage", None)
        if usage:
            # Rough cost estimation
            input_tokens = getattr(usage, "prompt_tokens", 0) or 0
            output_tokens = getattr(usage, "completion_tokens", 0) or 0
            # Approximate cost (Haiku-level pricing)
            cost = (input_tokens * 0.00025 + output_tokens * 0.00125) / 1000
            self.total_cost += cost

    async def _emit(
        self,
        event_type: AgentEventType,
        message: str,
        step_number: int | None = None,
        data: dict | None = None,
    ) -> None:
        """Emit an event: persist to DB and notify via callback."""
        event = AgentEvent(
            event_type=event_type,
            message=message,
            step_number=step_number,
            data=data,
        )

        # Persist to agent_logs
        log = AgentLog(
            run_id=self.run_id,
            event_type=event_type.value,
            step_number=step_number,
            data=data,
            message=message,
        )
        self.session.add(log)
        await self.session.flush()

        # Notify callback
        if self.on_event:
            try:
                await self.on_event(event)
            except Exception:
                logger.exception("Event callback error")

        logger.info("[AgentRun %s] %s: %s", self.run_id, event_type.value, message)

    async def _update_status(self, status: RunStatus) -> None:
        """Update run status in DB."""
        run = await self.session.get(AgentRun, self.run_id)
        if run:
            run.status = status.value
            await self.session.flush()

    async def _fail(self, error: str) -> None:
        """Mark run as failed."""
        run = await self.session.get(AgentRun, self.run_id)
        if run:
            run.status = RunStatus.FAILED.value
            run.error = error
            run.completed_at = datetime.now(timezone.utc)
            await self.session.flush()

        await self._emit(AgentEventType.ERROR, f"Agent 失败: {error}")
