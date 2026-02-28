from fastapi import APIRouter
from services.ollama_service import list_models, get_running_models
from config import MODEL_CONFIGS

router = APIRouter()


@router.get("")
async def get_models():
    try:
        models = await list_models()
        result = []
        for m in models:
            name = m.get("name", "")
            config = MODEL_CONFIGS.get(name, {})
            result.append({
                "name": name,
                "label": config.get("label", name),
                "category": config.get("category", "general"),
                "recommended": config.get("recommended", False),
                "note": config.get("note", ""),
                "size": m.get("size", 0),
                "modified_at": m.get("modified_at", ""),
            })
        return {"models": result}
    except Exception as e:
        return {"models": [], "error": str(e)}


@router.get("/running")
async def get_running():
    try:
        models = await get_running_models()
        return {"models": models}
    except Exception as e:
        return {"models": [], "error": str(e)}
