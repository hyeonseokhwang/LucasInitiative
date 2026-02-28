import anthropic
import os
import json
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """You are the Supervisor AI for Lucas Initiative's local AI infrastructure.

Your role:
- You are the PM (Project Manager) of this system
- You receive commands from Lucas (the CEO) and decide what to do
- You can delegate tasks to local Ollama models for execution
- You can search the web and fetch web pages
- You report results clearly and concisely

Available tools/capabilities:
1. CHAT - Have Ollama answer a question (delegate to local LLM)
2. SEARCH - Search the web using DuckDuckGo and return results
3. FETCH - Fetch a specific URL and extract its text content
4. SEARCH+OLLAMA - Search the web, then have Ollama analyze/summarize the results
5. SCHEDULE_ADD - Add a calendar event/schedule
6. SCHEDULE_LIST - List upcoming schedules
7. EXPENSE_ADD - Record an expense or income
8. EXPENSE_SUMMARY - Get monthly expense summary
9. STOCK_REPORT - Get current stock market data (Korean + US stocks, indices)
10. REALESTATE_REPORT - Get Seoul apartment sale/jeonse/monthly rent market data
11. DAILY_REPORT - Generate full daily report (stocks + real estate combined)
12. STATUS - Report system status
13. DEEP_RESEARCH - Trigger autonomous deep research on a topic (multi-source, cross-validated)

When you receive a message, respond with a JSON action plan:
{
  "intent": "chat|search|fetch|schedule|expense|stock|realestate|report|status|direct_answer",
  "reasoning": "why you chose this action",
  "actions": [
    {
      "tool": "ollama|search|fetch|schedule_add|schedule_list|expense_add|expense_summary|stock_report|realestate_report|daily_report|deep_research|supervisor",
      "model": "deepseek-r1:8b (only for ollama tool)",
      "query": "search query (for search tool)",
      "url": "target URL (for fetch tool)",
      "prompt": "what to ask/do (for ollama tool)",
      "title": "event title (for schedule_add)",
      "start_at": "2026-03-07T17:00:00 (ISO datetime for schedule_add)",
      "end_at": "optional end time (for schedule_add)",
      "category": "general|work|personal|meeting (for schedule_add) or food|transport|shopping|bills|income|etc (for expense_add)",
      "amount": 12000,
      "description": "description text",
      "is_income": false,
      "month": "2026-02 (for expense_summary)"
    }
  ],
  "direct_response": "if you can answer directly without tools, put it here"
}

You can chain multiple actions. Example: search first, then have Ollama summarize.

Rules:
- For simple greetings or questions you can answer directly, use "direct_answer"
- For "search X" or "find news about X", use the search tool
- For "go to this URL" or "read this page", use the fetch tool
- For tasks requiring AI reasoning, delegate to Ollama
- You can combine: search → ollama (search then have Ollama analyze results)
- For "일정 추가", "약속 잡아줘", "3월 7일에 뭐 있어?" → use schedule tools
- For "점심 12000원", "이번달 얼마 썼어?", "가계부" → use expense tools
- For "주식 어때?", "시장 상황", "삼성전자 주가" → use stock_report
- For "부동산 시세", "서울 아파트", "전세 시세" → use realestate_report
- For "일일보고", "오늘 보고서", "daily report" → use daily_report (stocks + real estate combined)
- For "심층 분석", "깊이 조사", "리서치 해줘", "deep research" → use deep_research (trigger autonomous multi-source research)
- Today's date is dynamically provided: always use it for relative dates like "오늘", "내일", "다음주"
- Always respond in the same language as the user
- Be concise and actionable
- If a capability is not yet implemented, say so honestly
"""


async def classify_intent(message: str) -> dict:
    """Use Haiku to quickly classify what the user wants."""
    from datetime import datetime

    today = datetime.now().strftime("%Y-%m-%d %H:%M (%A)")
    user_message = f"[Current datetime: {today}]\n\n{message}"

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=500,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        text = response.content[0].text

        # Try to parse JSON from response
        try:
            # Find JSON in response
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                plan = json.loads(text[start:end])
                plan["_tokens"] = {
                    "input": response.usage.input_tokens,
                    "output": response.usage.output_tokens,
                }
                plan["_model"] = response.model
                return plan
        except json.JSONDecodeError:
            pass

        # Fallback: treat as direct answer
        return {
            "intent": "direct_answer",
            "reasoning": "Could not parse structured response",
            "actions": [],
            "direct_response": text,
            "_tokens": {
                "input": response.usage.input_tokens,
                "output": response.usage.output_tokens,
            },
            "_model": response.model,
        }

    except Exception as e:
        return {
            "intent": "error",
            "reasoning": str(e),
            "actions": [],
            "direct_response": f"Supervisor error: {str(e)}",
            "_tokens": {"input": 0, "output": 0},
            "_model": "error",
        }


