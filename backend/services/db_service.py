import aiosqlite
from config import DB_PATH, SCHEMA_PATH

_db: aiosqlite.Connection | None = None


async def get_db() -> aiosqlite.Connection:
    global _db
    if _db is None:
        _db = await aiosqlite.connect(str(DB_PATH))
        _db.row_factory = aiosqlite.Row
        await _db.execute("PRAGMA journal_mode=WAL")
        await _db.execute("PRAGMA foreign_keys=ON")
    return _db


async def init_db():
    db = await get_db()
    schema = SCHEMA_PATH.read_text(encoding="utf-8")
    await db.executescript(schema)
    await db.commit()


async def close_db():
    global _db
    if _db:
        await _db.close()
        _db = None


async def execute(sql: str, params: tuple = ()) -> int:
    db = await get_db()
    cursor = await db.execute(sql, params)
    await db.commit()
    return cursor.lastrowid


async def fetch_one(sql: str, params: tuple = ()) -> dict | None:
    db = await get_db()
    cursor = await db.execute(sql, params)
    row = await cursor.fetchone()
    return dict(row) if row else None


async def fetch_all(sql: str, params: tuple = ()) -> list[dict]:
    db = await get_db()
    cursor = await db.execute(sql, params)
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]
