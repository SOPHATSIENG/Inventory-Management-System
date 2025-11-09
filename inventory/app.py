# app.py
from flask import Flask, jsonify, request
from flask_cors import CORS
import bcrypt
import re
from datetime import datetime
import pytz

from config import MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DB
from models import db, Product, Category, Order, Customer, User, ActivityLog, Supplier, Employee, ict
from utils import to_dict, log_action


def create_app():
    app = Flask(__name__, static_folder='static', template_folder='templates')
    app.secret_key = 'CHANGE_ME_IN_PRODUCTION'
    CORS(app, supports_credentials=True)

    app.config['SQLALCHEMY_DATABASE_URI'] = (
        f"mysql+mysqlconnector://{MYSQL_USER}:{MYSQL_PASSWORD}"
        f"@{MYSQL_HOST}/{MYSQL_DB}"
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)

    def valid_email(e):
        return re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', e)

    # ==================== API ROUTES ====================

    @app.route('/api/products', methods=['GET', 'POST'])
    def products_api():
        if request.method == 'GET':
            return jsonify([to_dict(p) for p in Product.query.all()])
        data = request.get_json()
        if Product.query.filter_by(code=data['code']).first():
            return jsonify({'error': 'Code exists'}), 400
        p = Product(**data)
        db.session.add(p)
        db.session.commit()
        log_action(f'Added product "{p.name}"')
        return jsonify({'message': 'Added'}), 201

    @app.route('/api/products/<int:id>', methods=['GET', 'PUT', 'DELETE'])
    def product_api(id):
        p = Product.query.get_or_404(id)
        if request.method == 'GET': return jsonify(to_dict(p))
        if request.method == 'PUT':
            for k, v in request.get_json().items():
                if k != 'id': setattr(p, k, v)
            db.session.commit()
            log_action(f'Updated product "{p.name}"')
            return jsonify({'message': 'Updated'})
        db.session.delete(p)
        db.session.commit()
        log_action(f'Deleted product id={id}')
        return jsonify({'message': 'Deleted'})

    @app.route('/api/categories', methods=['GET', 'POST'])
    def categories_api():
        if request.method == 'GET':
            return jsonify([to_dict(c) for c in Category.query.all()])
        data = request.get_json()
        if Category.query.filter_by(name=data['name']).first():
            return jsonify({'error': 'Category exists'}), 400
        c = Category(**data)
        db.session.add(c)
        db.session.commit()
        log_action(f'Added category "{c.name}"')
        return jsonify({'message': 'Added'}), 201

    @app.route('/api/categories/<int:id>', methods=['DELETE'])
    def delete_category(id):
        c = Category.query.get_or_404(id)
        db.session.delete(c)
        db.session.commit()
        log_action(f'Deleted category id={id}')
        return jsonify({'message': 'Deleted'})

    @app.route('/api/orders', methods=['GET', 'POST'])
    def orders_api():
        if request.method == 'GET':
            return jsonify([to_dict(o) for o in Order.query.all()])
        data = request.get_json()
        o = Order(**data)
        db.session.add(o)
        db.session.commit()
        log_action(f'Created order #{o.order_id}')
        return jsonify({'message': 'Added'}), 201

    @app.route('/api/orders/<int:id>', methods=['GET', 'DELETE'])
    def order_api(id):
        o = Order.query.get_or_404(id)
        if request.method == 'GET': return jsonify(to_dict(o))
        db.session.delete(o)
        db.session.commit()
        log_action(f'Deleted order id={id}')
        return jsonify({'message': 'Deleted'})

    @app.route('/api/customers', methods=['GET', 'POST'])
    def customers_api():
        if request.method == 'GET':
            return jsonify([to_dict(c) for c in Customer.query.all()])
        data = request.get_json()
        if not data.get('name'):
            return jsonify({'error': 'Name required'}), 400
        c = Customer(**data)
        db.session.add(c)
        db.session.commit()
        log_action(f'Added customer "{c.name}"')
        return jsonify({'message': 'Added', 'id': c.id}), 201

    @app.route('/api/customers/<int:id>', methods=['PUT', 'DELETE'])
    def customer_detail(id):
        c = Customer.query.get_or_404(id)
        if request.method == 'PUT':
            data = request.get_json()
            if 'name' in data: c.name = data['name']
            if 'phone' in data: c.phone = data['phone']
            if 'email' in data: c.email = data['email']
            db.session.commit()
            log_action(f'Updated customer "{c.name}"')
            return jsonify({'message': 'Updated'})
        db.session.delete(c)
        db.session.commit()
        log_action(f'Deleted customer id={id}')
        return jsonify({'message': 'Deleted'})

    @app.route('/api/users', methods=['GET', 'POST'])
    def users_api():
        if request.method == 'GET':
            return jsonify([to_dict(u) for u in User.query.all()])
        data = request.get_json()
        if not data.get('username') or not data.get('password'):
            return jsonify({'error': 'username & password required'}), 400
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username taken'}), 400
        u = User(
            username=data['username'],
            password=data['password'],
            role=data.get('role', 'employee'),
            email=data.get('email')
        )
        db.session.add(u)
        db.session.commit()
        log_action(f'Created user "{u.username}"', user_id=u.id)
        return jsonify({'message': 'User added'}), 201

    @app.route('/api/users/<int:id>', methods=['GET', 'PUT', 'DELETE'])
    def user_api(id):
        u = User.query.get_or_404(id)
        if request.method == 'GET': return jsonify(to_dict(u))
        if request.method == 'PUT':
            data = request.get_json()
            if 'username' in data: u.username = data['username']
            if 'password' in data: u.password = data['password']
            if 'role' in data: u.role = data['role']
            if 'email' in data: u.email = data['email']
            db.session.commit()
            log_action(f'Updated user "{u.username}"', user_id=u.id)
            return jsonify({'message': 'Updated'})
        db.session.delete(u)
        db.session.commit()
        log_action(f'Deleted user id={id}')
        return jsonify({'message': 'Deleted'})

    @app.route('/api/logs', methods=['GET'])
    def logs_api():
        logs = ActivityLog.query.order_by(ActivityLog.timestamp.desc()).all()
        return jsonify([to_dict(l) for l in logs])

    @app.route('/api/suppliers', methods=['GET', 'POST'])
    def suppliers_api():
        if request.method == 'GET':
            return jsonify([to_dict(s) for s in Supplier.query.all()])
        data = request.get_json()
        if not data.get('name'):
            return jsonify({'error': 'Name required'}), 400
        s = Supplier(**data)
        db.session.add(s)
        db.session.commit()
        log_action(f'Added supplier "{s.name}"')
        return jsonify({'message': 'Added'}), 201

    @app.route('/api/suppliers/<int:id>', methods=['PUT', 'DELETE'])
    def supplier_api(id):
        s = Supplier.query.get_or_404(id)
        if request.method == 'PUT':
            for k, v in request.get_json().items():
                if hasattr(s, k): setattr(s, k, v)
            db.session.commit()
            log_action(f'Updated supplier "{s.name}"')
            return jsonify({'message': 'Updated'})
        db.session.delete(s)
        db.session.commit()
        log_action(f'Deleted supplier id={id}')
        return jsonify({'message': 'Deleted'})

    @app.route('/api/reports')
    def reports_api():
        prods = Product.query.all()
        orders = Order.query.all()
        cats = Category.query.all()
        cat_stats = {c.name: len([p for p in prods if p.category == c.name]) for c in cats}
        return jsonify({
            'categories': cat_stats,
            'totalSales': sum(o.total for o in orders),
            'totalOrders': len(orders),
            'avgOrder': sum(o.total for o in orders) / max(1, len(orders))
        })

    @app.route('/api/dashboard')
    def dashboard_api():
        prods = Product.query.all()
        orders = Order.query.all()
        today = datetime.now(ict).date()
        today_sales = sum(o.total for o in orders if o.date.date() == today)
        return jsonify({
            'totalProducts': len(prods),
            'totalStockValue': sum(p.price * p.stock for p in prods),
            'todaySales': today_sales,
            'lowStockCount': len([p for p in prods if p.stock < 5])
        })

    @app.route('/api/backup')
    def backup_api():
        return jsonify({
            'products':   [to_dict(p) for p in Product.query.all()],
            'categories': [to_dict(c) for c in Category.query.all()],
            'orders':     [to_dict(o) for o in Order.query.all()],
            'customers':  [to_dict(c) for c in Customer.query.all()],
            'users':      [to_dict(u) for u in User.query.all()],
            'logs':       [to_dict(l) for l in ActivityLog.query.all()],
            'suppliers':  [to_dict(s) for s in Supplier.query.all()],
        })

    @app.route('/api/register', methods=['POST'])
    def register():
        try:
            data = request.get_json()
            name = (data.get('name') or '').strip()
            email = (data.get('email') or '').strip().lower()
            age = data.get('age')
            password = data.get('password') or ''

            if not all([name, email, age is not None, password]):
                return jsonify({'message': 'All fields required'}), 400
            if len(password) < 6:
                return jsonify({'message': 'Password >=6 chars'}), 400
            if not valid_email(email):
                return jsonify({'message': 'Invalid email'}), 400
            if not (18 <= int(age) <= 100):
                return jsonify({'message': 'Age 18–100'}), 400
            if Employee.query.filter_by(email=email).first():
                return jsonify({'message': 'Email already used'}), 400

            hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            user = Employee(name=name, email=email, age=age, password_hash=hashed)
            db.session.add(user)
            db.session.commit()
            return jsonify({'message': 'Registered successfully'}), 201
        except Exception as e:
            print(f"Register error: {e}")
            return jsonify({'message': 'Server error'}), 500

    @app.route('/api/login', methods=['POST'])
    def login():
        try:
            data = request.get_json()
            email = (data.get('email') or '').strip().lower()
            password = data.get('password') or ''

            user = Employee.query.filter_by(email=email).first()
            if user and bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
                return jsonify({
                    'message': 'Login successful',
                    'user': {'id': user.id, 'name': user.name, 'email': user.email}
                })
            return jsonify({'message': 'Wrong email or password'}), 401
        except Exception as e:
            print(f"Login error: {e}")
            return jsonify({'message': 'Server error'}), 500

    @app.route('/')
    def home():
        return app.send_static_file('employee.html')

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=5000)