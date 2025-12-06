from flask import Flask, render_template, request, jsonify, redirect, url_for, send_file
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from models import (
    db,
    User,
    Board,
    List,
    Card,
    BoardMember,
    FileAttachment,
    Checklist,
    ChecklistItem,
    Label,
    card_labels,
)
from datetime import datetime
import os
import uuid
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///trello.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Configuration for file uploads
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {
    'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx',
    'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar', 'mp4', 'mp3', 'avi', 'mov', 'wav'
}
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB

# Ensure upload directory exists
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

db.init_app(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


def allowed_file(filename):
    return '.' in filename and \
        filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def get_file_icon(mime_type, filename):
    """Return appropriate icon based on file type"""
    extension = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''

    icon_map = {
        'pdf': '📕',
        'doc': '📘', 'docx': '📘',
        'xls': '📗', 'xlsx': '📗',
        'ppt': '📙', 'pptx': '📙',
        'txt': '📄',
        'zip': '📦', 'rar': '📦',
        'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️',
        'mp4': '🎬', 'avi': '🎬', 'mov': '🎬',
        'mp3': '🎵', 'wav': '🎵'
    }

    return icon_map.get(extension, '📎')  # Default paperclip icon


def has_board_access(board_id, user_id):
    try:
        board = Board.query.get(board_id)
        if not board:
            return False

        # User is owner
        if board.user_id == user_id:
            return True

        # User is member
        member = BoardMember.query.filter_by(board_id=board_id, user_id=user_id).first()
        return member is not None
    except Exception as e:
        print(f"DEBUG: Error in has_board_access: {str(e)}")
        return False


@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return render_template('index.html')


@app.route('/dashboard')
@login_required
def dashboard():
    # Get boards where user is owner or member
    owned_boards = Board.query.filter_by(user_id=current_user.id).all()
    member_boards = Board.query.join(BoardMember).filter(
        BoardMember.user_id == current_user.id
    ).all()

    all_boards = owned_boards + member_boards
    return render_template('board.html', boards=all_boards)


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']

        if User.query.filter_by(username=username).first():
            return render_template('register.html', error='Username already exists')

        if User.query.filter_by(email=email).first():
            return render_template('register.html', error='Email already exists')

        user = User(username=username, email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        login_user(user)
        return redirect(url_for('dashboard'))

    return render_template('register.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = User.query.filter_by(username=username).first()

        if user and user.check_password(password):
            login_user(user)
            return redirect(url_for('dashboard'))

        return render_template('login.html', error='Invalid credentials')

    return render_template('login.html')


@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))


# API Routes
@app.route('/api/boards', methods=['POST'])
@login_required
def create_board():
    data = request.get_json()
    board = Board(title=data['title'], user_id=current_user.id)
    db.session.add(board)
    db.session.commit()
    return jsonify({'id': board.id, 'title': board.title})


# UPDATED get_board (single version, includes labels + attachments)
@app.route('/api/boards/<int:board_id>')
@login_required
def get_board(board_id):
    try:
        print(f"DEBUG: Fetching board {board_id} for user {current_user.id}")

        if not has_board_access(board_id, current_user.id):
            print(f"DEBUG: Access denied for user {current_user.id} to board {board_id}")
            return jsonify({'error': 'Access denied'}), 403

        board = Board.query.get(board_id)
        if not board:
            print(f"DEBUG: Board {board_id} not found")
            return jsonify({'error': 'Board not found'}), 404

        print(f"DEBUG: Board found - Title: {board.title}, Owner: {board.user_id}")

        # Get board owner info
        owner = User.query.get(board.user_id)
        if not owner:
            print(f"DEBUG: Owner {board.user_id} not found for board {board_id}")
            return jsonify({'error': 'Board owner not found'}), 500

        # Get board members
        members = BoardMember.query.filter_by(board_id=board_id).all()
        member_data = []
        for member in members:
            user = User.query.get(member.user_id)
            if user:
                member_data.append({
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'role': member.role
                })
            else:
                print(f"DEBUG: Member user {member.user_id} not found")

        # Get board data with lists and cards
        board_data = {
            'id': board.id,
            'title': board.title,
            'description': board.description,
            'owner': {
                'id': owner.id,
                'username': owner.username
            },
            'is_owner': board.user_id == current_user.id,
            'members': member_data,
            'lists': []
        }

        # Order lists by position
        lists = List.query.filter_by(board_id=board_id).order_by(List.position).all()
        print(f"DEBUG: Found {len(lists)} lists for board {board_id}")

        for list_item in lists:
            list_data = {
                'id': list_item.id,
                'title': list_item.title,
                'position': list_item.position,
                'cards': []
            }

            # Order cards by position
            cards = Card.query.filter_by(list_id=list_item.id).order_by(Card.position).all()
            print(f"DEBUG: Found {len(cards)} cards for list {list_item.id}")

            for card in cards:
                card_creator = User.query.get(card.created_by)
                if not card_creator:
                    print(f"DEBUG: Card creator {card.created_by} not found for card {card.id}")
                    continue

                # Get labels for this card
                labels_data = []
                for label in card.labels:
                    labels_data.append({
                        'id': label.id,
                        'name': label.name,
                        'color': label.color
                    })

                # Get attachments for this card
                attachments = FileAttachment.query.filter_by(card_id=card.id).all()
                attachments_data = []
                for attachment in attachments:
                    uploader = User.query.get(attachment.uploaded_by)
                    if uploader:
                        attachments_data.append({
                            'id': attachment.id,
                            'filename': attachment.original_filename,
                            'file_size': attachment.file_size,
                            'mime_type': attachment.mime_type,
                            'uploaded_at': attachment.uploaded_at.isoformat(),
                            'uploaded_by': {
                                'id': uploader.id,
                                'username': uploader.username
                            },
                            'icon': get_file_icon(attachment.mime_type, attachment.original_filename),
                            'download_url': f"/api/attachments/{attachment.id}/download"
                        })

                card_data = {
                    'id': card.id,
                    'title': card.title,
                    'description': card.description,
                    'position': card.position,
                    'due_date': card.due_date.isoformat() if card.due_date else None,
                    'created_by': {
                        'id': card_creator.id,
                        'username': card_creator.username
                    },
                    'labels': labels_data,
                    'attachments': attachments_data
                }
                list_data['cards'].append(card_data)

            board_data['lists'].append(list_data)

        print(f"DEBUG: Successfully returning board data with {len(board_data['lists'])} lists")
        return jsonify(board_data)

    except Exception as e:
        print(f"DEBUG: Error in get_board: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500


@app.route('/api/boards/<int:board_id>/members', methods=['GET'])
@login_required
def get_board_members(board_id):
    if not has_board_access(board_id, current_user.id):
        return jsonify({'error': 'Access denied'}), 403

    members = BoardMember.query.filter_by(board_id=board_id).all()
    member_data = []
    for member in members:
        user = User.query.get(member.user_id)
        member_data.append({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': member.role,
            'joined_at': member.joined_at.isoformat()
        })

    return jsonify(member_data)


@app.route('/api/boards/<int:board_id>/members', methods=['POST'])
@login_required
def add_board_member(board_id):
    try:
        # Check if current user is board owner
        board = Board.query.get_or_404(board_id)
        if board.user_id != current_user.id:
            return jsonify({'error': 'Only board owner can add members'}), 403

        data = request.get_json()
        username = data.get('username')

        # Find user by username
        user = User.query.filter_by(username=username).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Check if user is already a member
        existing_member = BoardMember.query.filter_by(board_id=board_id, user_id=user.id).first()
        if existing_member:
            return jsonify({'error': 'User is already a member of this board'}), 400

        # Add user as member
        member = BoardMember(board_id=board_id, user_id=user.id, role='member')
        db.session.add(member)
        db.session.commit()

        return jsonify({
            'message': 'User added to board',
            'member': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': 'member'
            }
        })

    except Exception as e:
        print(f"DEBUG: Error adding board member: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/boards/<int:board_id>/members/<int:user_id>', methods=['DELETE'])
@login_required
def remove_board_member(board_id, user_id):
    try:
        # Check if current user is board owner
        board = Board.query.get_or_404(board_id)
        if board.user_id != current_user.id:
            return jsonify({'error': 'Only board owner can remove members'}), 403

        # Cannot remove owner
        if user_id == board.user_id:
            return jsonify({'error': 'Cannot remove board owner'}), 400

        member = BoardMember.query.filter_by(board_id=board_id, user_id=user_id).first()
        if not member:
            return jsonify({'error': 'User is not a member of this board'}), 404

        db.session.delete(member)
        db.session.commit()

        return jsonify({'message': 'User removed from board'})

    except Exception as e:
        print(f"DEBUG: Error removing board member: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/boards/<int:board_id>/lists', methods=['POST'])
@login_required
def create_list(board_id):
    try:
        if not has_board_access(board_id, current_user.id):
            return jsonify({'error': 'Access denied'}), 403

        data = request.get_json()
        list_item = List(title=data['title'], board_id=board_id)
        db.session.add(list_item)
        db.session.commit()

        return jsonify({
            'id': list_item.id,
            'title': list_item.title,
            'position': list_item.position,
            'cards': []
        })

    except Exception as e:
        print(f"DEBUG: Error creating list: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/lists/<int:list_id>/cards', methods=['POST'])
@login_required
def create_card(list_id):
    try:
        list_item = List.query.get_or_404(list_id)

        if not has_board_access(list_item.board_id, current_user.id):
            return jsonify({'error': 'Access denied'}), 403

        data = request.get_json()
        card = Card(
            title=data['title'],
            list_id=list_id,
            description=data.get('description', ''),
            created_by=current_user.id
        )
        db.session.add(card)
        db.session.commit()

        card_creator = User.query.get(card.created_by)

        return jsonify({
            'id': card.id,
            'title': card.title,
            'description': card.description,
            'position': card.position,
            'created_by': {
                'id': card_creator.id,
                'username': card_creator.username
            }
        })

    except Exception as e:
        print(f"DEBUG: Error creating card: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/cards/<int:card_id>', methods=['PUT'])
@login_required
def update_card(card_id):
    try:
        card = Card.query.get_or_404(card_id)

        if not has_board_access(card.list.board_id, current_user.id):
            return jsonify({'error': 'Access denied'}), 403

        data = request.get_json()

        print(f"DEBUG: Updating card {card_id} with data:", data)

        if 'title' in data:
            card.title = data['title']
        if 'description' in data:
            card.description = data['description']
        if 'list_id' in data:
            # Verify the target list belongs to the same board
            target_list = List.query.get_or_404(data['list_id'])
            if target_list.board_id != card.list.board_id:
                return jsonify({'error': 'Cannot move card to different board'}), 400
            card.list_id = data['list_id']
        if 'position' in data:
            card.position = data['position']
        if 'due_date' in data:
            if data['due_date']:
                card.due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
            else:
                card.due_date = None

        db.session.commit()

        card_creator = User.query.get(card.created_by)

        # Return updated card data
        card_data = {
            'id': card.id,
            'title': card.title,
            'description': card.description,
            'due_date': card.due_date.isoformat() if card.due_date else None,
            'position': card.position,
            'list_id': card.list_id,
            'created_by': {
                'id': card_creator.id,
                'username': card_creator.username
            }
        }

        return jsonify(card_data)

    except Exception as e:
        print(f"DEBUG: Error updating card: {str(e)}")
        return jsonify({'error': str(e)}), 500


# FINAL unified get_card (with attachments + checklists + labels)
@app.route('/api/cards/<int:card_id>')
@login_required
def get_card(card_id):
    try:
        card = Card.query.get_or_404(card_id)

        if not has_board_access(card.list.board_id, current_user.id):
            return jsonify({'error': 'Access denied'}), 403

        card_creator = User.query.get(card.created_by)

        # Get attachments for this card
        attachments = FileAttachment.query.filter_by(card_id=card_id).all()
        attachments_data = []
        for attachment in attachments:
            uploader = User.query.get(attachment.uploaded_by)
            attachments_data.append({
                'id': attachment.id,
                'filename': attachment.original_filename,
                'file_size': attachment.file_size,
                'mime_type': attachment.mime_type,
                'uploaded_at': attachment.uploaded_at.isoformat(),
                'uploaded_by': {
                    'id': uploader.id,
                    'username': uploader.username
                },
                'icon': get_file_icon(attachment.mime_type, attachment.original_filename),
                'download_url': f"/api/attachments/{attachment.id}/download"
            })

        # Get checklists for this card
        checklists = Checklist.query.filter_by(card_id=card_id).order_by(Checklist.position).all()
        checklists_data = []
        for checklist in checklists:
            items = ChecklistItem.query.filter_by(checklist_id=checklist.id).order_by(
                ChecklistItem.position
            ).all()
            items_data = []
            completed_count = 0

            for item in items:
                if item.is_completed:
                    completed_count += 1
                items_data.append({
                    'id': item.id,
                    'text': item.text,
                    'is_completed': item.is_completed,
                    'position': item.position,
                    'created_at': item.created_at.isoformat(),
                    'completed_at': item.completed_at.isoformat() if item.completed_at else None
                })

            progress = (completed_count / len(items)) * 100 if items else 0

            checklists_data.append({
                'id': checklist.id,
                'title': checklist.title,
                'position': checklist.position,
                'items': items_data,
                'progress': round(progress),
                'completed_count': completed_count,
                'total_count': len(items)
            })

        # Get labels for this card
        labels_data = []
        for label in card.labels:
            labels_data.append({
                'id': label.id,
                'name': label.name,
                'color': label.color,
                'board_id': label.board_id
            })

        card_data = {
            'id': card.id,
            'title': card.title,
            'description': card.description,
            'due_date': card.due_date.isoformat() if card.due_date else None,
            'position': card.position,
            'list_id': card.list_id,
            'created_by': {
                'id': card_creator.id,
                'username': card_creator.username
            },
            'created_at': card.created_at.isoformat(),
            'attachments': attachments_data,
            'checklists': checklists_data,
            'labels': labels_data
        }

        return jsonify(card_data)

    except Exception as e:
        print(f"DEBUG: Error getting card: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/cards/<int:card_id>', methods=['DELETE'])
@login_required
def delete_card(card_id):
    card = Card.query.get_or_404(card_id)

    if not has_board_access(card.list.board_id, current_user.id):
        return jsonify({'error': 'Access denied'}), 403

    db.session.delete(card)
    db.session.commit()
    return jsonify({'message': 'Card deleted'})


@app.route('/api/lists/<int:list_id>', methods=['DELETE'])
@login_required
def delete_list(list_id):
    list_item = List.query.get_or_404(list_id)

    if not has_board_access(list_item.board_id, current_user.id):
        return jsonify({'error': 'Access denied'}), 403

    db.session.delete(list_item)
    db.session.commit()
    return jsonify({'message': 'List deleted'})


@app.route('/api/boards/<int:board_id>', methods=['DELETE'])
@login_required
def delete_board(board_id):
    board = Board.query.get_or_404(board_id)

    # Only owner can delete board
    if board.user_id != current_user.id:
        return jsonify({'error': 'Only board owner can delete the board'}), 403

    db.session.delete(board)
    db.session.commit()
    return jsonify({'message': 'Board deleted'})


# File Attachment Routes
@app.route('/api/cards/<int:card_id>/attachments', methods=['POST'])
@login_required
def upload_file(card_id):
    try:
        # Check if card exists and user has access
        card = Card.query.get_or_404(card_id)
        if not has_board_access(card.list.board_id, current_user.id):
            return jsonify({'error': 'Access denied'}), 403

        # Check if file was uploaded
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']

        # Check if file was selected
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Check file size
        file.seek(0, os.SEEK_END)
        file_length = file.tell()
        file.seek(0)

        if file_length > MAX_FILE_SIZE:
            return jsonify({'error': f'File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB'}), 400

        # Check file extension
        if file and allowed_file(file.filename):
            # Generate unique filename
            filename = secure_filename(file.filename)
            unique_filename = f"{uuid.uuid4().hex}_{filename}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)

            # Save file
            file.save(file_path)

            # Create file attachment record
            attachment = FileAttachment(
                filename=unique_filename,
                original_filename=filename,
                file_path=file_path,
                file_size=file_length,
                mime_type=file.mimetype,
                card_id=card_id,
                uploaded_by=current_user.id
            )

            db.session.add(attachment)
            db.session.commit()

            # Get uploader info
            uploader = User.query.get(attachment.uploaded_by)

            return jsonify({
                'id': attachment.id,
                'filename': attachment.original_filename,
                'file_size': attachment.file_size,
                'mime_type': attachment.mime_type,
                'uploaded_at': attachment.uploaded_at.isoformat(),
                'uploaded_by': {
                    'id': uploader.id,
                    'username': uploader.username
                },
                'icon': get_file_icon(attachment.mime_type, attachment.original_filename),
                'download_url': f"/api/attachments/{attachment.id}/download"
            })
        else:
            return jsonify({'error': 'File type not allowed'}), 400

    except Exception as e:
        print(f"DEBUG: Error uploading file: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/cards/<int:card_id>/attachments', methods=['GET'])
@login_required
def get_card_attachments(card_id):
    try:
        # Check if card exists and user has access
        card = Card.query.get_or_404(card_id)
        if not has_board_access(card.list.board_id, current_user.id):
            return jsonify({'error': 'Access denied'}), 403

        attachments = FileAttachment.query.filter_by(card_id=card_id).order_by(
            FileAttachment.uploaded_at.desc()
        ).all()

        attachments_data = []
        for attachment in attachments:
            uploader = User.query.get(attachment.uploaded_by)
            attachments_data.append({
                'id': attachment.id,
                'filename': attachment.original_filename,
                'file_size': attachment.file_size,
                'mime_type': attachment.mime_type,
                'uploaded_at': attachment.uploaded_at.isoformat(),
                'uploaded_by': {
                    'id': uploader.id,
                    'username': uploader.username
                },
                'icon': get_file_icon(attachment.mime_type, attachment.original_filename),
                'download_url': f"/api/attachments/{attachment.id}/download"
            })

        return jsonify(attachments_data)

    except Exception as e:
        print(f"DEBUG: Error getting attachments: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/attachments/<int:attachment_id>/download')
@login_required
def download_file(attachment_id):
    try:
        attachment = FileAttachment.query.get_or_404(attachment_id)

        # Check if user has access to the card
        if not has_board_access(attachment.card.list.board_id, current_user.id):
            return jsonify({'error': 'Access denied'}), 403

        # Check if file exists
        if not os.path.exists(attachment.file_path):
            return jsonify({'error': 'File not found'}), 404

        return send_file(
            attachment.file_path,
            as_attachment=True,
            download_name=attachment.original_filename,
            mimetype=attachment.mime_type
        )

    except Exception as e:
        print(f"DEBUG: Error downloading file: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/attachments/<int:attachment_id>', methods=['DELETE'])
@login_required
def delete_attachment(attachment_id):
    try:
        attachment = FileAttachment.query.get_or_404(attachment_id)

        # Check if user has access to the card or is the uploader
        if not has_board_access(attachment.card.list.board_id, current_user.id):
            return jsonify({'error': 'Access denied'}), 403

        # Get file path before deleting the record
        file_path = attachment.file_path

        # Delete the database record
        db.session.delete(attachment)
        db.session.commit()

        # Delete the physical file
        if os.path.exists(file_path):
            os.remove(file_path)

        return jsonify({'message': 'File deleted successfully'})

    except Exception as e:
        print(f"DEBUG: Error deleting attachment: {str(e)}")
        return jsonify({'error': str(e)}), 500


# User Search Route (autocomplete)
@app.route('/api/users/search')
@login_required
def search_users():
    query = request.args.get('q', '')
    if len(query) < 2:
        return jsonify([])

    users = User.query.filter(
        User.username.ilike(f'%{query}%') |
        User.email.ilike(f'%{query}%')
    ).limit(10).all()

    user_data = [{
        'id': user.id,
        'username': user.username,
        'email': user.email
    } for user in users]

    return jsonify(user_data)


# Checklist Routes
@app.route('/api/cards/<int:card_id>/checklists', methods=['POST'])
@login_required
def create_checklist(card_id):
    try:
        # Check if card exists and user has access
        card = Card.query.get_or_404(card_id)
        if not has_board_access(card.list.board_id, current_user.id):
            return jsonify({'error': 'Access denied'}), 403

        data = request.get_json()
        title = data.get('title', 'Checklist')

        checklist = Checklist(
            title=title,
            card_id=card_id
        )
        db.session.add(checklist)
        db.session.commit()

        return jsonify({
            'id': checklist.id,
            'title': checklist.title,
            'position': checklist.position,
            'items': [],
            'progress': 0
        })

    except Exception as e:
        print(f"DEBUG: Error creating checklist: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/checklists/<int:checklist_id>', methods=['PUT'])
@login_required
def update_checklist(checklist_id):
    try:
        checklist = Checklist.query.get_or_404(checklist_id)

        # Check if user has access to the card
        if not has_board_access(checklist.card.list.board_id, current_user.id):
            return jsonify({'error': 'Access denied'}), 403

        data = request.get_json()

        if 'title' in data:
            checklist.title = data['title']

        db.session.commit()

        return jsonify({
            'id': checklist.id,
            'title': checklist.title,
            'position': checklist.position
        })

    except Exception as e:
        print(f"DEBUG: Error updating checklist: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/checklists/<int:checklist_id>', methods=['DELETE'])
@login_required
def delete_checklist(checklist_id):
    try:
        checklist = Checklist.query.get_or_404(checklist_id)

        # Check if user has access to the card
        if not has_board_access(checklist.card.list.board_id, current_user.id):
            return jsonify({'error': 'Access denied'}), 403

        db.session.delete(checklist)
        db.session.commit()

        return jsonify({'message': 'Checklist deleted successfully'})

    except Exception as e:
        print(f"DEBUG: Error deleting checklist: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/checklists/<int:checklist_id>/items', methods=['POST'])
@login_required
def create_checklist_item(checklist_id):
    try:
        checklist = Checklist.query.get_or_404(checklist_id)

        # Check if user has access to the card
        if not has_board_access(checklist.card.list.board_id, current_user.id):
            return jsonify({'error': 'Access denied'}), 403

        data = request.get_json()
        text = data.get('text', '').strip()

        if not text:
            return jsonify({'error': 'Item text is required'}), 400

        # Get the next position
        last_item = ChecklistItem.query.filter_by(checklist_id=checklist_id).order_by(
            ChecklistItem.position.desc()
        ).first()
        next_position = last_item.position + 1 if last_item else 0

        item = ChecklistItem(
            text=text,
            checklist_id=checklist_id,
            position=next_position
        )
        db.session.add(item)
        db.session.commit()

        return jsonify({
            'id': item.id,
            'text': item.text,
            'is_completed': item.is_completed,
            'position': item.position,
            'created_at': item.created_at.isoformat()
        })

    except Exception as e:
        print(f"DEBUG: Error creating checklist item: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/checklist-items/<int:item_id>', methods=['PUT'])
@login_required
def update_checklist_item(item_id):
    try:
        item = ChecklistItem.query.get_or_404(item_id)

        # Check if user has access to the card
        if not has_board_access(item.checklist.card.list.board_id, current_user.id):
            return jsonify({'error': 'Access denied'}), 403

        data = request.get_json()

        if 'text' in data:
            item.text = data['text'].strip()
            if not item.text:
                return jsonify({'error': 'Item text cannot be empty'}), 400

        if 'is_completed' in data:
            item.is_completed = data['is_completed']
            item.completed_at = datetime.utcnow() if data['is_completed'] else None

        if 'position' in data:
            item.position = data['position']

        db.session.commit()

        return jsonify({
            'id': item.id,
            'text': item.text,
            'is_completed': item.is_completed,
            'position': item.position,
            'completed_at': item.completed_at.isoformat() if item.completed_at else None
        })

    except Exception as e:
        print(f"DEBUG: Error updating checklist item: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/checklist-items/<int:item_id>', methods=['DELETE'])
@login_required
def delete_checklist_item(item_id):
    try:
        item = ChecklistItem.query.get_or_404(item_id)

        # Check if user has access to the card
        if not has_board_access(item.checklist.card.list.board_id, current_user.id):
            return jsonify({'error': 'Access denied'}), 403

        db.session.delete(item)
        db.session.commit()

        return jsonify({'message': 'Checklist item deleted successfully'})

    except Exception as e:
        print(f"DEBUG: Error deleting checklist item: {str(e)}")
        return jsonify({'error': str(e)}), 500


# Label Routes
@app.route('/api/boards/<int:board_id>/labels', methods=['POST'])
@login_required
def create_label(board_id):
    try:
        # Check if user has access to the board
        if not has_board_access(board_id, current_user.id):
            return jsonify({'error': 'Access denied'}), 403

        data = request.get_json()
        name = data.get('name', '').strip()
        color = data.get('color', '#0079bf')

        if not name:
            return jsonify({'error': 'Label name is required'}), 400

        # Validate color format
        import re
        if not re.match(r'^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$', color):
            return jsonify({'error': 'Invalid color format'}), 400

        label = Label(
            name=name,
            color=color,
            board_id=board_id
        )
        db.session.add(label)
        db.session.commit()

        return jsonify({
            'id': label.id,
            'name': label.name,
            'color': label.color,
            'board_id': label.board_id,
            'created_at': label.created_at.isoformat()
        })

    except Exception as e:
        print(f"DEBUG: Error creating label: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/boards/<int:board_id>/labels', methods=['GET'])
@login_required
def get_board_labels(board_id):
    try:
        # Check if user has access to the board
        if not has_board_access(board_id, current_user.id):
            return jsonify({'error': 'Access denied'}), 403

        labels = Label.query.filter_by(board_id=board_id).order_by(Label.created_at).all()

        labels_data = []
        for label in labels:
            labels_data.append({
                'id': label.id,
                'name': label.name,
                'color': label.color,
                'board_id': label.board_id,
                'created_at': label.created_at.isoformat(),
                'card_count': len(label.cards)  # Count of cards with this label
            })

        return jsonify(labels_data)

    except Exception as e:
        print(f"DEBUG: Error getting board labels: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/labels/<int:label_id>', methods=['PUT'])
@login_required
def update_label(label_id):
    try:
        label = Label.query.get_or_404(label_id)

        # Check if user has access to the board
        if not has_board_access(label.board_id, current_user.id):
            return jsonify({'error': 'Access denied'}), 403

        data = request.get_json()

        if 'name' in data:
            name = data['name'].strip()
            if not name:
                return jsonify({'error': 'Label name cannot be empty'}), 400
            label.name = name

        if 'color' in data:
            color = data['color']
            import re
            if not re.match(r'^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$', color):
                return jsonify({'error': 'Invalid color format'}), 400
            label.color = color

        db.session.commit()

        return jsonify({
            'id': label.id,
            'name': label.name,
            'color': label.color,
            'board_id': label.board_id
        })

    except Exception as e:
        print(f"DEBUG: Error updating label: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/labels/<int:label_id>', methods=['DELETE'])
@login_required
def delete_label(label_id):
    try:
        label = Label.query.get_or_404(label_id)

        # Check if user has access to the board
        if not has_board_access(label.board_id, current_user.id):
            return jsonify({'error': 'Access denied'}), 403

        db.session.delete(label)
        db.session.commit()

        return jsonify({'message': 'Label deleted successfully'})

    except Exception as e:
        print(f"DEBUG: Error deleting label: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/cards/<int:card_id>/labels/<int:label_id>', methods=['POST'])
@login_required
def add_label_to_card(card_id, label_id):
    try:
        card = Card.query.get_or_404(card_id)
        label = Label.query.get_or_404(label_id)

        # Check if user has access to both card and label boards
        if (not has_board_access(card.list.board_id, current_user.id) or
                not has_board_access(label.board_id, current_user.id)):
            return jsonify({'error': 'Access denied'}), 403

        # Check if label already exists on card
        if label in card.labels:
            return jsonify({'error': 'Label already added to card'}), 400

        card.labels.append(label)
        db.session.commit()

        return jsonify({
            'message': 'Label added to card',
            'label': {
                'id': label.id,
                'name': label.name,
                'color': label.color
            }
        })

    except Exception as e:
        print(f"DEBUG: Error adding label to card: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/cards/<int:card_id>/labels/<int:label_id>', methods=['DELETE'])
@login_required
def remove_label_from_card(card_id, label_id):
    try:
        card = Card.query.get_or_404(card_id)
        label = Label.query.get_or_404(label_id)

        # Check if user has access to both card and label boards
        if (not has_board_access(card.list.board_id, current_user.id) or
                not has_board_access(label.board_id, current_user.id)):
            return jsonify({'error': 'Access denied'}), 403

        # Check if label exists on card
        if label not in card.labels:
            return jsonify({'error': 'Label not found on card'}), 404

        card.labels.remove(label)
        db.session.commit()

        return jsonify({'message': 'Label removed from card'})

    except Exception as e:
        print(f"DEBUG: Error removing label from card: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/cards/<int:card_id>/labels', methods=['GET'])
@login_required
def get_card_labels(card_id):
    try:
        card = Card.query.get_or_404(card_id)

        # Check if user has access to the card
        if not has_board_access(card.list.board_id, current_user.id):
            return jsonify({'error': 'Access denied'}), 403

        labels_data = []
        for label in card.labels:
            labels_data.append({
                'id': label.id,
                'name': label.name,
                'color': label.color,
                'board_id': label.board_id
            })

        return jsonify(labels_data)

    except Exception as e:
        print(f"DEBUG: Error getting card labels: {str(e)}")
        return jsonify({'error': str(e)}), 500


# Search helpers and routes
def get_highlighted_fields(item, query):
    """Determine which fields contain the search query"""
    highlighted = {}
    query_lower = query.lower()

    if hasattr(item, 'title') and item.title and query_lower in item.title.lower():
        highlighted['title'] = True

    if hasattr(item, 'description') and item.description and query_lower in item.description.lower():
        highlighted['description'] = True

    if hasattr(item, 'name') and item.name and query_lower in item.name.lower():
        highlighted['name'] = True

    return highlighted


@app.route('/api/search')
@login_required
def search():
    try:
        query = request.args.get('q', '').strip()
        if not query:
            return jsonify({'results': []})

        # Get all boards the user has access to
        owned_boards = Board.query.filter_by(user_id=current_user.id).all()
        member_boards = Board.query.join(BoardMember).filter(
            BoardMember.user_id == current_user.id
        ).all()
        all_boards = owned_boards + member_boards
        board_ids = [board.id for board in all_boards]

        if not board_ids:
            return jsonify({'results': []})

        search_results = {
            'cards': [],
            'boards': [],
            'total_results': 0
        }

        # Search in cards (title, description)
        card_results = Card.query.join(List).filter(
            List.board_id.in_(board_ids),
            db.or_(
                Card.title.ilike(f'%{query}%'),
                Card.description.ilike(f'%{query}%')
            )
        ).all()

        for card in card_results:
            card_creator = User.query.get(card.created_by)
            list_item = List.query.get(card.list_id)
            board = Board.query.get(list_item.board_id)

            # Get labels for this card
            labels_data = []
            for label in card.labels:
                labels_data.append({
                    'id': label.id,
                    'name': label.name,
                    'color': label.color
                })

            # Search in checklist items
            matching_checklist_items = []
            checklists = Checklist.query.filter_by(card_id=card.id).all()
            for checklist in checklists:
                items = ChecklistItem.query.filter_by(checklist_id=checklist.id).filter(
                    ChecklistItem.text.ilike(f'%{query}%')
                ).all()
                for item in items:
                    matching_checklist_items.append({
                        'checklist_title': checklist.title,
                        'item_text': item.text,
                        'is_completed': item.is_completed
                    })

            search_results['cards'].append({
                'id': card.id,
                'title': card.title,
                'description': card.description,
                'type': 'card',
                'board': {
                    'id': board.id,
                    'title': board.title
                },
                'list': {
                    'id': list_item.id,
                    'title': list_item.title
                },
                'created_by': {
                    'id': card_creator.id,
                    'username': card_creator.username
                },
                'labels': labels_data,
                'matching_checklist_items': matching_checklist_items,
                'due_date': card.due_date.isoformat() if card.due_date else None,
                'highlighted_fields': get_highlighted_fields(card, query)
            })

        # Search in boards (title, description)
        board_results = Board.query.filter(
            Board.id.in_(board_ids),
            db.or_(
                Board.title.ilike(f'%{query}%'),
                Board.description.ilike(f'%{query}%')
            )
        ).all()

        for board in board_results:
            owner = User.query.get(board.user_id)
            search_results['boards'].append({
                'id': board.id,
                'title': board.title,
                'description': board.description,
                'type': 'board',
                'owner': {
                    'id': owner.id,
                    'username': owner.username
                },
                'highlighted_fields': get_highlighted_fields(board, query)
            })

        # Search in labels
        label_results = Label.query.filter(
            Label.board_id.in_(board_ids),
            Label.name.ilike(f'%{query}%')
        ).all()

        for label in label_results:
            board = Board.query.get(label.board_id)
            # Find cards with this label that match the search
            matching_cards = Card.query.join(card_labels).join(List).filter(
                card_labels.c.label_id == label.id,
                List.board_id.in_(board_ids)
            ).all()

            for card in matching_cards:
                card_creator = User.query.get(card.created_by)
                search_results['cards'].append({
                    'id': card.id,
                    'title': card.title,
                    'description': card.description,
                    'type': 'card',
                    'board': {
                        'id': board.id,
                        'title': board.title
                    },
                    'list': {
                        'id': card.list.id,
                        'title': card.list.title
                    },
                    'created_by': {
                        'id': card_creator.id,
                        'username': card_creator.username
                    },
                    'labels': [{
                        'id': label.id,
                        'name': label.name,
                        'color': label.color
                    }],
                    'matching_checklist_items': [],
                    'due_date': card.due_date.isoformat() if card.due_date else None,
                    'highlighted_fields': {
                        'labels': [label.name]
                    },
                    'matched_via_label': True
                })

        # Remove duplicate cards
        seen_card_ids = set()
        unique_cards = []
        for card in search_results['cards']:
            if card['id'] not in seen_card_ids:
                seen_card_ids.add(card['id'])
                unique_cards.append(card)

        search_results['cards'] = unique_cards
        search_results['total_results'] = len(unique_cards) + len(search_results['boards'])

        return jsonify(search_results)

    except Exception as e:
        print(f"DEBUG: Error in search: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/boards/<int:board_id>/search')
@login_required
def search_in_board(board_id):
    try:
        # Check if user has access to the board
        if not has_board_access(board_id, current_user.id):
            return jsonify({'error': 'Access denied'}), 403

        query = request.args.get('q', '').strip()
        if not query:
            return jsonify({'results': []})

        search_results = {
            'cards': [],
            'total_results': 0
        }

        # Search in cards within this board
        card_results = Card.query.join(List).filter(
            List.board_id == board_id,
            db.or_(
                Card.title.ilike(f'%{query}%'),
                Card.description.ilike(f'%{query}%')
            )
        ).all()

        for card in card_results:
            card_creator = User.query.get(card.created_by)
            list_item = List.query.get(card.list_id)

            # Get labels for this card
            labels_data = []
            for label in card.labels:
                labels_data.append({
                    'id': label.id,
                    'name': label.name,
                    'color': label.color
                })

            # Search in checklist items
            matching_checklist_items = []
            checklists = Checklist.query.filter_by(card_id=card.id).all()
            for checklist in checklists:
                items = ChecklistItem.query.filter_by(checklist_id=checklist.id).filter(
                    ChecklistItem.text.ilike(f'%{query}%')
                ).all()
                for item in items:
                    matching_checklist_items.append({
                        'checklist_title': checklist.title,
                        'item_text': item.text,
                        'is_completed': item.is_completed
                    })

            search_results['cards'].append({
                'id': card.id,
                'title': card.title,
                'description': card.description,
                'type': 'card',
                'list': {
                    'id': list_item.id,
                    'title': list_item.title
                },
                'created_by': {
                    'id': card_creator.id,
                    'username': card_creator.username
                },
                'labels': labels_data,
                'matching_checklist_items': matching_checklist_items,
                'due_date': card.due_date.isoformat() if card.due_date else None,
                'highlighted_fields': get_highlighted_fields(card, query)
            })

        # Search in labels within this board
        label_results = Label.query.filter(
            Label.board_id == board_id,
            Label.name.ilike(f'%{query}%')
        ).all()

        for label in label_results:
            # Find cards with this label
            matching_cards = Card.query.join(card_labels).join(List).filter(
                card_labels.c.label_id == label.id,
                List.board_id == board_id
            ).all()

            for card in matching_cards:
                card_creator = User.query.get(card.created_by)
                list_item = List.query.get(card.list_id)

                search_results['cards'].append({
                    'id': card.id,
                    'title': card.title,
                    'description': card.description,
                    'type': 'card',
                    'list': {
                        'id': list_item.id,
                        'title': list_item.title
                    },
                    'created_by': {
                        'id': card_creator.id,
                        'username': card_creator.username
                    },
                    'labels': [{
                        'id': label.id,
                        'name': label.name,
                        'color': label.color
                    }],
                    'matching_checklist_items': [],
                    'due_date': card.due_date.isoformat() if card.due_date else None,
                    'highlighted_fields': {
                        'labels': [label.name]
                    },
                    'matched_via_label': True
                })

        # Remove duplicate cards
        seen_card_ids = set()
        unique_cards = []
        for card in search_results['cards']:
            if card['id'] not in seen_card_ids:
                seen_card_ids.add(card['id'])
                unique_cards.append(card)

        search_results['cards'] = unique_cards
        search_results['total_results'] = len(unique_cards)

        return jsonify(search_results)

    except Exception as e:
        print(f"DEBUG: Error in board search: {str(e)}")
        return jsonify({'error': str(e)}), 500


# Final app entrypoint (moved to bottom)
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