async def execute_plan(plan: dict, ollama_chat_fn, broadcast_fn=None) -> str:
    """Execute the action plan from the supervisor.

    broadcast_fn: async callback to send intermediate results to the client in real-time.
    """
    from services.crawl_service import search_web, fetch_page
    from services.schedule_service import create_schedule, list_schedules, get_upcoming
    from services.expense_service import add_expense, get_summary as expense_summary
    from services.stock_service import generate_stock_report
    from services.realestate_service import generate_realestate_report
    from services.report_service import generate_daily_report

    intent = plan.get("intent", "")

    if intent == "direct_answer":
        return plan.get("direct_response", "")

    if intent == "error":
        return plan.get("direct_response", "Error occurred")

    async def broadcast(text: str):
        if broadcast_fn:
            await broadcast_fn(text)

    results = []
    search_context = ""  # accumulated context from search/fetch for chained ollama calls

    for action in plan.get("actions", []):
        tool = action.get("tool", "")

        if tool == "search":
            query = action.get("query", action.get("prompt", ""))
            await broadcast(f"[Searching: {query}...]\n")
            items = await search_web(query, max_results=5)
            formatted = []
            for i, item in enumerate(items, 1):
                formatted.append(
                    f"{i}. **{item.get('title', '')}**\n"
                    f"   {item.get('href', item.get('url', ''))}\n"
                    f"   {item.get('body', '')}"
                )
            result = "\n\n".join(formatted)
            await broadcast(result + "\n\n")
            search_context += f"\n\n[Search: {query}]\n{result}"
            results.append(f"[Search: {query}]\n{result}")

        elif tool == "fetch":
            url = action.get("url", action.get("prompt", ""))
            await broadcast(f"[Fetching: {url}...]\n")
            page = await fetch_page(url)
            result = f"**{page['title']}**\n\n{page['content']}"
            await broadcast(f"[Fetched {page['title']}] ({page['length']} chars)\n\n")
            search_context += f"\n\n[Fetched: {url}]\n{result}"
            results.append(f"[Fetched: {page['title']}]\n{result}")

        elif tool == "ollama":
            model = action.get("model", "deepseek-r1:8b")
            prompt = action.get("prompt", "")
            if search_context:
                prompt = f"Based on the following information:\n{search_context}\n\n{prompt}"
                search_context = ""
            result = await ollama_chat_fn(model, prompt)
            results.append(f"[Ollama/{model}]: {result}")

        elif tool == "schedule_add":
            title = action.get("title", "Untitled")
            start_at = action.get("start_at", "")
            end_at = action.get("end_at")
            category = action.get("category", "general")
            description = action.get("description", "")
            await broadcast(f"[Adding schedule: {title}...]\n")
            item = await create_schedule(
                title=title, start_at=start_at, end_at=end_at,
                description=description, category=category,
            )
            results.append(f"[Schedule added] {title} @ {start_at} (ID: {item['id']})")

        elif tool == "schedule_list":
            from_date = action.get("from_date")
            to_date = action.get("to_date")
            items = await list_schedules(from_date=from_date, to_date=to_date)
            if items:
                lines = []
                for s in items:
                    lines.append(f"- [{s['category']}] **{s['title']}** @ {s['start_at']}")
                    if s.get("description"):
                        lines.append(f"  {s['description']}")
                results.append("[Schedules]\n" + "\n".join(lines))
            else:
                results.append("[Schedules] No upcoming events found.")

        elif tool == "expense_add":
            amount = action.get("amount", 0)
            category = action.get("category", "etc")
            description = action.get("description", "")
            is_income = action.get("is_income", False)
            paid_at = action.get("paid_at")
            await broadcast(f"[Recording: {amount:,}원...]\n")
            item = await add_expense(
                amount=amount, category=category, description=description,
                is_income=is_income, paid_at=paid_at, source="chat",
            )
            label = "Income" if is_income else "Expense"
            results.append(f"[{label} recorded] {amount:,}원 ({category}) - {description or 'N/A'}")

        elif tool == "expense_summary":
            month = action.get("month", "")
            summary = await expense_summary(month)
            lines = [
                f"[Expense Summary: {month}]",
                f"Income: {summary['total_income']:,}원",
                f"Expense: {summary['total_expense']:,}원",
                f"Balance: {summary['balance']:,}원",
            ]
            if summary["breakdown"]:
                lines.append("\nBreakdown:")
                for b in summary["breakdown"]:
                    label = "+" if b["is_income"] else "-"
                    lines.append(f"  {label} {b['category']}: {b['total']:,}원 ({b['count']}건)")
            results.append("\n".join(lines))

        elif tool == "stock_report":
            await broadcast("[Fetching stock data (KR + US)...]\n")
            report = await generate_stock_report()
            results.append(report)

        elif tool == "realestate_report":
            await broadcast("[Fetching real estate data (Seoul)...]\n")
            report = await generate_realestate_report()
            results.append(report)

        elif tool == "daily_report":
            await broadcast("[Generating daily report...]\n")
            report = await generate_daily_report()
            results.append(report)

        elif tool == "deep_research":
            query = action.get("query", action.get("prompt", ""))
            await broadcast(f"[Deep Research queued: {query}...]\n")
            from services.research_service import queue_manual
            await queue_manual(query)
            results.append(f"[Deep Research] Research queued: {query}\nThe research engine will analyze this topic with multi-source cross-validation. Results will appear in the Research tab.")

        elif tool == "supervisor":
            results.append(f"[Supervisor]: {action.get('prompt', '')}")

        else:
            results.append(f"[{tool}]: Not yet implemented.")

    if not results:
        return plan.get("direct_response", "No actions to execute.")

    return "\n\n".join(results)
