from app import app, db
from models import User, Board, List, Card, BoardMember

with app.app_context():
    # Drop all tables
    db.drop_all()
    
    # Create all tables
    db.create_all()
    
    print("Database reset successfully!")