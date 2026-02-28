from fastapi import APIRouter
from pydantic import BaseModel
from services.expense_service import add_expense, list_expenses, get_summary, delete_expense

router = APIRouter()


class ExpenseCreate(BaseModel):
    amount: int
    category: str = "etc"
    description: str | None = None
    is_income: bool = False
    paid_at: str | None = None
    source: str = "manual"


@router.get("")
async def get_expenses(from_date: str = None, to_date: str = None, category: str = None):
    rows = await list_expenses(from_date=from_date, to_date=to_date, category=category)
    return {"expenses": rows}


@router.post("")
async def create_expense(req: ExpenseCreate):
    item = await add_expense(**req.model_dump())
    return item


@router.get("/summary/{month}")
async def monthly_summary(month: str):
    return await get_summary(month)


@router.delete("/{expense_id}")
async def remove_expense(expense_id: int):
    await delete_expense(expense_id)
    return {"ok": True}
