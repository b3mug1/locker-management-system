from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, case, literal_column, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_admin, get_db
from app.models.assignment import Assignment
from app.models.locker import Locker
from app.models.student import Student
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def dashboard_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    # Total counts
    students_count = (await db.execute(select(func.count(Student.id)))).scalar_one()
    lockers_count = (await db.execute(select(func.count(Locker.id)))).scalar_one()
    users_count = (await db.execute(
        select(func.count(User.id)).where(User.role != "admin")
    )).scalar_one()
    active_lockers = (await db.execute(
        select(func.count(Locker.id)).where(Locker.status == "active")
    )).scalar_one()

    # Assignment stats
    active_assignments = (await db.execute(
        select(func.count(Assignment.id)).where(Assignment.released_at.is_(None))
    )).scalar_one()
    total_assignments = (await db.execute(select(func.count(Assignment.id)))).scalar_one()

    # Total capacity of active lockers
    total_capacity = (await db.execute(
        select(func.coalesce(func.sum(Locker.capacity), 0)).where(Locker.status == "active")
    )).scalar_one()

    # Available spots = total capacity - active assignments
    available_spots = total_capacity - active_assignments
    occupancy_rate = round((active_assignments / total_capacity * 100), 1) if total_capacity > 0 else 0

    # Lockers with at least one active assignment (occupied lockers)
    occupied_lockers = (await db.execute(
        select(func.count(func.distinct(Assignment.locker_id))).where(
            Assignment.released_at.is_(None)
        )
    )).scalar_one()

    # Floor breakdown
    floor_rows = (await db.execute(
        select(
            Locker.floor,
            func.count(Locker.id).label("total"),
            func.coalesce(func.sum(Locker.capacity), 0).label("capacity"),
        )
        .where(Locker.status == "active")
        .group_by(Locker.floor)
        .order_by(Locker.floor)
    )).all()

    floor_stats = []
    for row in floor_rows:
        floor_active = (await db.execute(
            select(func.count(Assignment.id)).where(
                Assignment.released_at.is_(None),
                Assignment.locker_id.in_(
                    select(Locker.id).where(Locker.floor == row.floor, Locker.status == "active")
                ),
            )
        )).scalar_one()
        floor_stats.append({
            "floor": row.floor,
            "lockers": row.total,
            "capacity": row.capacity,
            "occupied": floor_active,
            "available": row.capacity - floor_active,
        })

    # Recent assignments (last 5)
    recent_result = await db.execute(
        select(Assignment).order_by(Assignment.id.desc()).limit(5)
    )
    recent_assignments = []
    for a in recent_result.scalars().all():
        recent_assignments.append({
            "id": a.id,
            "student_name": a.student.full_name if a.student else None,
            "locker_number": a.locker.number if a.locker else None,
            "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
            "released_at": a.released_at.isoformat() if a.released_at else None,
        })

    # Students by course
    course_rows = (await db.execute(
        select(Student.course, func.count(Student.id))
        .group_by(Student.course)
        .order_by(Student.course)
    )).all()
    students_by_course = [{"course": r[0], "count": r[1]} for r in course_rows]

    # Maintenance count
    maintenance_lockers = (await db.execute(
        select(func.count(Locker.id)).where(Locker.status == "maintenance")
    )).scalar_one()

    return {
        "students_count": students_count,
        "lockers_count": lockers_count,
        "active_lockers": active_lockers,
        "users_count": users_count,
        "active_assignments": active_assignments,
        "total_assignments": total_assignments,
        "total_capacity": total_capacity,
        "available_spots": available_spots,
        "occupancy_rate": occupancy_rate,
        "occupied_lockers": occupied_lockers,
        "floor_stats": floor_stats,
        "recent_assignments": recent_assignments,
        "students_by_course": students_by_course,
        "maintenance_count": maintenance_lockers,
    }


