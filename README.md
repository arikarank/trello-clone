# TaskHive

A full-featured TaskHive application built with Flask, providing a kanban-style project management application with boards, lists, cards, and collaborative features.

## Features

### Core Functionality
- **User Authentication**: Secure user registration and login system
- **Boards**: Create and manage multiple project boards
- **Lists**: Organize tasks into customizable lists within boards
- **Cards**: Create detailed task cards with descriptions and due dates
- **Drag & Drop**: Intuitive card and list management

### Collaboration
- **Board Members**: Invite users to collaborate on boards
- **Member Management**: Add and remove board members (owner-only)
- **User Search**: Search for users by username or email

### Card Features
- **File Attachments**: Upload and manage files on cards (up to 16MB)
  - Supports: documents, images, videos, archives, and more
  - File type icons for easy identification
- **Checklists**: Create checklists with multiple items
  - Track completion progress
  - Mark items as complete/incomplete
- **Labels**: Create and assign color-coded labels to cards
  - Custom label names and colors
  - Filter and organize cards by labels
- **Due Dates**: Set and track due dates for cards

### Search
- **Global Search**: Search across all accessible boards
- **Board-Specific Search**: Search within a specific board
- **Search Scope**: Searches cards, boards, labels, and checklist items

## Tech Stack

- **Backend**: Flask 3.1.2
- **Database**: SQLite (SQLAlchemy ORM)
- **Authentication**: Flask-Login
- **Frontend**: HTML, CSS, JavaScript
- **File Handling**: Werkzeug

## Installation

### Prerequisites
- Python 3.7 or higher
- pip (Python package manager)

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd taskhive
   ```

2. **Create a virtual environment** (recommended)
   ```bash
   python -m venv venv
   
   # On Windows
   venv\Scripts\activate
   
   # On macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Initialize the database**
   ```bash
   python app.py
   ```
   The database will be automatically created on first run.

5. **Run the application**
   ```bash
   python app.py
   ```

6. **Access the application**
   Open your browser and navigate to `http://localhost:5000`

## Configuration

### Environment Variables
The application uses default configuration. For production, consider:

- **SECRET_KEY**: Change the secret key in `app.py` (line 10) for security
- **DATABASE_URI**: Modify SQLite database path if needed (line 11)
- **UPLOAD_FOLDER**: File upload directory (default: `uploads/`)
- **MAX_FILE_SIZE**: Maximum file upload size (default: 16MB)

### File Upload Settings
- **Allowed Extensions**: txt, pdf, png, jpg, jpeg, gif, doc, docx, xls, xlsx, ppt, pptx, zip, rar, mp4, mp3, avi, mov, wav
- **Max File Size**: 16MB

## Project Structure

```
taskhive/
├── app.py                 # Main Flask application
├── models.py              # Database models
├── requirements.txt       # Python dependencies
├── reset_db.py           # Database reset utility
├── uploads/              # File upload directory
├── static/
│   ├── style.css         # Stylesheet
│   └── script.js         # Frontend JavaScript
└── templates/
    ├── base.html         # Base template
    ├── index.html        # Landing page
    ├── login.html        # Login page
    ├── register.html     # Registration page
    └── board.html       # Board dashboard
```

## Usage

### Getting Started

1. **Register an Account**
   - Navigate to the registration page
   - Create a username, email, and password
   - You'll be automatically logged in after registration

2. **Create a Board**
   - After logging in, you'll see your dashboard
   - Create a new board with a title

3. **Add Lists**
   - Open a board
   - Create lists to organize your tasks (e.g., "To Do", "In Progress", "Done")

4. **Create Cards**
   - Add cards to lists
   - Click on cards to add descriptions, due dates, attachments, checklists, and labels

5. **Collaborate**
   - As a board owner, invite other users by username
   - Collaborators can view and edit boards they're members of

## API Endpoints

### Authentication
- `GET /` - Landing page
- `GET /register` - Registration page
- `POST /register` - Create new user
- `GET /login` - Login page
- `POST /login` - Authenticate user
- `GET /logout` - Logout user
- `GET /dashboard` - User dashboard

### Boards
- `POST /api/boards` - Create a new board
- `GET /api/boards/<id>` - Get board details
- `DELETE /api/boards/<id>` - Delete board (owner only)

### Board Members
- `GET /api/boards/<id>/members` - Get board members
- `POST /api/boards/<id>/members` - Add member to board
- `DELETE /api/boards/<id>/members/<user_id>` - Remove member from board

### Lists
- `POST /api/boards/<id>/lists` - Create a new list
- `DELETE /api/lists/<id>` - Delete a list

### Cards
- `POST /api/lists/<id>/cards` - Create a new card
- `GET /api/cards/<id>` - Get card details
- `PUT /api/cards/<id>` - Update card
- `DELETE /api/cards/<id>` - Delete card

### File Attachments
- `POST /api/cards/<id>/attachments` - Upload file to card
- `GET /api/cards/<id>/attachments` - Get card attachments
- `GET /api/attachments/<id>/download` - Download attachment
- `DELETE /api/attachments/<id>` - Delete attachment

### Checklists
- `POST /api/cards/<id>/checklists` - Create checklist
- `PUT /api/checklists/<id>` - Update checklist
- `DELETE /api/checklists/<id>` - Delete checklist
- `POST /api/checklists/<id>/items` - Add checklist item
- `PUT /api/checklist-items/<id>` - Update checklist item
- `DELETE /api/checklist-items/<id>` - Delete checklist item

### Labels
- `POST /api/boards/<id>/labels` - Create label
- `GET /api/boards/<id>/labels` - Get board labels
- `PUT /api/labels/<id>` - Update label
- `DELETE /api/labels/<id>` - Delete label
- `POST /api/cards/<id>/labels/<label_id>` - Add label to card
- `DELETE /api/cards/<id>/labels/<label_id>` - Remove label from card

### Search
- `GET /api/search?q=<query>` - Global search
- `GET /api/boards/<id>/search?q=<query>` - Search within board
- `GET /api/users/search?q=<query>` - Search users

## Database Models

- **User**: User accounts with authentication
- **Board**: Project boards with owner and members
- **BoardMember**: Many-to-many relationship for board collaboration
- **List**: Lists within boards
- **Card**: Task cards with descriptions and due dates
- **FileAttachment**: File attachments on cards
- **Checklist**: Checklists on cards
- **ChecklistItem**: Individual checklist items
- **Label**: Color-coded labels for cards
- **card_labels**: Association table for card-label relationships

## Security Features

- Password hashing using Werkzeug
- Session-based authentication
- Access control for boards (owner and members only)
- File upload validation (type and size)
- Secure filename handling

## Development

### Running in Debug Mode
The application runs in debug mode by default. For production, set `debug=False` in `app.py`:

```python
app.run(debug=False)
```

### Resetting the Database
If you need to reset the database, you can use the `reset_db.py` script (if available) or delete the `instance/taskhive.db` file and restart the application.

## License

This project is open source and available for educational purposes.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Notes

- The application uses SQLite for simplicity. For production, consider using PostgreSQL or MySQL
- File uploads are stored locally in the `uploads/` directory
- The secret key should be changed for production deployments
- Debug mode should be disabled in production environments
