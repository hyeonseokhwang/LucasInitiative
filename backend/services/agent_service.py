"""
Agent (Department) status tracking.
Each department is a virtual employee with real-time status.
"""
import asyncio
from datetime import datetime
from ws.handler import manager as ws_manager


class Agent:
    def __init__(self, id: str, name: str, role: str, department: str, avatar: str):
        self.id = id
        self.name = name
        self.role = role
        self.department = department
        self.avatar = avatar
        self.status = "idle"          # idle, working, reporting, sleeping
        self.current_task = ""
        self.last_report = ""
        self.last_active = None
        self.task_count = 0
        self.logs: list[dict] = []    # recent activity log (max 50)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "role": self.role,
            "department": self.department,
            "avatar": self.avatar,
            "status": self.status,
            "current_task": self.current_task,
            "last_report": self.last_report,
            "last_active": self.last_active,
            "task_count": self.task_count,
            "logs": self.logs[-10:],  # last 10 for API
        }


class AgentManager:
    def __init__(self):
        self.agents: dict[str, Agent] = {}
        self._init_agents()

    def _init_agents(self):
        agents = [
            Agent("ceo", "Lucas", "CEO / Founder", "headquarters", "boss"),
            Agent("hq", "Claude", "HQ Director / PM", "headquarters", "director"),
            Agent("stock", "Alpha", "Stock Analyst", "stock_division", "trader"),
            Agent("realestate", "Terra", "Real Estate Analyst", "realestate_division", "building"),
            Agent("research", "Scholar", "Research Analyst", "research_division", "researcher"),
            Agent("dev", "Code", "Lead Developer", "dev_division", "developer"),
            Agent("design", "Pixel", "UI/UX Designer", "design_division", "designer"),
            Agent("govt", "Policy", "Gov Project Manager", "govt_division", "government"),
        ]
        for a in agents:
            self.agents[a.id] = a

    async def update_status(self, agent_id: str, status: str, task: str = "", report: str = ""):
        agent = self.agents.get(agent_id)
        if not agent:
            return

        agent.status = status
        if task:
            agent.current_task = task
        if report:
            agent.last_report = report
        agent.last_active = datetime.now().isoformat()

        if status == "working":
            agent.task_count += 1

        # Add to log
        agent.logs.append({
            "time": datetime.now().strftime("%H:%M:%S"),
            "status": status,
            "task": task or agent.current_task,
            "report": report,
        })
        if len(agent.logs) > 50:
            agent.logs = agent.logs[-50:]

        # Broadcast to UI
        await ws_manager.broadcast({
            "type": "agent_update",
            "data": {
                "id": agent_id,
                "status": status,
                "current_task": task or agent.current_task,
                "last_report": report or agent.last_report,
                "task_count": agent.task_count,
            },
        })

    def get_all(self) -> list[dict]:
        return [a.to_dict() for a in self.agents.values()]

    def get_agent(self, agent_id: str) -> dict | None:
        a = self.agents.get(agent_id)
        return a.to_dict() if a else None


agent_manager = AgentManager()