@router.get("/analytics")
async def dashboard_analytics(
    period: str = Query("month", regex="^(week|month|quarter)$"),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Occupancy trends and assignment analytics over time."""
    now = datetime.now(timezone.utc)

    if period == "week":
        start = now - timedelta(days=7)
        interval_days = 1
    elif period == "month":
        start = now - timedelta(days=30)
        interval_days = 1
    else:  # quarter
        start = now - timedelta(days=90)
        interval_days = 7

    # Total capacity (constant for the chart)
    total_capacity = (await db.execute(
        select(func.coalesce(func.sum(Locker.capacity), 0)).where(Locker.status == "active")
    )).scalar_one()

    # All assignments that were active at some point during the period
    all_assignments = (await db.execute(
        select(Assignment).where(
            Assignment.assigned_at <= now,
            (Assignment.released_at.is_(None)) | (Assignment.released_at >= start),
        )
    )).scalars().all()

    # Build time series
    occupancy_trend = []
    current = start
    while current <= now:
        # Count how many were active at this point in time
        active_at_point = sum(
            1 for a in all_assignments
            if a.assigned_at <= current and (a.released_at is None or a.released_at > current)
        )
        occupancy_trend.append({
            "date": current.strftime("%Y-%m-%d"),
            "occupied": active_at_point,
            "capacity": total_capacity,
            "rate": round(active_at_point / total_capacity * 100, 1) if total_capacity > 0 else 0,
        })
        current += timedelta(days=interval_days)

    # New assignments per day in the period
    new_per_day_result = await db.execute(
        select(
            func.date(Assignment.assigned_at).label("day"),
            func.count(Assignment.id).label("count"),
        )
        .where(Assignment.assigned_at >= start)
        .group_by(func.date(Assignment.assigned_at))
        .order_by(func.date(Assignment.assigned_at))
    )
    assignments_per_day = [{"date": str(r.day), "count": r.count} for r in new_per_day_result.all()]

    # Releases per day
    releases_per_day_result = await db.execute(
        select(
            func.date(Assignment.released_at).label("day"),
            func.count(Assignment.id).label("count"),
        )
        .where(Assignment.released_at >= start, Assignment.released_at.isnot(None))
        .group_by(func.date(Assignment.released_at))
        .order_by(func.date(Assignment.released_at))
    )
    releases_per_day = [{"date": str(r.day), "count": r.count} for r in releases_per_day_result.all()]

    # Occupancy by size
    size_stats_result = await db.execute(
        select(
            Locker.size,
            func.count(Locker.id).label("locker_count"),
            func.coalesce(func.sum(Locker.capacity), 0).label("total_capacity"),
        )
        .where(Locker.status == "active")
        .group_by(Locker.size)
    )
    size_stats = []
    for r in size_stats_result.all():
        # Count active assignments for this size
        occ = (await db.execute(
            select(func.count(Assignment.id)).where(
                Assignment.released_at.is_(None),
                Assignment.locker_id.in_(
                    select(Locker.id).where(Locker.size == r.size, Locker.status == "active")
                ),
            )
        )).scalar_one()
        size_stats.append({
            "size": r.size,
            "lockers": r.locker_count,
            "capacity": r.total_capacity,
            "occupied": occ,
            "rate": round(occ / r.total_capacity * 100, 1) if r.total_capacity > 0 else 0,
        })

    # Busiest floors by current occupancy rate
    floor_rows = (await db.execute(
        select(
            Locker.floor,
            func.count(Locker.id).label("lockers"),
            func.coalesce(func.sum(Locker.capacity), 0).label("capacity"),
        )
        .where(Locker.status == "active")
        .group_by(Locker.floor)
        .order_by(Locker.floor)
    )).all()
    busiest_floors = []
    for r in floor_rows:
        occupied = (await db.execute(
            select(func.count(Assignment.id)).where(
                Assignment.released_at.is_(None),
                Assignment.locker_id.in_(
                    select(Locker.id).where(Locker.floor == r.floor, Locker.status == "active")
                ),
            )
        )).scalar_one()
        busiest_floors.append({
            "floor": r.floor,
            "lockers": r.lockers,
            "capacity": r.capacity,
            "occupied": occupied,
            "rate": round(occupied / r.capacity * 100, 1) if r.capacity > 0 else 0,
        })
    busiest_floors.sort(key=lambda item: item["rate"], reverse=True)

    active_assignments = (await db.execute(
        select(func.count(Assignment.id)).where(Assignment.released_at.is_(None))
    )).scalar_one()
    current_rate = round(active_assignments / total_capacity * 100, 1) if total_capacity > 0 else 0

    students_count = (await db.execute(select(func.count(Student.id)))).scalar_one()
    priority_students = (await db.execute(
        select(func.count(Student.id)).where(Student.inclusive_status != "none")
    )).scalar_one()
    assigned_students = (await db.execute(
        select(func.count(func.distinct(Assignment.student_id))).where(Assignment.released_at.is_(None))
    )).scalar_one()
    students_without_locker = max(0, students_count - assigned_students)
    priority_share = round(priority_students / students_count * 100, 1) if students_count > 0 else 0

    duration_rows = (await db.execute(
        select(Assignment.assigned_at, Assignment.released_at).where(Assignment.released_at.isnot(None))
    )).all()
    if duration_rows:
        avg_seconds = sum((r.released_at - r.assigned_at).total_seconds() for r in duration_rows) / len(duration_rows)
        average_duration_days = round(avg_seconds / 86400, 1)
    else:
        average_duration_days = 0

    # Peak usage: top 5 busiest days
    peak_result = await db.execute(
        select(
            func.date(Assignment.assigned_at).label("day"),
            func.count(Assignment.id).label("count"),
        )
        .group_by(func.date(Assignment.assigned_at))
        .order_by(func.count(Assignment.id).desc())
        .limit(5)
    )
    peak_days = [{"date": str(r.day), "count": r.count} for r in peak_result.all()]

    # Maintenance lockers
    maintenance_count = (await db.execute(
        select(func.count(Locker.id)).where(Locker.status == "maintenance")
    )).scalar_one()

    return {
        "period": period,
        "total_capacity": total_capacity,
        "current_occupied": active_assignments,
        "current_rate": current_rate,
        "occupancy_trend": occupancy_trend,
        "assignments_per_day": assignments_per_day,
        "releases_per_day": releases_per_day,
        "size_stats": size_stats,
        "busiest_floors": busiest_floors,
        "priority_students": priority_students,
        "priority_share": priority_share,
        "students_without_locker": students_without_locker,
        "average_duration_days": average_duration_days,
        "peak_days": peak_days,
        "maintenance_count": maintenance_count,
    }
