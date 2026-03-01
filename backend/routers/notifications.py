from fastapi import APIRouter, Query
from services.notification_service import (
    get_notifications, get_unread_count,
    mark_read, mark_all_read, delete_notification,
)

router = APIRouter()


@router.get("")
async def list_notifications(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    unread_only: bool = False,
    type: str | None = None,
):
    """Get notifications with pagination."""
    result = await get_notifications(limit=limit, offset=offset, unread_only=unread_only, ntype=type)
    return result


@router.get("/unread-count")
async def unread_count():
    """Get count of unread notifications."""
    count = await get_unread_count()
    return {"unread_count": count}


@router.put("/{notification_id}/read")
async def read_notification(notification_id: int):
    """Mark a notification as read."""
    success = await mark_read(notification_id)
    if not success:
        return {"error": "Notification not found"}
    return {"success": True, "id": notification_id}


@router.put("/read-all")
async def read_all_notifications():
    """Mark all notifications as read."""
    count = await mark_all_read()
    return {"success": True, "marked_read": count}


@router.delete("/{notification_id}")
async def remove_notification(notification_id: int):
    """Delete a notification."""
    success = await delete_notification(notification_id)
    if not success:
        return {"error": "Notification not found"}
    return {"deleted": True, "id": notification_id}
