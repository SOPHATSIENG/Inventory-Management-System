# init_db.py
import mysql.connector
from app import create_app
from models import db, Category, User
import config

def create_database():
    conn = mysql.connector.connect(
        host=config.MYSQL_HOST,
        user=config.MYSQL_USER,
        password=config.MYSQL_PASSWORD
    )
    cur = conn.cursor()
    cur.execute(f"CREATE DATABASE IF NOT EXISTS `{config.MYSQL_DB}` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci")
    cur.close()
    conn.close()

def init():
    create_database()
    app = create_app()
    with app.app_context():
        db.create_all()
        if Category.query.count() == 0:
            for name in ['Electronics', 'Accessories', 'Office', 'Kitchen']:
                db.session.add(Category(name=name))
            db.session.commit()

        if not User.query.filter_by(username='admin').first():
            admin = User(
                username='admin',
                password='admin',
                role='admin',
                email='admin@inventorypro.com'
            )
            db.session.add(admin)
            db.session.commit()
            print("Default admin created: admin / admin")

if __name__ == '__main__':
    init()