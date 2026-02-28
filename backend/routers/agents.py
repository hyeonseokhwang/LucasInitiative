from fastapi import APIRouter
from services.agent_service import agent_manager

router = APIRouter()


@router.get("")
async def get_agents():
    return {"agents": agent_manager.get_all()}


@router.get("/{agent_id}")
async def get_agent(agent_id: str):
    agent = agent_manager.get_agent(agent_id)
    if not agent:
        return {"error": "Agent not found"}
    return agent


@router.get("/{agent_id}/logs")
async def get_agent_logs(agent_id: str):
    agent = agent_manager.agents.get(agent_id)
    if not agent:
        return {"error": "Agent not found"}
    return {"logs": agent.logs}
