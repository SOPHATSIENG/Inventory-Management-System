# models.py
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import pytz

db = SQLAlchemy()
ict = pytz.timezone('Asia/Bangkok')


class Product(db.Model):
    __tablename__ = 'product'
    id       = db.Column(db.Integer, primary_key=True, autoincrement=True)
    code     = db.Column(db.String(20), unique=True, nullable=False)
    name     = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    price    = db.Column(db.Float, nullable=False)
    cost     = db.Column(db.Float, default=0.0)
    stock    = db.Column(db.Integer, default=0)
    image    = db.Column(db.String(255), default='https://via.placeholder.com/80')
    desc     = db.Column(db.Text)
    status   = db.Column(db.String(20), default='Active')


class Category(db.Model):
    __tablename__ = 'category'
    id   = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    desc = db.Column(db.Text)


class Order(db.Model):
    __tablename__ = 'order'
    id        = db.Column(db.Integer, primary_key=True, autoincrement=True)
    order_id  = db.Column(db.String(20), unique=True, nullable=False)
    date      = db.Column(db.DateTime, default=lambda: datetime.now(ict))
    customer  = db.Column(db.String(100), default='Walk-in')
    items     = db.Column(db.Integer, default=0)
    total     = db.Column(db.Float, default=0.0)
    payment   = db.Column(db.String(20), default='Cash')
    status    = db.Column(db.String(20), default='Completed')


class Customer(db.Model):
    __tablename__ = 'customer'
    id         = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name       = db.Column(db.String(100), nullable=False)
    phone      = db.Column(db.String(20))
    email      = db.Column(db.String(100))
    join_date  = db.Column(db.Date, default=datetime.utcnow)


class User(db.Model):
    __tablename__ = 'user'
    id          = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username    = db.Column(db.String(50), unique=True, nullable=False)
    password    = db.Column(db.String(255), nullable=False)
    role        = db.Column(db.String(20), default='employee')
    email       = db.Column(db.String(100))


class ActivityLog(db.Model):
    __tablename__ = 'activity_log'
    id          = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id     = db.Column(db.Integer, db.ForeignKey('user.id'))
    action      = db.Column(db.String(255), nullable=False)
    timestamp   = db.Column(db.DateTime, default=lambda: datetime.now(ict))
    ip_address  = db.Column(db.String(50))


class Supplier(db.Model):
    __tablename__ = 'supplier'
    id       = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name     = db.Column(db.String(100), nullable=False)
    contact  = db.Column(db.String(100))
    phone    = db.Column(db.String(20))
    email    = db.Column(db.String(100))
    address  = db.Column(db.Text)
    notes    = db.Column(db.Text)


class Employee(db.Model):
    __tablename__ = 'employee'
    id            = db.Column(db.Integer, primary_key=True)
    name          = db.Column(db.String(100), nullable=False)
    email         = db.Column(db.String(255), nullable=False, unique=True)
    age           = db.Column(db.Integer, nullable=False)
    gender        = db.Column(db.String(50), nullable=False, default='Not specified')
    password_hash = db.Column(db.String(255))
    created_at    = db.Column(db.DateTime, default=lambda: datetime.now(ict))