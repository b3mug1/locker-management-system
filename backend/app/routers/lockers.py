from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_admin, get_db
from app.core.websocket import manager
from app.models.user import User
from app.schemas.locker import LockerCreate, LockerRead, LockerUpdate
from app.services.audit import AuditLogService
from app.services.locker import LockerService

router = APIRouter(prefix="/lockers", tags=["Lockers"])


@router.get("/", response_model=list[LockerRead])
async def list_lockers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    service = LockerService(db)
    return await service.get_all(skip=skip, limit=limit)


@router.get("/count")
async def count_lockers(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    service = LockerService(db)
    count = await service.count()
    return {"count": count}


@router.get("/{locker_id}", response_model=LockerRead)
async def get_locker(
    locker_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    service = LockerService(db)
    locker = await service.get_by_id(locker_id)
    if not locker:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Locker not found")
    occupied = await service.get_occupied_count(locker_id)
    return LockerRead(
        id=locker.id,
        number=locker.number,
        size=locker.size,
        access_type=locker.access_type,
        capacity=locker.capacity,
        floor=locker.floor,
        status=locker.status,
        occupied_count=occupied,
    )


@router.post("/", response_model=LockerRead, status_code=status.HTTP_201_CREATED)
async def create_locker(
    data: LockerCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    service = LockerService(db)
    existing = await service.get_by_number(data.number)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Locker number already exists",
        )
    locker = await service.create(data)
    await AuditLogService(db).create(
        actor_id=current_admin.id,
        action="create",
        entity_type="locker",
        entity_id=locker.id,
        summary=f"Created locker {locker.number}",
        new_values=data.model_dump(),
    )
    await manager.broadcast("locker_change")
    return LockerRead(
        id=locker.id,
        number=locker.number,
        size=locker.size,
        access_type=locker.access_type,
        capacity=locker.capacity,
        floor=locker.floor,
        status=locker.status,
        occupied_count=0,
    )


@router.put("/{locker_id}", response_model=LockerRead)
async def update_locker(
    locker_id: int,
    data: LockerUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    service = LockerService(db)
    existing = await service.get_by_id(locker_id)
    old_values = None
    if existing:
        old_values = {
            "number": existing.number,
            "size": existing.size,
            "access_type": existing.access_type,
            "capacity": existing.capacity,
            "floor": existing.floor,
            "status": existing.status,
        }
    locker = await service.update(locker_id, data)
    if not locker:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Locker not found")
    await AuditLogService(db).create(
        actor_id=current_admin.id,
        action="update",
        entity_type="locker",
        entity_id=locker.id,
        summary=f"Updated locker {locker.number}",
        old_values=old_values,
        new_values=data.model_dump(exclude_unset=True),
    )
    await manager.broadcast("locker_change")
    occupied = await service.get_occupied_count(locker_id)
    return LockerRead(
        id=locker.id,
        number=locker.number,
        size=locker.size,
        access_type=locker.access_type,
        capacity=locker.capacity,
        floor=locker.floor,
        status=locker.status,
        occupied_count=occupied,
    )


@router.delete("/{locker_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_locker(
    locker_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    service = LockerService(db)
    existing = await service.get_by_id(locker_id)
    deleted = await service.delete(locker_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Locker not found")
    await AuditLogService(db).create(
        actor_id=current_admin.id,
        action="delete",
        entity_type="locker",
        entity_id=locker_id,
        summary=f"Deleted locker {existing.number if existing else locker_id}",
        old_values={
            "number": existing.number,
            "size": existing.size,
            "floor": existing.floor,
            "status": existing.status,
        } if existing else None,
    )
    await manager.broadcast("locker_change")


@router.post("/import-csv")
async def import_lockers_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    created = 0
    skipped = 0
    errors: list[str] = []
    service = LockerService(db)

    for i, row in enumerate(reader, start=2):
        try:
            number = row.get("number", "").strip()
            if not number:
                errors.append(f"Row {i}: missing number")
                skipped += 1
                continue

            existing = await service.get_by_number(number)
            if existing:
                errors.append(f"Row {i}: locker '{number}' already exists")
                skipped += 1
                continue

            data = LockerCreate(
                number=number,
                size=row.get("size", "medium").strip().lower(),
                access_type=row.get("access_type", "key").strip().lower(),
                capacity=int(row.get("capacity", 1)),
                floor=int(row.get("floor", 1)),
                status=row.get("status", "active").strip().lower(),
            )
            await service.create(data)
            created += 1
        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")
            skipped += 1

    if created > 0:
        await AuditLogService(db).create(
            actor_id=current_admin.id,
            action="import",
            entity_type="locker",
            entity_id=None,
            summary=f"Imported lockers CSV: {created} created, {skipped} skipped",
        )
        await manager.broadcast("locker_change")

    return {"created": created, "skipped": skipped, "errors": errors}
