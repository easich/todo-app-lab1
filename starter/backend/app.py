"""
Todo Application - Flask Backend
A RESTful API for managing todo items with full CRUD operations.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from models import Todo
from database import db, init_db
from datetime import datetime

app = Flask(__name__)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///todos.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Enable CORS for frontend communication
CORS(app)

# Initialize database
init_db(app)


@app.route('/api/todos', methods=['GET'])
def get_todos():
    """
    Get all todos

    Returns:
        JSON array of all todo items ordered newest first
    """
    try:
        todos = Todo.query.order_by(Todo.created_at.desc()).all()
        return jsonify([todo.to_dict() for todo in todos]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/todos/<int:todo_id>', methods=['GET'])
def get_todo(todo_id):
    """
    Get a specific todo by ID

    Args:
        todo_id: The ID of the todo to retrieve

    Returns:
        JSON object of the todo item, or 404 if not found
    """
    todo = db.session.get(Todo, todo_id)
    if todo is None:
        return jsonify({'error': 'Todo not found'}), 404
    return jsonify(todo.to_dict()), 200


@app.route('/api/todos', methods=['POST'])
def create_todo():
    """
    Create a new todo

    Expected JSON body:
        {
            "title": "Todo title",
            "description": "Optional description"
        }

    Returns:
        JSON object of the created todo, or 400 on invalid input
    """
    data = request.get_json()

    # Reject missing or non-JSON body
    if not data:
        return jsonify({'error': 'Title is required'}), 400

    # Reject missing or blank title
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Title is required'}), 400

    try:
        todo = Todo(
            title=title,
            description=data.get('description', ''),
            completed=False
        )
        db.session.add(todo)
        db.session.commit()
        return jsonify(todo.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/todos/<int:todo_id>', methods=['PUT'])
def update_todo(todo_id):
    """
    Update an existing todo

    Args:
        todo_id: The ID of the todo to update

    Expected JSON body (all fields optional):
        {
            "title": "Updated title",
            "description": "Updated description",
            "completed": true
        }

    Returns:
        JSON object of the updated todo, or 404 if not found
    """
    todo = db.session.get(Todo, todo_id)
    if todo is None:
        return jsonify({'error': 'Todo not found'}), 404

    data = request.get_json() or {}

    try:
        if 'title' in data:
            todo.title = data['title']
        if 'description' in data:
            todo.description = data['description']
        if 'completed' in data:
            todo.completed = data['completed']

        db.session.commit()
        return jsonify(todo.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/todos/<int:todo_id>', methods=['DELETE'])
def delete_todo(todo_id):
    """
    Delete a todo

    Args:
        todo_id: The ID of the todo to delete

    Returns:
        Success message, or 404 if not found
    """
    todo = db.session.get(Todo, todo_id)
    if todo is None:
        return jsonify({'error': 'Todo not found'}), 404

    try:
        db.session.delete(todo)
        db.session.commit()
        return jsonify({'message': 'Todo deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Health check endpoint

    Returns:
        Status of the API
    """
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat()
    }), 200


if __name__ == '__main__':
    # Create tables if they don't exist
    with app.app_context():
        db.create_all()

    # Run the application
    app.run(debug=True, host='0.0.0.0', port=5000)

# Made with Bob
