# utils.py
from flask import request
from models import ActivityLog, db
from datetime import datetime


def to_dict(row):
    d = {}
    for col in row.__table__.columns:
        val = getattr(row, col.name)
        if isinstance(val, datetime):
            val = val.isoformat()
        d[col.name] = val
    return d


def log_action(action: str, user_id: int = 1):
    ip = request.remote_addr or 'unknown'
    log = ActivityLog(user_id=user_id, action=action, ip_address=ip)
    db.session.add(log)
    db.session.commit()