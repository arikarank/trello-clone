document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - initializing Trello Clone');
    initializeModals();
    initializeBoardEvents();
    initializeFormSubmissions();
    initializeSearch(); // Initialize search functionality
});

function initializeModals() {
    console.log('Initializing modals');
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.close');
    
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            modals.forEach(modal => modal.style.display = 'none');
        });
    });
    
    window.addEventListener('click', function(event) {
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}

function initializeBoardEvents() {
    console.log('Initializing board events');
    
    // Create Board Button
    const createBoardBtn = document.getElementById('create-board-btn');
    const createBoardModal = document.getElementById('create-board-modal');
    
    if (createBoardBtn && createBoardModal) {
        createBoardBtn.addEventListener('click', function() {
            console.log('Create board button clicked');
            createBoardModal.style.display = 'block';
        });
    }
    
    // Open Board Buttons
    document.querySelectorAll('.btn-open-board').forEach(button => {
        button.addEventListener('click', function() {
            const boardId = this.getAttribute('data-board-id');
            console.log('Open board button clicked for board:', boardId);
            openBoard(boardId);
        });
    });
    
    // Delete Board Buttons
    document.querySelectorAll('.btn-delete-board').forEach(button => {
        button.addEventListener('click', function() {
            const boardId = this.getAttribute('data-board-id');
            console.log('Delete board button clicked for board:', boardId);
            deleteBoard(boardId);
        });
    });
}

function initializeFormSubmissions() {
    console.log('Initializing form submissions');
    
    // Create Board Form
    const createBoardForm = document.getElementById('create-board-form');
    if (createBoardForm) {
        createBoardForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log('Create board form submitted');
            createBoard();
        });
    }
    
    // Member Search
    const memberSearch = document.getElementById('member-search');
    if (memberSearch) {
        let searchTimeout;
        memberSearch.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                document.getElementById('user-search-results').innerHTML = '';
                return;
            }
            
            searchTimeout = setTimeout(() => {
                searchUsers(query);
            }, 300);
        });
    }
}

// Global variable to track current board
let currentBoardId = null;
let currentBoardData = null;
let draggedCard = null;
let draggedList = null;
let dragStartX = 0;
let dragStartY = 0;

function openBoard(boardId) {
    console.log('Opening board:', boardId);
    currentBoardId = boardId;
    
    const boardModal = document.getElementById('board-modal');
    const boardContent = document.getElementById('board-content');
    
    boardContent.innerHTML = `
        <div class="board-loading">
            <p>Loading board...</p>
        </div>
    `;
    
    boardModal.style.display = 'block';
    
    fetch(`/api/boards/${boardId}`)
        .then(response => {
            console.log('Board API response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(board => {
            currentBoardData = board;
            console.log('Board data received:', board);
            boardContent.innerHTML = renderBoardView(board);
            initializeDragAndDrop();
        })
        .catch(error => {
            console.error('Error loading board:', error);
            boardContent.innerHTML = `
                <div class="board-error">
                    <h3>Error loading board</h3>
                    <p>${error.message}</p>
                    <button onclick="openBoard(${boardId})" class="btn btn-primary">Try Again</button>
                </div>
            `;
        });
}

function renderBoardView(board) {
    console.log('Rendering board view for:', board.title);
    return `
        <div class="board-view">
            <div class="board-header">
                <div class="board-title-section">
                    <h2>${escapeHtml(board.title)}</h2>
                    <p class="board-description">${escapeHtml(board.description || 'No description')}</p>
                </div>
                <div class="board-actions">
                    ${board.is_owner ? `<button onclick="openBoardSettings(${board.id})" class="btn btn-secondary">Board Settings</button>` : ''}
                    <button onclick="showAddListForm()" class="btn btn-primary">+ Add List</button>
                    <button onclick="closeBoardModal()" class="btn btn-secondary">Close Board</button>
                </div>
            </div>
            
            <div class="board-members-bar">
                <div class="members-list">
                    <span class="members-label">Members:</span>
                    ${renderMembersPreview(board.members, board.owner)}
                </div>
                ${board.is_owner ? `<button onclick="showAddMemberForm()" class="btn btn-outline">+ Add Member</button>` : ''}
            </div>
            
            <div class="lists-container" id="lists-container">
                ${renderLists(board.lists || [])}
                
                <!-- Add List Form (initially hidden) -->
                <div class="list add-list-form" id="add-list-form" style="display: none;">
                    <div class="list-header">
                        <h4>Add New List</h4>
                    </div>
                    <div class="list-content">
                        <input type="text" id="new-list-title" placeholder="Enter list title" class="list-input">
                        <div class="list-form-actions">
                            <button onclick="createList()" class="btn btn-primary">Add List</button>
                            <button onclick="hideAddListForm()" class="btn btn-secondary">Cancel</button>
                        </div>
                    </div>
                </div>
                
                <!-- Add List Button (always visible) -->
                <div class="list add-list-button">
                    <button onclick="showAddListForm()" class="btn-add-list">
                        + Add Another List
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Card Details Modal -->
        <div id="card-modal" class="modal">
            <div class="modal-content card-modal-content">
                <span class="close">&times;</span>
                <div id="card-modal-body">
                    <!-- Card details will be loaded here -->
                </div>
            </div>
        </div>
    `;
}

function renderMembersPreview(members, owner) {
    const allMembers = [owner, ...members];
    const maxDisplay = 5;
    const displayMembers = allMembers.slice(0, maxDisplay);
    const extraCount = allMembers.length - maxDisplay;
    
    return `
        ${displayMembers.map(member => `
            <div class="member-avatar" title="${member.username} (${member === owner ? 'Owner' : 'Member'})">
                ${member.username.charAt(0).toUpperCase()}
            </div>
        `).join('')}
        ${extraCount > 0 ? `<div class="member-avatar extra-count">+${extraCount}</div>` : ''}
    `;
}

function renderLists(lists) {
    console.log('Rendering lists:', lists.length);
    
    if (lists.length === 0) {
        return `
            <div class="empty-lists-message">
                <p>No lists yet. Create your first list to get started!</p>
            </div>
        `;
    }
    
    return lists.map(list => `
        <div class="list" data-list-id="${list.id}" draggable="true">
            <div class="list-header">
                <h4 class="list-title" contenteditable="true" onblur="updateListTitle(${list.id}, this.innerText)">
                    ${escapeHtml(list.title)}
                </h4>
                <button onclick="deleteList(${list.id})" class="btn-delete-list" title="Delete list">×</button>
            </div>
            <div class="cards-container" id="cards-container-${list.id}">
                ${renderCards(list.cards || [], list.id)}
                
                <!-- Add Card Form (initially hidden) -->
                <div class="add-card-form" id="add-card-form-${list.id}" style="display: none;">
                    <textarea 
                        id="new-card-title-${list.id}" 
                        placeholder="Enter a title for this card..." 
                        class="card-input"
                        rows="3"
                    ></textarea>
                    <div class="card-form-actions">
                        <button onclick="createCard(${list.id})" class="btn btn-primary">Add Card</button>
                        <button onclick="hideAddCardForm(${list.id})" class="btn btn-secondary">×</button>
                    </div>
                </div>
            </div>
            <div class="list-footer">
                <button onclick="showAddCardForm(${list.id})" class="btn-add-card" id="add-card-btn-${list.id}">
                    + Add a card
                </button>
            </div>
        </div>
    `).join('');
}

function renderCards(cards, listId) {
    console.log('Rendering cards:', cards.length);
    
    if (cards.length === 0) {
        return '<div class="drop-zone-empty">Drop cards here</div>';
    }
    
    return cards.map(card => `
        <div class="card" data-card-id="${card.id}" data-list-id="${listId}" draggable="true" onclick="openCardDetails(${card.id})">
            <div class="card-content">
                ${card.due_date ? renderDueDate(card.due_date) : ''}
                <div class="card-title">${escapeHtml(card.title)}</div>
                ${card.description ? `<div class="card-description">${escapeHtml(card.description)}</div>` : ''}
                ${renderCardBadges(card)}
                <div class="card-meta">
                    <div class="card-creator">
                        Created by: ${escapeHtml(card.created_by.username)}
                    </div>
                </div>
            </div>
            <div class="card-actions">
                <button onclick="event.stopPropagation(); deleteCard(${card.id})" class="btn-delete-card" title="Delete card">×</button>
            </div>
        </div>
    `).join('');
}

function renderDueDate(dueDate) {
    const now = new Date();
    const due = new Date(dueDate);
    const timeDiff = due.getTime() - now.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    let dueClass = 'due-date';
    let status = '';
    
    if (daysDiff < 0) {
        dueClass += ' overdue';
        status = 'Overdue';
    } else if (daysDiff === 0) {
        dueClass += ' due-today';
        status = 'Due today';
    } else if (daysDiff === 1) {
        dueClass += ' due-tomorrow';
        status = 'Due tomorrow';
    } else if (daysDiff <= 7) {
        dueClass += ' due-soon';
        status = `Due in ${daysDiff} days`;
    } else {
        status = `Due in ${daysDiff} days`;
    }
    
    const formattedDate = due.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
    
    return `
        <div class="${dueClass}" title="${status}">
            <span class="due-date-icon">📅</span>
            <span class="due-date-text">${formattedDate}</span>
        </div>
    `;
}

function renderCardBadges(card) {
    const badges = [];
    
    if (card.description) {
        badges.push('<span class="card-badge description-badge" title="Has description">📝</span>');
    }
    
    if (card.due_date) {
        badges.push('<span class="card-badge due-date-badge" title="Has due date">📅</span>');
    }
    
    return badges.length > 0 ? `
        <div class="card-badges">
            ${badges.join('')}
        </div>
    ` : '';
}

// Board Settings and Member Management
function openBoardSettings(boardId) {
    console.log('Opening board settings for:', boardId);
    
    const settingsModal = document.getElementById('board-settings-modal');
    const settingsContent = document.getElementById('board-settings-content');
    
    settingsContent.innerHTML = `
        <div class="board-settings-loading">
            <p>Loading board settings...</p>
        </div>
    `;
    
    settingsModal.style.display = 'block';
    
    fetch(`/api/boards/${boardId}/members`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load board members');
            }
            return response.json();
        })
        .then(members => {
            settingsContent.innerHTML = renderBoardSettings(currentBoardData, members);
        })
        .catch(error => {
            console.error('Error loading board settings:', error);
            settingsContent.innerHTML = `
                <div class="board-settings-error">
                    <h3>Error loading settings</h3>
                    <p>${error.message}</p>
                </div>
            `;
        });
}

function renderBoardSettings(board, members) {
    const allMembers = [board.owner, ...members];
    
    return `
        <div class="board-settings">
            <h3>Board Settings: ${escapeHtml(board.title)}</h3>
            
            <div class="settings-section">
                <h4>Board Members</h4>
                <div class="members-list">
                    ${allMembers.map(member => `
                        <div class="member-item">
                            <div class="member-info">
                                <div class="member-avatar">${member.username.charAt(0).toUpperCase()}</div>
                                <div class="member-details">
                                    <div class="member-username">${escapeHtml(member.username)}</div>
                                    <div class="member-email">${escapeHtml(member.email)}</div>
                                </div>
                            </div>
                            <div class="member-role">
                                <span class="role-badge ${member.id === board.owner.id ? 'owner' : 'member'}">
                                    ${member.id === board.owner.id ? 'Owner' : 'Member'}
                                </span>
                                ${member.id !== board.owner.id ? `
                                    <button onclick="removeBoardMember(${board.id}, ${member.id})" class="btn btn-danger btn-sm">Remove</button>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button onclick="showAddMemberForm()" class="btn btn-primary">Add Member</button>
            </div>
        </div>
    `;
}

function showAddMemberForm() {
    console.log('Showing add member form');
    const addMemberModal = document.getElementById('add-member-modal');
    addMemberModal.style.display = 'block';
    
    // Clear previous search
    document.getElementById('member-search').value = '';
    document.getElementById('user-search-results').innerHTML = '';
    document.getElementById('selected-user').style.display = 'none';
}

function searchUsers(query) {
    console.log('Searching users:', query);
    
    fetch(`/api/users/search?q=${encodeURIComponent(query)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Search failed');
            }
            return response.json();
        })
        .then(users => {
            const resultsContainer = document.getElementById('user-search-results');
            if (users.length === 0) {
                resultsContainer.innerHTML = '<div class="no-results">No users found</div>';
            } else {
                resultsContainer.innerHTML = users.map(user => `
                    <div class="user-result" onclick="selectUser(${user.id}, '${escapeHtml(user.username)}', '${escapeHtml(user.email)}')">
                        <div class="user-username">${escapeHtml(user.username)}</div>
                        <div class="user-email">${escapeHtml(user.email)}</div>
                    </div>
                `).join('');
            }
        })
        .catch(error => {
            console.error('Error searching users:', error);
            document.getElementById('user-search-results').innerHTML = '<div class="error">Search failed</div>';
        });
}

function selectUser(userId, username, email) {
    console.log('Selected user:', userId, username);
    
    document.getElementById('selected-username').textContent = username;
    document.getElementById('selected-email').textContent = email;
    document.getElementById('selected-user').setAttribute('data-user-id', userId);
    document.getElementById('selected-user').style.display = 'block';
    document.getElementById('user-search-results').innerHTML = '';
}

function clearSelectedUser() {
    document.getElementById('selected-user').style.display = 'none';
    document.getElementById('member-search').value = '';
    document.getElementById('member-search').focus();
}

function addSelectedUserToBoard() {
    const userId = document.getElementById('selected-user').getAttribute('data-user-id');
    const username = document.getElementById('selected-username').textContent;
    
    if (!userId || !currentBoardId) {
        alert('Error: No user or board selected');
        return;
    }
    
    console.log('Adding user to board:', userId, currentBoardId);
    
    fetch(`/api/boards/${currentBoardId}/members`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username: username
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to add user to board');
        }
        return response.json();
    })
    .then(data => {
        console.log('User added to board:', data);
        
        // Close modals and refresh
        document.getElementById('add-member-modal').style.display = 'none';
        document.getElementById('board-settings-modal').style.display = 'none';
        
        // Refresh board view
        openBoard(currentBoardId);
    })
    .catch(error => {
        console.error('Error adding user to board:', error);
        alert('Error adding user to board: ' + error.message);
    });
}

function removeBoardMember(boardId, userId) {
    if (confirm('Are you sure you want to remove this member from the board?')) {
        console.log('Removing member:', userId, 'from board:', boardId);
        
        fetch(`/api/boards/${boardId}/members/${userId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to remove member');
            }
            return response.json();
        })
        .then(data => {
            console.log('Member removed:', data);
            // Refresh settings view
            openBoardSettings(boardId);
        })
        .catch(error => {
            console.error('Error removing member:', error);
            alert('Error removing member: ' + error.message);
        });
    }
}

// Card Details Functions (keep existing card details functions)
function openCardDetails(cardId) {
    console.log('Opening card details:', cardId);
    
    const cardModal = document.getElementById('card-modal');
    const cardModalBody = document.getElementById('card-modal-body');
    
    cardModalBody.innerHTML = `
        <div class="card-details-loading">
            <p>Loading card details...</p>
        </div>
    `;
    
    cardModal.style.display = 'block';
    
    fetch(`/api/cards/${cardId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load card details');
            }
            return response.json();
        })
        .then(card => {
            cardModalBody.innerHTML = renderCardDetails(card);
        })
        .catch(error => {
            console.error('Error loading card details:', error);
            cardModalBody.innerHTML = `
                <div class="card-details-error">
                    <h3>Error loading card</h3>
                    <p>${error.message}</p>
                    <button onclick="openCardDetails(${cardId})" class="btn btn-primary">Try Again</button>
                </div>
            `;
        });
}

function renderCardDetails(card) {
    const dueDate = card.due_date ? new Date(card.due_date).toISOString().split('T')[0] : '';
    
    return `
        <div class="card-details">
            <div class="card-details-header">
                <h3>Card Details</h3>
                <div class="card-meta">
                    <p><strong>Created by:</strong> ${escapeHtml(card.created_by.username)}</p>
                    <p><strong>Created:</strong> ${new Date(card.created_at).toLocaleDateString()}</p>
                </div>
            </div>
            
            <div class="card-details-content">
                <div class="form-group">
                    <label for="card-details-title">Title:</label>
                    <input type="text" id="card-details-title" value="${escapeHtml(card.title)}" class="form-input">
                </div>
                
                <div class="form-group">
                    <label for="card-details-description">Description:</label>
                    <textarea id="card-details-description" class="form-textarea" rows="6" placeholder="Add a more detailed description...">${escapeHtml(card.description || '')}</textarea>
                </div>
                
                <div class="form-group">
                    <label for="card-details-due-date">Due Date:</label>
                    <input type="date" id="card-details-due-date" value="${dueDate}" class="form-input">
                </div>
            </div>
            
            <div class="card-details-actions">
                <button onclick="saveCardDetails(${card.id})" class="btn btn-primary">Save Changes</button>
                <button onclick="closeCardModal()" class="btn btn-secondary">Close</button>
                <button onclick="deleteCardFromDetails(${card.id})" class="btn btn-danger">Delete Card</button>
            </div>
        </div>
    `;
}

function saveCardDetails(cardId) {
    const title = document.getElementById('card-details-title').value.trim();
    const description = document.getElementById('card-details-description').value.trim();
    const dueDate = document.getElementById('card-details-due-date').value;
    
    if (!title) {
        alert('Card title is required');
        return;
    }
    
    const updateData = {
        title: title,
        description: description,
        due_date: dueDate || null
    };
    
    console.log('Updating card:', cardId, updateData);
    
    fetch(`/api/cards/${cardId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to update card');
        }
        return response.json();
    })
    .then(updatedCard => {
        console.log('Card updated successfully:', updatedCard);
        closeCardModal();
        openBoard(currentBoardId);
    })
    .catch(error => {
        console.error('Error updating card:', error);
        alert('Error updating card: ' + error.message);
    });
}

function deleteCardFromDetails(cardId) {
    if (confirm('Are you sure you want to delete this card?')) {
        deleteCard(cardId);
        closeCardModal();
    }
}

function closeCardModal() {
    const cardModal = document.getElementById('card-modal');
    if (cardModal) {
        cardModal.style.display = 'none';
    }
}

// Keep all the existing drag and drop, list management, and card management functions...
// (initializeDragAndDrop, handleCardDragStart, handleCardDragEnd, etc.)
// ... include all the remaining functions from the previous version

// Drag and Drop Functions
function initializeDragAndDrop() {
    console.log('Initializing drag and drop');
    
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.addEventListener('dragstart', handleCardDragStart);
        card.addEventListener('dragend', handleCardDragEnd);
    });
    
    const lists = document.querySelectorAll('.list:not(.add-list-form):not(.add-list-button)');
    lists.forEach(list => {
        list.addEventListener('dragstart', handleListDragStart);
        list.addEventListener('dragend', handleListDragEnd);
        list.addEventListener('dragover', handleDragOver);
        list.addEventListener('dragenter', handleDragEnter);
        list.addEventListener('dragleave', handleDragLeave);
        list.addEventListener('drop', handleDrop);
    });
    
    const cardsContainers = document.querySelectorAll('.cards-container');
    cardsContainers.forEach(container => {
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('dragenter', handleDragEnter);
        container.addEventListener('dragleave', handleDragLeave);
        container.addEventListener('drop', handleDrop);
    });
}

function handleCardDragStart(e) {
    draggedCard = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.getAttribute('data-card-id'));
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    console.log('Card drag start:', this.getAttribute('data-card-id'));
}

function handleCardDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.drag-over, .card-drag-over').forEach(el => {
        el.classList.remove('drag-over', 'card-drag-over');
    });
    console.log('Card drag end');
    draggedCard = null;
}

function handleListDragStart(e) {
    draggedList = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.getAttribute('data-list-id'));
    console.log('List drag start:', this.getAttribute('data-list-id'));
}

function handleListDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });
    console.log('List drag end');
    draggedList = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    e.preventDefault();
    const target = e.target.closest('.list') || e.target.closest('.cards-container');
    if (target) {
        if (target.classList.contains('list') && draggedList && target !== draggedList) {
            target.classList.add('drag-over');
        } else if (target.classList.contains('cards-container') && draggedCard) {
            target.classList.add('card-drag-over');
        }
    }
}

function handleDragLeave(e) {
    const target = e.target.closest('.list') || e.target.closest('.cards-container');
    if (target && !target.contains(e.relatedTarget)) {
        target.classList.remove('drag-over');
        target.classList.remove('card-drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const target = e.target.closest('.list') || e.target.closest('.cards-container');
    if (!target) return;
    
    target.classList.remove('drag-over', 'card-drag-over');
    
    if (draggedCard) {
        handleCardDrop(target, draggedCard);
    } else if (draggedList) {
        handleListDrop(target, draggedList);
    }
    return false;
}

function handleCardDrop(target, draggedCard) {
    const cardId = draggedCard.getAttribute('data-card-id');
    let targetListId = null;
    
    if (target.classList.contains('cards-container')) {
        targetListId = target.closest('.list').getAttribute('data-list-id');
    } else if (target.classList.contains('list')) {
        targetListId = target.getAttribute('data-list-id');
    }
    
    if (!targetListId) return;
    
    const originalListId = draggedCard.getAttribute('data-list-id');
    
    if (targetListId !== originalListId) {
        console.log(`Moving card ${cardId} from list ${originalListId} to list ${targetListId}`);
        
        fetch(`/api/cards/${cardId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                list_id: parseInt(targetListId)
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to move card');
            }
            return response.json();
        })
        .then(data => {
            console.log('Card moved successfully');
            openBoard(currentBoardId);
        })
        .catch(error => {
            console.error('Error moving card:', error);
            alert('Error moving card: ' + error.message);
        });
    }
}

function handleListDrop(target, draggedList) {
    if (!target.classList.contains('list') || target === draggedList) return;
    
    const listsContainer = document.getElementById('lists-container');
    const allLists = Array.from(listsContainer.querySelectorAll('.list:not(.add-list-form):not(.add-list-button)'));
    const draggedIndex = allLists.indexOf(draggedList);
    const targetIndex = allLists.indexOf(target);
    
    if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
        if (draggedIndex < targetIndex) {
            target.parentNode.insertBefore(draggedList, target.nextSibling);
        } else {
            target.parentNode.insertBefore(draggedList, target);
        }
        
        console.log(`Reordered list ${draggedList.getAttribute('data-list-id')} to position ${targetIndex}`);
        updateListPositions();
    }
}

function updateListPositions() {
    const listsContainer = document.getElementById('lists-container');
    const lists = listsContainer.querySelectorAll('.list:not(.add-list-form):not(.add-list-button)');
    
    const updates = Array.from(lists).map((list, index) => {
        const listId = list.getAttribute('data-list-id');
        console.log(`List ${listId} new position: ${index}`);
        return { listId, position: index };
    });
    
    console.log('List position updates:', updates);
}

// List Management Functions
function showAddListForm() {
    console.log('Showing add list form');
    const addListForm = document.getElementById('add-list-form');
    const addListButton = document.querySelector('.add-list-button');
    
    if (addListForm && addListButton) {
        addListForm.style.display = 'block';
        addListButton.style.display = 'none';
        
        const input = document.getElementById('new-list-title');
        if (input) {
            input.focus();
            input.value = '';
        }
    }
}

function hideAddListForm() {
    console.log('Hiding add list form');
    const addListForm = document.getElementById('add-list-form');
    const addListButton = document.querySelector('.add-list-button');
    
    if (addListForm && addListButton) {
        addListForm.style.display = 'none';
        addListButton.style.display = 'block';
    }
}

function createList() {
    const titleInput = document.getElementById('new-list-title');
    const title = titleInput ? titleInput.value.trim() : '';
    
    if (!title) {
        alert('Please enter a list title');
        return;
    }
    
    if (!currentBoardId) {
        alert('No board selected');
        return;
    }
    
    console.log('Creating list with title:', title, 'for board:', currentBoardId);
    
    fetch(`/api/boards/${currentBoardId}/lists`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            title: title
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to create list');
        }
        return response.json();
    })
    .then(newList => {
        console.log('List created successfully:', newList);
        hideAddListForm();
        openBoard(currentBoardId);
    })
    .catch(error => {
        console.error('Error creating list:', error);
        alert('Error creating list: ' + error.message);
    });
}

// Card Management Functions
function showAddCardForm(listId) {
    console.log('Showing add card form for list:', listId);
    
    const addCardForm = document.getElementById(`add-card-form-${listId}`);
    const addCardButton = document.getElementById(`add-card-btn-${listId}`);
    
    if (addCardForm && addCardButton) {
        addCardForm.style.display = 'block';
        addCardButton.style.display = 'none';
        
        const textarea = document.getElementById(`new-card-title-${listId}`);
        if (textarea) {
            textarea.focus();
            textarea.value = '';
        }
    }
}

function hideAddCardForm(listId) {
    console.log('Hiding add card form for list:', listId);
    
    const addCardForm = document.getElementById(`add-card-form-${listId}`);
    const addCardButton = document.getElementById(`add-card-btn-${listId}`);
    
    if (addCardForm && addCardButton) {
        addCardForm.style.display = 'none';
        addCardButton.style.display = 'block';
    }
}

function createCard(listId) {
    const textarea = document.getElementById(`new-card-title-${listId}`);
    const title = textarea ? textarea.value.trim() : '';
    
    if (!title) {
        alert('Please enter a card title');
        return;
    }
    
    console.log('Creating card with title:', title, 'for list:', listId);
    
    fetch(`/api/lists/${listId}/cards`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            title: title,
            description: ''
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to create card');
        }
        return response.json();
    })
    .then(newCard => {
        console.log('Card created successfully:', newCard);
        hideAddCardForm(listId);
        openBoard(currentBoardId);
    })
    .catch(error => {
        console.error('Error creating card:', error);
        alert('Error creating card: ' + error.message);
    });
}

function updateListTitle(listId, newTitle) {
    if (!newTitle.trim()) {
        openBoard(currentBoardId);
        return;
    }
    
    console.log('Updating list title:', listId, newTitle);
}

function closeBoardModal() {
    console.log('Closing board modal');
    const boardModal = document.getElementById('board-modal');
    if (boardModal) {
        boardModal.style.display = 'none';
    }
}

function createBoard() {
    const title = document.getElementById('board-title').value;
    const description = document.getElementById('board-description').value;
    
    if (!title.trim()) {
        alert('Please enter a board title');
        return;
    }
    
    console.log('Creating board:', title);
    
    fetch('/api/boards', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            title: title,
            description: description 
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to create board');
        }
        return response.json();
    })
    .then(data => {
        console.log('Board created successfully:', data);
        document.getElementById('create-board-modal').style.display = 'none';
        document.getElementById('create-board-form').reset();
        location.reload();
    })
    .catch(error => {
        console.error('Error creating board:', error);
        alert('Error creating board: ' + error.message);
    });
}

function deleteBoard(boardId) {
    if (confirm('Are you sure you want to delete this board? This action cannot be undone.')) {
        console.log('Deleting board:', boardId);
        
        fetch(`/api/boards/${boardId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to delete board');
            }
            return response.json();
        })
        .then(data => {
            console.log('Board deleted successfully');
            location.reload();
        })
        .catch(error => {
            console.error('Error deleting board:', error);
            alert('Error deleting board: ' + error.message);
        });
    }
}

function deleteList(listId) {
    if (confirm('Are you sure you want to delete this list and all its cards?')) {
        console.log('Deleting list:', listId);
        
        fetch(`/api/lists/${listId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to delete list');
            }
            return response.json();
        })
        .then(data => {
            console.log('List deleted successfully');
            openBoard(currentBoardId);
        })
        .catch(error => {
            console.error('Error deleting list:', error);
            alert('Error deleting list: ' + error.message);
        });
    }
}

function deleteCard(cardId) {
    if (confirm('Are you sure you want to delete this card?')) {
        console.log('Deleting card:', cardId);
        
        fetch(`/api/cards/${cardId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to delete card');
            }
            return response.json();
        })
        .then(data => {
            console.log('Card deleted successfully');
            openBoard(currentBoardId);
        })
        .catch(error => {
            console.error('Error deleting card:', error);
            alert('Error deleting card: ' + error.message);
        });
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// File Attachment Functions
function renderCardAttachments(attachments) {
    if (!attachments || attachments.length === 0) {
        return '';
    }
    
    return `
        <div class="card-attachments">
            <div class="attachments-header">
                <span class="attachments-icon">📎</span>
                <span class="attachments-count">${attachments.length} attachment${attachments.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="attachments-list">
                ${attachments.map(attachment => `
                    <div class="attachment-item" data-attachment-id="${attachment.id}">
                        <span class="attachment-icon">${attachment.icon}</span>
                        <div class="attachment-info">
                            <div class="attachment-filename">${escapeHtml(attachment.filename)}</div>
                            <div class="attachment-meta">
                                ${formatFileSize(attachment.file_size)} • 
                                ${new Date(attachment.uploaded_at).toLocaleDateString()}
                            </div>
                        </div>
                        <div class="attachment-actions">
                            <button onclick="event.stopPropagation(); downloadAttachment(${attachment.id})" 
                                    class="btn-download" title="Download">📥</button>
                            <button onclick="event.stopPropagation(); deleteAttachment(${attachment.id})" 
                                    class="btn-delete-attachment" title="Delete">×</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function downloadAttachment(attachmentId) {
    console.log('Downloading attachment:', attachmentId);
    window.open(`/api/attachments/${attachmentId}/download`, '_blank');
}

function deleteAttachment(attachmentId) {
    if (confirm('Are you sure you want to delete this file?')) {
        console.log('Deleting attachment:', attachmentId);
        
        fetch(`/api/attachments/${attachmentId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to delete attachment');
            }
            return response.json();
        })
        .then(data => {
            console.log('Attachment deleted successfully');
            // Remove the attachment item from DOM
            const attachmentItem = document.querySelector(`[data-attachment-id="${attachmentId}"]`);
            if (attachmentItem) {
                attachmentItem.remove();
            }
            // Refresh card details if modal is open
            const cardModal = document.getElementById('card-modal');
            if (cardModal.style.display === 'block') {
                // We'll refresh the card details in the next step
            }
        })
        .catch(error => {
            console.error('Error deleting attachment:', error);
            alert('Error deleting attachment: ' + error.message);
        });
    }
}

function showFileUploadForm(cardId) {
    const fileInput = document.getElementById('file-upload-input');
    if (fileInput) {
        fileInput.value = ''; // Clear previous selection
        fileInput.setAttribute('data-card-id', cardId);
        fileInput.click();
    }
}

function handleFileUpload(event) {
    const fileInput = event.target;
    const cardId = fileInput.getAttribute('data-card-id');
    const file = fileInput.files[0];
    
    if (!file) return;
    
    console.log('Uploading file:', file.name, 'to card:', cardId);
    
    // Validate file size (16MB limit)
    if (file.size > 16 * 1024 * 1024) {
        alert('File too large. Maximum size is 16MB.');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Show upload progress
    const uploadArea = document.querySelector('.file-upload-area');
    if (uploadArea) {
        uploadArea.innerHTML = `
            <div class="upload-progress">
                <div class="upload-text">Uploading ${file.name}...</div>
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
            </div>
        `;
    }
    
    fetch(`/api/cards/${cardId}/attachments`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Upload failed');
        }
        return response.json();
    })
    .then(attachment => {
        console.log('File uploaded successfully:', attachment);
        
        // Refresh card details to show new attachment
        openCardDetails(cardId);
    })
    .catch(error => {
        console.error('Error uploading file:', error);
        alert('Error uploading file: ' + error.message);
        
        // Reset upload area
        const uploadArea = document.querySelector('.file-upload-area');
        if (uploadArea) {
            uploadArea.innerHTML = `
                <div class="file-upload-prompt">
                    <div class="upload-icon">📎</div>
                    <div class="upload-text">Click to upload or drag and drop</div>
                    <div class="upload-hint">Max file size: 16MB</div>
                </div>
            `;
        }
    });
}

// Update the renderCardDetails function to include file attachments
function renderCardDetails(card) {
    const dueDate = card.due_date ? new Date(card.due_date).toISOString().split('T')[0] : '';
    
    return `
        <div class="card-details">
            <div class="card-details-header">
                <h3>Card Details</h3>
                <div class="card-meta">
                    <p><strong>Created by:</strong> ${escapeHtml(card.created_by.username)}</p>
                    <p><strong>Created:</strong> ${new Date(card.created_at).toLocaleDateString()}</p>
                </div>
            </div>
            
            <div class="card-details-content">
                <div class="form-group">
                    <label for="card-details-title">Title:</label>
                    <input type="text" id="card-details-title" value="${escapeHtml(card.title)}" class="form-input">
                </div>
                
                <div class="form-group">
                    <label for="card-details-description">Description:</label>
                    <textarea id="card-details-description" class="form-textarea" rows="6" placeholder="Add a more detailed description...">${escapeHtml(card.description || '')}</textarea>
                </div>
                
                <div class="form-group">
                    <label for="card-details-due-date">Due Date:</label>
                    <input type="date" id="card-details-due-date" value="${dueDate}" class="form-input">
                </div>
                
                <!-- File Attachments Section -->
                <div class="form-group">
                    <label>Attachments:</label>
                    <div class="attachments-section">
                        ${renderCardAttachments(card.attachments || [])}
                        
                        <!-- File Upload Area -->
                        <div class="file-upload-area" onclick="showFileUploadForm(${card.id})">
                            <div class="file-upload-prompt">
                                <div class="upload-icon">📎</div>
                                <div class="upload-text">Click to upload or drag and drop</div>
                                <div class="upload-hint">Max file size: 16MB</div>
                            </div>
                        </div>
                        
                        <!-- Hidden file input -->
                        <input type="file" id="file-upload-input" style="display: none;" onchange="handleFileUpload(event)">
                    </div>
                </div>
            </div>
            
            <div class="card-details-actions">
                <button onclick="saveCardDetails(${card.id})" class="btn btn-primary">Save Changes</button>
                <button onclick="closeCardModal()" class="btn btn-secondary">Close</button>
                <button onclick="deleteCardFromDetails(${card.id})" class="btn btn-danger">Delete Card</button>
            </div>
        </div>
    `;
}

// Update the renderCards function to show attachment badges
function renderCards(cards, listId) {
    console.log('Rendering cards:', cards.length);
    
    if (cards.length === 0) {
        return '<div class="drop-zone-empty">Drop cards here</div>';
    }
    
    return cards.map(card => `
        <div class="card" data-card-id="${card.id}" data-list-id="${listId}" draggable="true" onclick="openCardDetails(${card.id})">
            <div class="card-content">
                ${card.due_date ? renderDueDate(card.due_date) : ''}
                <div class="card-title">${escapeHtml(card.title)}</div>
                ${card.description ? `<div class="card-description">${escapeHtml(card.description)}</div>` : ''}
                ${renderCardBadges(card)}
                ${card.attachments && card.attachments.length > 0 ? `
                    <div class="card-attachment-badge">
                        📎 ${card.attachments.length}
                    </div>
                ` : ''}
                <div class="card-meta">
                    <div class="card-creator">
                        Created by: ${escapeHtml(card.created_by.username)}
                    </div>
                </div>
            </div>
            <div class="card-actions">
                <button onclick="event.stopPropagation(); deleteCard(${card.id})" class="btn-delete-card" title="Delete card">×</button>
            </div>
        </div>
    `).join('');
}

// Update renderCardBadges to include attachment badge
function renderCardBadges(card) {
    const badges = [];
    
    if (card.description) {
        badges.push('<span class="card-badge description-badge" title="Has description">📝</span>');
    }
    
    if (card.due_date) {
        badges.push('<span class="card-badge due-date-badge" title="Has due date">📅</span>');
    }
    
    if (card.attachments && card.attachments.length > 0) {
        badges.push(`<span class="card-badge attachment-badge" title="${card.attachments.length} attachment${card.attachments.length !== 1 ? 's' : ''}">📎</span>`);
    }
    
    return badges.length > 0 ? `
        <div class="card-badges">
            ${badges.join('')}
        </div>
    ` : '';
}

// Checklist Functions
function renderCardChecklists(checklists) {
    if (!checklists || checklists.length === 0) {
        return '';
    }
    
    return `
        <div class="checklists-section">
            <div class="checklists-header">
                <span class="checklists-icon">✅</span>
                <span class="checklists-label">Checklists</span>
            </div>
            ${checklists.map(checklist => renderChecklist(checklist)).join('')}
        </div>
    `;
}

function renderChecklist(checklist) {
    return `
        <div class="checklist" data-checklist-id="${checklist.id}">
            <div class="checklist-header">
                <div class="checklist-title-section">
                    <h4 class="checklist-title" contenteditable="true" onblur="updateChecklistTitle(${checklist.id}, this.innerText)">
                        ${escapeHtml(checklist.title)}
                    </h4>
                    <div class="checklist-progress">
                        <div class="progress-text">${checklist.completed_count}/${checklist.total_count}</div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${checklist.progress}%"></div>
                        </div>
                    </div>
                </div>
                <button onclick="deleteChecklist(${checklist.id})" class="btn-delete-checklist" title="Delete checklist">×</button>
            </div>
            <div class="checklist-items">
                ${renderChecklistItems(checklist.items, checklist.id)}
            </div>
            <div class="checklist-footer">
                <button onclick="showAddChecklistItemForm(${checklist.id})" class="btn-add-checklist-item">
                    + Add an item
                </button>
                <div class="add-item-form" id="add-item-form-${checklist.id}" style="display: none;">
                    <input type="text" 
                           id="new-item-text-${checklist.id}" 
                           placeholder="Add an item..." 
                           class="item-input"
                           onkeypress="handleChecklistItemKeypress(event, ${checklist.id})">
                    <div class="item-form-actions">
                        <button onclick="createChecklistItem(${checklist.id})" class="btn btn-primary">Add</button>
                        <button onclick="hideAddChecklistItemForm(${checklist.id})" class="btn btn-secondary">×</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderChecklistItems(items, checklistId) {
    if (!items || items.length === 0) {
        return '<div class="empty-checklist">No items yet</div>';
    }
    
    return items.map(item => `
        <div class="checklist-item ${item.is_completed ? 'completed' : ''}" data-item-id="${item.id}">
            <input type="checkbox" 
                   ${item.is_completed ? 'checked' : ''}
                   onchange="toggleChecklistItem(${item.id}, this.checked)"
                   class="item-checkbox">
            <div class="item-content">
                <span class="item-text" contenteditable="true" onblur="updateChecklistItemText(${item.id}, this.innerText)">
                    ${escapeHtml(item.text)}
                </span>
            </div>
            <button onclick="deleteChecklistItem(${item.id})" class="btn-delete-item" title="Delete item">×</button>
        </div>
    `).join('');
}

function showAddChecklistForm(cardId) {
    const checklistsContainer = document.querySelector('.checklists-container');
    if (checklistsContainer) {
        checklistsContainer.innerHTML = `
            <div class="add-checklist-form">
                <input type="text" id="new-checklist-title" placeholder="Checklist title" class="checklist-title-input" value="Checklist">
                <div class="checklist-form-actions">
                    <button onclick="createChecklist(${cardId})" class="btn btn-primary">Add</button>
                    <button onclick="hideAddChecklistForm()" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
        `;
        document.getElementById('new-checklist-title').focus();
        document.getElementById('new-checklist-title').select();
    }
}

function hideAddChecklistForm() {
    const checklistsContainer = document.querySelector('.checklists-container');
    if (checklistsContainer) {
        checklistsContainer.innerHTML = `
            <button onclick="showAddChecklistForm(currentCardId)" class="btn-add-checklist">
                <span class="add-checklist-icon">✅</span>
                Add Checklist
            </button>
        `;
    }
}

function createChecklist(cardId) {
    const titleInput = document.getElementById('new-checklist-title');
    const title = titleInput ? titleInput.value.trim() : 'Checklist';
    
    if (!title) {
        alert('Checklist title is required');
        return;
    }
    
    console.log('Creating checklist:', title, 'for card:', cardId);
    
    fetch(`/api/cards/${cardId}/checklists`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            title: title
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to create checklist');
        }
        return response.json();
    })
    .then(checklist => {
        console.log('Checklist created successfully:', checklist);
        // Refresh card details to show new checklist
        openCardDetails(cardId);
    })
    .catch(error => {
        console.error('Error creating checklist:', error);
        alert('Error creating checklist: ' + error.message);
    });
}

function updateChecklistTitle(checklistId, newTitle) {
    if (!newTitle.trim()) {
        // Reload to get the original title back
        openCardDetails(currentCardId);
        return;
    }
    
    console.log('Updating checklist title:', checklistId, newTitle);
    
    fetch(`/api/checklists/${checklistId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            title: newTitle
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to update checklist title');
        }
        return response.json();
    })
    .then(updatedChecklist => {
        console.log('Checklist title updated successfully:', updatedChecklist);
    })
    .catch(error => {
        console.error('Error updating checklist title:', error);
        alert('Error updating checklist title: ' + error.message);
    });
}

function deleteChecklist(checklistId) {
    if (confirm('Are you sure you want to delete this checklist?')) {
        console.log('Deleting checklist:', checklistId);
        
        fetch(`/api/checklists/${checklistId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to delete checklist');
            }
            return response.json();
        })
        .then(data => {
            console.log('Checklist deleted successfully');
            // Refresh card details
            openCardDetails(currentCardId);
        })
        .catch(error => {
            console.error('Error deleting checklist:', error);
            alert('Error deleting checklist: ' + error.message);
        });
    }
}

function showAddChecklistItemForm(checklistId) {
    const addButton = document.querySelector(`[onclick="showAddChecklistItemForm(${checklistId})"]`);
    const addForm = document.getElementById(`add-item-form-${checklistId}`);
    
    if (addButton && addForm) {
        addButton.style.display = 'none';
        addForm.style.display = 'block';
        
        const input = document.getElementById(`new-item-text-${checklistId}`);
        if (input) {
            input.focus();
        }
    }
}

function hideAddChecklistItemForm(checklistId) {
    const addButton = document.querySelector(`[onclick="showAddChecklistItemForm(${checklistId})"]`);
    const addForm = document.getElementById(`add-item-form-${checklistId}`);
    
    if (addButton && addForm) {
        addButton.style.display = 'block';
        addForm.style.display = 'none';
    }
}

function handleChecklistItemKeypress(event, checklistId) {
    if (event.key === 'Enter') {
        event.preventDefault();
        createChecklistItem(checklistId);
    }
}

function createChecklistItem(checklistId) {
    const input = document.getElementById(`new-item-text-${checklistId}`);
    const text = input ? input.value.trim() : '';
    
    if (!text) {
        alert('Item text is required');
        return;
    }
    
    console.log('Creating checklist item:', text, 'for checklist:', checklistId);
    
    fetch(`/api/checklists/${checklistId}/items`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            text: text
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to create checklist item');
        }
        return response.json();
    })
    .then(item => {
        console.log('Checklist item created successfully:', item);
        // Refresh card details to show new item
        openCardDetails(currentCardId);
    })
    .catch(error => {
        console.error('Error creating checklist item:', error);
        alert('Error creating checklist item: ' + error.message);
    });
}

function toggleChecklistItem(itemId, isCompleted) {
    console.log('Toggling checklist item:', itemId, isCompleted);
    
    fetch(`/api/checklist-items/${itemId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            is_completed: isCompleted
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to update checklist item');
        }
        return response.json();
    })
    .then(updatedItem => {
        console.log('Checklist item updated successfully:', updatedItem);
        // Update the UI immediately for better UX
        const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
        if (itemElement) {
            if (isCompleted) {
                itemElement.classList.add('completed');
            } else {
                itemElement.classList.remove('completed');
            }
        }
        // Also refresh to update progress
        openCardDetails(currentCardId);
    })
    .catch(error => {
        console.error('Error updating checklist item:', error);
        alert('Error updating checklist item: ' + error.message);
    });
}

function updateChecklistItemText(itemId, newText) {
    if (!newText.trim()) {
        // Reload to get the original text back
        openCardDetails(currentCardId);
        return;
    }
    
    console.log('Updating checklist item text:', itemId, newText);
    
    fetch(`/api/checklist-items/${itemId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            text: newText
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to update checklist item text');
        }
        return response.json();
    })
    .then(updatedItem => {
        console.log('Checklist item text updated successfully:', updatedItem);
    })
    .catch(error => {
        console.error('Error updating checklist item text:', error);
        alert('Error updating checklist item text: ' + error.message);
    });
}

function deleteChecklistItem(itemId) {
    if (confirm('Are you sure you want to delete this item?')) {
        console.log('Deleting checklist item:', itemId);
        
        fetch(`/api/checklist-items/${itemId}`, {
            method: 'DELETE'
        })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to delete checklist item');
        }
        return response.json();
    })
    .then(data => {
        console.log('Checklist item deleted successfully');
        // Refresh card details
        openCardDetails(currentCardId);
    })
    .catch(error => {
        console.error('Error deleting checklist item:', error);
        alert('Error deleting checklist item: ' + error.message);
    });
    }
}

// Update the renderCardDetails function to include checklists
let currentCardId = null;

function renderCardDetails(card) {
    currentCardId = card.id;
    const dueDate = card.due_date ? new Date(card.due_date).toISOString().split('T')[0] : '';
    
    return `
        <div class="card-details">
            <div class="card-details-header">
                <h3>Card Details</h3>
                <div class="card-meta">
                    <p><strong>Created by:</strong> ${escapeHtml(card.created_by.username)}</p>
                    <p><strong>Created:</strong> ${new Date(card.created_at).toLocaleDateString()}</p>
                </div>
            </div>
            
            <div class="card-details-content">
                <div class="form-group">
                    <label for="card-details-title">Title:</label>
                    <input type="text" id="card-details-title" value="${escapeHtml(card.title)}" class="form-input">
                </div>
                
                <div class="form-group">
                    <label for="card-details-description">Description:</label>
                    <textarea id="card-details-description" class="form-textarea" rows="6" placeholder="Add a more detailed description...">${escapeHtml(card.description || '')}</textarea>
                </div>
                
                <div class="form-group">
                    <label for="card-details-due-date">Due Date:</label>
                    <input type="date" id="card-details-due-date" value="${dueDate}" class="form-input">
                </div>
                
                <!-- Checklists Section -->
                <div class="form-group">
                    <label>Checklists:</label>
                    <div class="checklists-container">
                        ${card.checklists && card.checklists.length > 0 ? 
                            renderCardChecklists(card.checklists) : 
                            `<button onclick="showAddChecklistForm(${card.id})" class="btn-add-checklist">
                                <span class="add-checklist-icon">✅</span>
                                Add Checklist
                            </button>`
                        }
                    </div>
                </div>
                
                <!-- File Attachments Section -->
                <div class="form-group">
                    <label>Attachments:</label>
                    <div class="attachments-section">
                        ${renderCardAttachments(card.attachments || [])}
                        
                        <!-- File Upload Area -->
                        <div class="file-upload-area" onclick="showFileUploadForm(${card.id})">
                            <div class="file-upload-prompt">
                                <div class="upload-icon">📎</div>
                                <div class="upload-text">Click to upload or drag and drop</div>
                                <div class="upload-hint">Max file size: 16MB</div>
                            </div>
                        </div>
                        
                        <!-- Hidden file input -->
                        <input type="file" id="file-upload-input" style="display: none;" onchange="handleFileUpload(event)">
                    </div>
                </div>
            </div>
            
            <div class="card-details-actions">
                <button onclick="saveCardDetails(${card.id})" class="btn btn-primary">Save Changes</button>
                <button onclick="closeCardModal()" class="btn btn-secondary">Close</button>
                <button onclick="deleteCardFromDetails(${card.id})" class="btn btn-danger">Delete Card</button>
            </div>
        </div>
    `;
}

// Update renderCardBadges to include checklist badge
function renderCardBadges(card) {
    const badges = [];
    
    if (card.description) {
        badges.push('<span class="card-badge description-badge" title="Has description">📝</span>');
    }
    
    if (card.due_date) {
        badges.push('<span class="card-badge due-date-badge" title="Has due date">📅</span>');
    }
    
    if (card.attachments && card.attachments.length > 0) {
        badges.push(`<span class="card-badge attachment-badge" title="${card.attachments.length} attachment${card.attachments.length !== 1 ? 's' : ''}">📎</span>`);
    }
    
    if (card.checklists && card.checklists.length > 0) {
        const totalItems = card.checklists.reduce((sum, cl) => sum + cl.total_count, 0);
        const completedItems = card.checklists.reduce((sum, cl) => sum + cl.completed_count, 0);
        badges.push(`<span class="card-badge checklist-badge" title="${completedItems}/${totalItems} checklist items completed">✅</span>`);
    }
    
    return badges.length > 0 ? `
        <div class="card-badges">
            ${badges.join('')}
        </div>
    ` : '';
}

// Label Functions
function renderCardLabels(labels) {
    if (!labels || labels.length === 0) {
        return '';
    }
    
    return `
        <div class="card-labels">
            ${labels.map(label => `
                <span class="card-label" style="background-color: ${label.color}; color: ${getContrastColor(label.color)}" 
                      title="${escapeHtml(label.name)}" data-label-id="${label.id}">
                    ${escapeHtml(label.name)}
                </span>
            `).join('')}
        </div>
    `;
}

function getContrastColor(hexcolor) {
    // Remove the # if present
    hexcolor = hexcolor.replace("#", "");
    
    // Convert to RGB
    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return black for light colors, white for dark colors
    return luminance > 0.5 ? '#000000' : '#ffffff';
}

function showLabelManager(cardId) {
    console.log('Showing label manager for card:', cardId);
    
    const labelModal = document.getElementById('label-modal');
    const labelModalBody = document.getElementById('label-modal-body');
    
    labelModalBody.innerHTML = `
        <div class="label-manager-loading">
            <p>Loading labels...</p>
        </div>
    `;
    
    labelModal.style.display = 'block';
    
    // Fetch board labels and card labels
    Promise.all([
        fetch(`/api/boards/${currentBoardId}/labels`).then(r => r.json()),
        fetch(`/api/cards/${cardId}/labels`).then(r => r.json())
    ])
    .then(([boardLabels, cardLabels]) => {
        const cardLabelIds = new Set(cardLabels.map(label => label.id));
        labelModalBody.innerHTML = renderLabelManager(boardLabels, cardLabelIds, cardId);
        initializeLabelManager();
    })
    .catch(error => {
        console.error('Error loading labels:', error);
        labelModalBody.innerHTML = `
            <div class="label-manager-error">
                <h3>Error loading labels</h3>
                <p>${error.message}</p>
                <button onclick="showLabelManager(${cardId})" class="btn btn-primary">Try Again</button>
            </div>
        `;
    });
}

function renderLabelManager(boardLabels, cardLabelIds, cardId) {
    return `
        <div class="label-manager">
            <div class="label-manager-header">
                <h3>Labels</h3>
                <p>Manage labels for this card</p>
            </div>
            
            <div class="labels-list">
                <h4>Available Labels</h4>
                ${boardLabels.length === 0 ? 
                    '<div class="no-labels">No labels created for this board yet.</div>' :
                    boardLabels.map(label => `
                        <div class="label-item ${cardLabelIds.has(label.id) ? 'selected' : ''}" data-label-id="${label.id}">
                            <div class="label-color" style="background-color: ${label.color}"></div>
                            <span class="label-name">${escapeHtml(label.name)}</span>
                            <div class="label-actions">
                                <input type="checkbox" 
                                       ${cardLabelIds.has(label.id) ? 'checked' : ''}
                                       onchange="toggleCardLabel(${cardId}, ${label.id}, this.checked)">
                                <button onclick="editLabel(${label.id})" class="btn-edit-label" title="Edit label">✏️</button>
                            </div>
                        </div>
                    `).join('')
                }
            </div>
            
            <div class="label-manager-actions">
                <button onclick="showCreateLabelForm()" class="btn btn-primary">Create New Label</button>
                <button onclick="closeLabelModal()" class="btn btn-secondary">Done</button>
            </div>
            
            <!-- Create Label Form -->
            <div id="create-label-form" class="create-label-form" style="display: none;">
                <h4>Create New Label</h4>
                <div class="form-group">
                    <label for="new-label-name">Label Name:</label>
                    <input type="text" id="new-label-name" class="form-input" placeholder="Enter label name">
                </div>
                <div class="form-group">
                    <label for="new-label-color">Color:</label>
                    <div class="color-picker">
                        ${getColorOptions().map(color => `
                            <div class="color-option ${color === '#0079bf' ? 'selected' : ''}" 
                                 style="background-color: ${color}"
                                 onclick="selectColor('${color}')"
                                 data-color="${color}"></div>
                        `).join('')}
                    </div>
                    <input type="text" id="new-label-color" class="form-input color-input" value="#0079bf" 
                           onchange="updateColorPreview(this.value)">
                </div>
                <div class="form-actions">
                    <button onclick="createLabel()" class="btn btn-primary">Create Label</button>
                    <button onclick="hideCreateLabelForm()" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
        </div>
    `;
}

function getColorOptions() {
    return [
        '#0079bf', '#d29034', '#519839', '#b04632', '#89609e',
        '#cd5a91', '#4bbf6b', '#00aecc', '#838c91', '#ff8ed4',
        '#ff78cb', '#ffab4a', '#b3dc6c', '#ff756b', '#cd8ee5',
        '#6de3b3', '#5ba4cf', '#344563', '#b6e0f7', '#d1e0f0'
    ];
}

function initializeLabelManager() {
    // Initialize color picker
    const colorInput = document.getElementById('new-label-color');
    if (colorInput) {
        colorInput.addEventListener('input', function() {
            updateColorPreview(this.value);
        });
    }
}

function showCreateLabelForm() {
    document.getElementById('create-label-form').style.display = 'block';
    document.getElementById('new-label-name').focus();
}

function hideCreateLabelForm() {
    document.getElementById('create-label-form').style.display = 'none';
}

function selectColor(color) {
    // Update selected color in color picker
    document.querySelectorAll('.color-option').forEach(option => {
        option.classList.remove('selected');
    });
    document.querySelector(`[data-color="${color}"]`).classList.add('selected');
    
    // Update color input
    document.getElementById('new-label-color').value = color;
    updateColorPreview(color);
}

function updateColorPreview(color) {
    const colorInput = document.getElementById('new-label-color');
    if (colorInput) {
        colorInput.style.backgroundColor = color;
        colorInput.style.color = getContrastColor(color);
    }
}

function createLabel() {
    const nameInput = document.getElementById('new-label-name');
    const colorInput = document.getElementById('new-label-color');
    
    const name = nameInput ? nameInput.value.trim() : '';
    const color = colorInput ? colorInput.value : '#0079bf';
    
    if (!name) {
        alert('Label name is required');
        return;
    }
    
    console.log('Creating label:', name, color);
    
    fetch(`/api/boards/${currentBoardId}/labels`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: name,
            color: color
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to create label');
        }
        return response.json();
    })
    .then(label => {
        console.log('Label created successfully:', label);
        // Refresh label manager
        showLabelManager(currentCardId);
    })
    .catch(error => {
        console.error('Error creating label:', error);
        alert('Error creating label: ' + error.message);
    });
}

function toggleCardLabel(cardId, labelId, isSelected) {
    console.log('Toggling label:', labelId, isSelected, 'for card:', cardId);
    
    const method = isSelected ? 'POST' : 'DELETE';
    const url = `/api/cards/${cardId}/labels/${labelId}`;
    
    fetch(url, {
        method: method
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Failed to ${isSelected ? 'add' : 'remove'} label`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Label toggled successfully:', data);
        // Update UI immediately
        const labelItem = document.querySelector(`[data-label-id="${labelId}"]`);
        if (labelItem) {
            if (isSelected) {
                labelItem.classList.add('selected');
            } else {
                labelItem.classList.remove('selected');
            }
        }
        // Refresh card details to show updated labels
        openCardDetails(cardId);
    })
    .catch(error => {
        console.error('Error toggling label:', error);
        alert('Error toggling label: ' + error.message);
    });
}

function editLabel(labelId) {
    const labelItem = document.querySelector(`[data-label-id="${labelId}"]`);
    const labelName = labelItem.querySelector('.label-name').textContent;
    const labelColor = labelItem.querySelector('.label-color').style.backgroundColor;
    
    // Convert RGB to hex
    const rgbToHex = (rgb) => {
        const result = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(rgb);
        return result ? '#' + 
            ('0' + parseInt(result[1]).toString(16)).slice(-2) +
            ('0' + parseInt(result[2]).toString(16)).slice(-2) +
            ('0' + parseInt(result[3]).toString(16)).slice(-2) : '#0079bf';
    };
    
    const hexColor = rgbToHex(labelColor);
    
    // Replace label item with edit form
    labelItem.outerHTML = `
        <div class="label-item edit-mode" data-label-id="${labelId}">
            <div class="label-color" style="background-color: ${hexColor}"></div>
            <input type="text" class="label-name-input" value="${escapeHtml(labelName)}">
            <div class="color-picker-small">
                ${getColorOptions().slice(0, 6).map(color => `
                    <div class="color-option ${color === hexColor ? 'selected' : ''}" 
                         style="background-color: ${color}"
                         onclick="selectEditColor('${color}', ${labelId})"
                         data-color="${color}"></div>
                `).join('')}
            </div>
            <div class="label-edit-actions">
                <button onclick="saveLabel(${labelId})" class="btn btn-primary btn-sm">Save</button>
                <button onclick="cancelEditLabel(${labelId}, '${escapeHtml(labelName)}', '${hexColor}')" 
                        class="btn btn-secondary btn-sm">Cancel</button>
                <button onclick="deleteLabel(${labelId})" class="btn btn-danger btn-sm">Delete</button>
            </div>
        </div>
    `;
}

function selectEditColor(color, labelId) {
    const labelItem = document.querySelector(`[data-label-id="${labelId}"]`);
    const labelColor = labelItem.querySelector('.label-color');
    labelColor.style.backgroundColor = color;
    
    // Update selected color
    labelItem.querySelectorAll('.color-option').forEach(option => {
        option.classList.remove('selected');
    });
    labelItem.querySelector(`[data-color="${color}"]`).classList.add('selected');
}

function saveLabel(labelId) {
    const labelItem = document.querySelector(`[data-label-id="${labelId}"]`);
    const nameInput = labelItem.querySelector('.label-name-input');
    const colorElement = labelItem.querySelector('.label-color');
    
    const name = nameInput ? nameInput.value.trim() : '';
    const color = colorElement ? colorElement.style.backgroundColor : '#0079bf';
    
    if (!name) {
        alert('Label name is required');
        return;
    }
    
    // Convert RGB to hex
    const rgbToHex = (rgb) => {
        const result = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(rgb);
        return result ? '#' + 
            ('0' + parseInt(result[1]).toString(16)).slice(-2) +
            ('0' + parseInt(result[2]).toString(16)).slice(-2) +
            ('0' + parseInt(result[3]).toString(16)).slice(-2) : '#0079bf';
    };
    
    const hexColor = rgbToHex(color);
    
    console.log('Updating label:', labelId, name, hexColor);
    
    fetch(`/api/labels/${labelId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: name,
            color: hexColor
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to update label');
        }
        return response.json();
    })
    .then(updatedLabel => {
        console.log('Label updated successfully:', updatedLabel);
        // Refresh label manager
        showLabelManager(currentCardId);
    })
    .catch(error => {
        console.error('Error updating label:', error);
        alert('Error updating label: ' + error.message);
    });
}

function cancelEditLabel(labelId, originalName, originalColor) {
    // Restore original label item
    const labelItem = document.querySelector(`[data-label-id="${labelId}"]`);
    labelItem.outerHTML = `
        <div class="label-item" data-label-id="${labelId}">
            <div class="label-color" style="background-color: ${originalColor}"></div>
            <span class="label-name">${originalName}</span>
            <div class="label-actions">
                <input type="checkbox">
                <button onclick="editLabel(${labelId})" class="btn-edit-label" title="Edit label">✏️</button>
            </div>
        </div>
    `;
}

function deleteLabel(labelId) {
    if (confirm('Are you sure you want to delete this label? This will remove it from all cards.')) {
        console.log('Deleting label:', labelId);
        
        fetch(`/api/labels/${labelId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to delete label');
            }
            return response.json();
        })
        .then(data => {
            console.log('Label deleted successfully');
            // Refresh label manager
            showLabelManager(currentCardId);
        })
        .catch(error => {
            console.error('Error deleting label:', error);
            alert('Error deleting label: ' + error.message);
        });
    }
}

function closeLabelModal() {
    const labelModal = document.getElementById('label-modal');
    if (labelModal) {
        labelModal.style.display = 'none';
    }
}

// Update the renderCardDetails function to include labels
function renderCardDetails(card) {
    currentCardId = card.id;
    const dueDate = card.due_date ? new Date(card.due_date).toISOString().split('T')[0] : '';
    
    return `
        <div class="card-details">
            <div class="card-details-header">
                <h3>Card Details</h3>
                <div class="card-meta">
                    <p><strong>Created by:</strong> ${escapeHtml(card.created_by.username)}</p>
                    <p><strong>Created:</strong> ${new Date(card.created_at).toLocaleDateString()}</p>
                </div>
            </div>
            
            <div class="card-details-content">
                <!-- Labels Section -->
                <div class="form-group">
                    <label>Labels:</label>
                    <div class="labels-section">
                        ${card.labels && card.labels.length > 0 ? renderCardLabels(card.labels) : ''}
                        <button onclick="showLabelManager(${card.id})" class="btn-edit-labels">
                            <span class="edit-labels-icon">🏷️</span>
                            Edit Labels
                        </button>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="card-details-title">Title:</label>
                    <input type="text" id="card-details-title" value="${escapeHtml(card.title)}" class="form-input">
                </div>
                
                <div class="form-group">
                    <label for="card-details-description">Description:</label>
                    <textarea id="card-details-description" class="form-textarea" rows="6" placeholder="Add a more detailed description...">${escapeHtml(card.description || '')}</textarea>
                </div>
                
                <div class="form-group">
                    <label for="card-details-due-date">Due Date:</label>
                    <input type="date" id="card-details-due-date" value="${dueDate}" class="form-input">
                </div>
                
                <!-- Checklists Section -->
                <div class="form-group">
                    <label>Checklists:</label>
                    <div class="checklists-container">
                        ${card.checklists && card.checklists.length > 0 ? 
                            renderCardChecklists(card.checklists) : 
                            `<button onclick="showAddChecklistForm(${card.id})" class="btn-add-checklist">
                                <span class="add-checklist-icon">✅</span>
                                Add Checklist
                            </button>`
                        }
                    </div>
                </div>
                
                <!-- File Attachments Section -->
                <div class="form-group">
                    <label>Attachments:</label>
                    <div class="attachments-section">
                        ${renderCardAttachments(card.attachments || [])}
                        
                        <!-- File Upload Area -->
                        <div class="file-upload-area" onclick="showFileUploadForm(${card.id})">
                            <div class="file-upload-prompt">
                                <div class="upload-icon">📎</div>
                                <div class="upload-text">Click to upload or drag and drop</div>
                                <div class="upload-hint">Max file size: 16MB</div>
                            </div>
                        </div>
                        
                        <!-- Hidden file input -->
                        <input type="file" id="file-upload-input" style="display: none;" onchange="handleFileUpload(event)">
                    </div>
                </div>
            </div>
            
            <div class="card-details-actions">
                <button onclick="saveCardDetails(${card.id})" class="btn btn-primary">Save Changes</button>
                <button onclick="closeCardModal()" class="btn btn-secondary">Close</button>
                <button onclick="deleteCardFromDetails(${card.id})" class="btn btn-danger">Delete Card</button>
            </div>
        </div>
    `;
}

// Update the renderCards function to show labels on cards
function renderCards(cards, listId) {
    console.log('Rendering cards:', cards.length);
    
    if (cards.length === 0) {
        return '<div class="drop-zone-empty">Drop cards here</div>';
    }
    
    return cards.map(card => `
        <div class="card" data-card-id="${card.id}" data-list-id="${listId}" draggable="true" onclick="openCardDetails(${card.id})">
            ${card.labels && card.labels.length > 0 ? `
                <div class="card-labels-preview">
                    ${card.labels.map(label => `
                        <span class="card-label-preview" style="background-color: ${label.color}" title="${escapeHtml(label.name)}"></span>
                    `).join('')}
                </div>
            ` : ''}
            <div class="card-content">
                ${card.due_date ? renderDueDate(card.due_date) : ''}
                <div class="card-title">${escapeHtml(card.title)}</div>
                ${card.description ? `<div class="card-description">${escapeHtml(card.description)}</div>` : ''}
                ${renderCardBadges(card)}
                ${card.attachments && card.attachments.length > 0 ? `
                    <div class="card-attachment-badge">
                        📎 ${card.attachments.length}
                    </div>
                ` : ''}
                <div class="card-meta">
                    <div class="card-creator">
                        Created by: ${escapeHtml(card.created_by.username)}
                    </div>
                </div>
            </div>
            <div class="card-actions">
                <button onclick="event.stopPropagation(); deleteCard(${card.id})" class="btn-delete-card" title="Delete card">×</button>
            </div>
        </div>
    `).join('');
}

// Update renderCardBadges to include label badge
function renderCardBadges(card) {
    const badges = [];
    
    if (card.description) {
        badges.push('<span class="card-badge description-badge" title="Has description">📝</span>');
    }
    
    if (card.due_date) {
        badges.push('<span class="card-badge due-date-badge" title="Has due date">📅</span>');
    }
    
    if (card.attachments && card.attachments.length > 0) {
        badges.push(`<span class="card-badge attachment-badge" title="${card.attachments.length} attachment${card.attachments.length !== 1 ? 's' : ''}">📎</span>`);
    }
    
    if (card.checklists && card.checklists.length > 0) {
        const totalItems = card.checklists.reduce((sum, cl) => sum + cl.total_count, 0);
        const completedItems = card.checklists.reduce((sum, cl) => sum + cl.completed_count, 0);
        badges.push(`<span class="card-badge checklist-badge" title="${completedItems}/${totalItems} checklist items completed">✅</span>`);
    }
    
    if (card.labels && card.labels.length > 0) {
        badges.push(`<span class="card-badge label-badge" title="${card.labels.length} label${card.labels.length !== 1 ? 's' : ''}">🏷️</span>`);
    }
    
    return badges.length > 0 ? `
        <div class="card-badges">
            ${badges.join('')}
        </div>
    ` : '';
}

// Search Functions
let searchTimeout;
let currentSearchQuery = '';

function initializeSearch() {
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            currentSearchQuery = e.target.value.trim();
            clearTimeout(searchTimeout);
            
            if (currentSearchQuery.length === 0) {
                hideSearchResults();
                return;
            }
            
            if (currentSearchQuery.length < 2) {
                return;
            }
            
            searchTimeout = setTimeout(() => {
                performQuickSearch(currentSearchQuery);
            }, 300);
        });
        
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
        
        // Close search results when clicking outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.search-container')) {
                hideSearchResults();
            }
        });
    }
}

function performQuickSearch(query) {
    console.log('Performing quick search:', query);
    
    fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Search failed');
            }
            return response.json();
        })
        .then(searchResults => {
            displayQuickSearchResults(searchResults, query);
        })
        .catch(error => {
            console.error('Error performing search:', error);
            hideSearchResults();
        });
}

function displayQuickSearchResults(results, query) {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;
    
    if (results.total_results === 0) {
        resultsContainer.innerHTML = `
            <div class="search-no-results">
                <p>No results found for "${escapeHtml(query)}"</p>
            </div>
        `;
    } else {
        let html = '';
        
        // Show top 5 cards
        if (results.cards && results.cards.length > 0) {
            html += `<div class="search-section">
                        <div class="search-section-title">Cards (${results.cards.length})</div>`;
            
            results.cards.slice(0, 5).forEach(card => {
                html += renderSearchCardItem(card, query);
            });
            
            if (results.cards.length > 5) {
                html += `<div class="search-show-more" onclick="performSearch()">
                            Show ${results.cards.length - 5} more cards...
                         </div>`;
            }
            
            html += '</div>';
        }
        
        // Show top 3 boards
        if (results.boards && results.boards.length > 0) {
            html += `<div class="search-section">
                        <div class="search-section-title">Boards (${results.boards.length})</div>`;
            
            results.boards.slice(0, 3).forEach(board => {
                html += renderSearchBoardItem(board, query);
            });
            
            if (results.boards.length > 3) {
                html += `<div class="search-show-more" onclick="performSearch()">
                            Show ${results.boards.length - 3} more boards...
                         </div>`;
            }
            
            html += '</div>';
        }
        
        html += `<div class="search-view-all" onclick="performSearch()">
                    View all ${results.total_results} results
                 </div>`;
        
        resultsContainer.innerHTML = html;
    }
    
    resultsContainer.style.display = 'block';
}

function renderSearchCardItem(card, query) {
    const highlightedTitle = highlightText(card.title, query);
    const hasDescription = card.description && card.description.includes(query);
    const hasChecklistItems = card.matching_checklist_items && card.matching_checklist_items.length > 0;
    const hasLabelMatch = card.matched_via_label;
    
    return `
        <div class="search-result-item" onclick="openCardFromSearch(${card.id})">
            <div class="search-result-type">📋 Card</div>
            <div class="search-result-title">${highlightedTitle}</div>
            ${card.description ? `
                <div class="search-result-description">
                    ${hasDescription ? highlightText(card.description.substring(0, 100), query) : card.description.substring(0, 100)}
                </div>
            ` : ''}
            <div class="search-result-meta">
                <span class="search-result-board">in ${escapeHtml(card.board.title)}</span>
                <span class="search-result-list">• ${escapeHtml(card.list.title)}</span>
            </div>
            ${hasChecklistItems ? `
                <div class="search-result-context">
                    <span class="context-label">Checklist:</span>
                    ${card.matching_checklist_items.slice(0, 2).map(item => 
                        `<span class="context-item">${highlightText(item.item_text, query)}</span>`
                    ).join('')}
                </div>
            ` : ''}
            ${hasLabelMatch ? `
                <div class="search-result-context">
                    <span class="context-label">Label:</span>
                    <span class="context-item">${highlightText(card.labels[0].name, query)}</span>
                </div>
            ` : ''}
            ${card.labels && card.labels.length > 0 ? `
                <div class="search-result-labels">
                    ${card.labels.map(label => `
                        <span class="search-label" style="background-color: ${label.color}; color: ${getContrastColor(label.color)}">
                            ${escapeHtml(label.name)}
                        </span>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

function renderSearchBoardItem(board, query) {
    const highlightedTitle = highlightText(board.title, query);
    const highlightedDescription = board.description ? highlightText(board.description, query) : '';
    
    return `
        <div class="search-result-item" onclick="openBoardFromSearch(${board.id})">
            <div class="search-result-type">📁 Board</div>
            <div class="search-result-title">${highlightedTitle}</div>
            ${board.description ? `
                <div class="search-result-description">${highlightedDescription}</div>
            ` : ''}
            <div class="search-result-meta">
                <span class="search-result-owner">by ${escapeHtml(board.owner.username)}</span>
            </div>
        </div>
    `;
}

function highlightText(text, query) {
    if (!text || !query) return escapeHtml(text);
    
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return escapeHtml(text).replace(regex, '<mark>$1</mark>');
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function performSearch() {
    const searchInput = document.getElementById('global-search');
    const query = searchInput ? searchInput.value.trim() : currentSearchQuery;
    
    if (!query) {
        return;
    }
    
    console.log('Performing full search:', query);
    
    // Hide quick search results
    hideSearchResults();
    
    // Show search modal
    const searchModal = document.getElementById('search-modal');
    const searchModalBody = document.getElementById('search-modal-body');
    
    searchModalBody.innerHTML = `
        <div class="search-loading">
            <p>Searching for "${escapeHtml(query)}"...</p>
        </div>
    `;
    
    searchModal.style.display = 'block';
    
    fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Search failed');
            }
            return response.json();
        })
        .then(searchResults => {
            displayFullSearchResults(searchResults, query);
        })
        .catch(error => {
            console.error('Error performing search:', error);
            searchModalBody.innerHTML = `
                <div class="search-error">
                    <h3>Search Error</h3>
                    <p>${error.message}</p>
                    <button onclick="performSearch()" class="btn btn-primary">Try Again</button>
                </div>
            `;
        });
}

function displayFullSearchResults(results, query) {
    const searchModalBody = document.getElementById('search-modal-body');
    const searchStats = document.getElementById('search-stats');
    
    if (searchStats) {
        searchStats.innerHTML = `${results.total_results} results for "${escapeHtml(query)}"`;
    }
    
    if (results.total_results === 0) {
        searchModalBody.innerHTML = `
            <div class="search-no-results-full">
                <div class="no-results-icon">🔍</div>
                <h3>No results found</h3>
                <p>We couldn't find any cards or boards matching "${escapeHtml(query)}"</p>
                <div class="search-tips">
                    <h4>Search tips:</h4>
                    <ul>
                        <li>Try different keywords</li>
                        <li>Check your spelling</li>
                        <li>Search in card titles, descriptions, or checklist items</li>
                        <li>Search for label names</li>
                    </ul>
                </div>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    // Cards section
    if (results.cards && results.cards.length > 0) {
        html += `<div class="search-results-section">
                    <h4 class="search-section-header">
                        <span class="section-icon">📋</span>
                        Cards (${results.cards.length})
                    </h4>
                    <div class="search-results-grid">`;
        
        results.cards.forEach(card => {
            html += renderSearchCardFull(card, query);
        });
        
        html += `</div></div>`;
    }
    
    // Boards section
    if (results.boards && results.boards.length > 0) {
        html += `<div class="search-results-section">
                    <h4 class="search-section-header">
                        <span class="section-icon">📁</span>
                        Boards (${results.boards.length})
                    </h4>
                    <div class="search-results-grid">`;
        
        results.boards.forEach(board => {
            html += renderSearchBoardFull(board, query);
        });
        
        html += `</div></div>`;
    }
    
    searchModalBody.innerHTML = html;
}

function renderSearchCardFull(card, query) {
    const highlightedTitle = highlightText(card.title, query);
    const hasDescription = card.description && card.description.includes(query);
    const hasChecklistItems = card.matching_checklist_items && card.matching_checklist_items.length > 0;
    
    return `
        <div class="search-result-card" onclick="openCardFromSearch(${card.id})">
            <div class="search-card-header">
                <div class="search-card-type">📋 Card</div>
                ${card.due_date ? `
                    <div class="search-card-due-date ${isOverdue(card.due_date) ? 'overdue' : ''}">
                        📅 ${new Date(card.due_date).toLocaleDateString()}
                    </div>
                ` : ''}
            </div>
            <div class="search-card-title">${highlightedTitle}</div>
            ${card.description ? `
                <div class="search-card-description">
                    ${hasDescription ? highlightText(card.description, query) : escapeHtml(card.description)}
                </div>
            ` : ''}
            ${hasChecklistItems ? `
                <div class="search-card-checklist">
                    <strong>Matching checklist items:</strong>
                    <div class="checklist-items">
                        ${card.matching_checklist_items.map(item => `
                            <div class="checklist-item ${item.is_completed ? 'completed' : ''}">
                                <span class="checklist-title">${escapeHtml(item.checklist_title)}:</span>
                                ${highlightText(item.item_text, query)}
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            <div class="search-card-meta">
                <div class="search-card-location">
                    in <strong>${escapeHtml(card.board.title)}</strong> • 
                    <span class="search-card-list">${escapeHtml(card.list.title)}</span>
                </div>
                <div class="search-card-author">
                    by ${escapeHtml(card.created_by.username)}
                </div>
            </div>
            ${card.labels && card.labels.length > 0 ? `
                <div class="search-card-labels">
                    ${card.labels.map(label => `
                        <span class="search-card-label" style="background-color: ${label.color}; color: ${getContrastColor(label.color)}">
                            ${escapeHtml(label.name)}
                        </span>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

function renderSearchBoardFull(board, query) {
    const highlightedTitle = highlightText(board.title, query);
    const highlightedDescription = board.description ? highlightText(board.description, query) : '';
    
    return `
        <div class="search-result-board" onclick="openBoardFromSearch(${board.id})">
            <div class="search-board-header">
                <div class="search-board-type">📁 Board</div>
            </div>
            <div class="search-board-title">${highlightedTitle}</div>
            ${board.description ? `
                <div class="search-board-description">${highlightedDescription}</div>
            ` : ''}
            <div class="search-board-meta">
                <div class="search-board-owner">
                    by <strong>${escapeHtml(board.owner.username)}</strong>
                </div>
            </div>
        </div>
    `;
}

function isOverdue(dueDate) {
    return new Date(dueDate) < new Date();
}

function openCardFromSearch(cardId) {
    console.log('Opening card from search:', cardId);
    closeSearchModal();
    openCardDetails(cardId);
}

function openBoardFromSearch(boardId) {
    console.log('Opening board from search:', boardId);
    closeSearchModal();
    openBoard(boardId);
}

function closeSearchModal() {
    const searchModal = document.getElementById('search-modal');
    if (searchModal) {
        searchModal.style.display = 'none';
    }
}

function hideSearchResults() {
    const resultsContainer = document.getElementById('search-results');
    if (resultsContainer) {
        resultsContainer.style.display = 'none';
    }
}

// Board-specific search
function performBoardSearch(boardId) {
    const query = prompt('Search in this board:');
    if (!query) return;
    
    console.log('Performing board search:', query, 'in board:', boardId);
    
    fetch(`/api/boards/${boardId}/search?q=${encodeURIComponent(query)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Board search failed');
            }
            return response.json();
        })
        .then(searchResults => {
            displayBoardSearchResults(searchResults, query, boardId);
        })
        .catch(error => {
            console.error('Error performing board search:', error);
            alert('Search error: ' + error.message);
        });
}

function displayBoardSearchResults(results, query, boardId) {
    const searchModal = document.getElementById('search-modal');
    const searchModalBody = document.getElementById('search-modal-body');
    const searchStats = document.getElementById('search-stats');
    
    if (searchStats) {
        searchStats.innerHTML = `${results.total_results} results in this board for "${escapeHtml(query)}"`;
    }
    
    if (results.total_results === 0) {
        searchModalBody.innerHTML = `
            <div class="search-no-results-full">
                <div class="no-results-icon">🔍</div>
                <h3>No results found in this board</h3>
                <p>We couldn't find any cards matching "${escapeHtml(query)}"</p>
            </div>
        `;
    } else {
        let html = `<div class="search-results-section">
                      <h4 class="search-section-header">
                          <span class="section-icon">📋</span>
                          Cards (${results.cards.length})
                      </h4>
                      <div class="search-results-grid">`;
        
        results.cards.forEach(card => {
            html += renderSearchCardFull(card, query);
        });
        
        html += `</div></div>`;
        searchModalBody.innerHTML = html;
    }
    
    searchModal.style.display = 'block';
}

// Update the openBoard function to add search button
function renderBoardView(board) {
    console.log('Rendering board view for:', board.title);
    return `
        <div class="board-view">
            <div class="board-header">
                <div class="board-title-section">
                    <h2>${escapeHtml(board.title)}</h2>
                    <p class="board-description">${escapeHtml(board.description || 'No description')}</p>
                </div>
                <div class="board-actions">
                    <button onclick="performBoardSearch(${board.id})" class="btn btn-secondary" title="Search in this board">
                        🔍 Search
                    </button>
                    ${board.is_owner ? `<button onclick="openBoardSettings(${board.id})" class="btn btn-secondary">Board Settings</button>` : ''}
                    <button onclick="showAddListForm()" class="btn btn-primary">+ Add List</button>
                    <button onclick="closeBoardModal()" class="btn btn-secondary">Close Board</button>
                </div>
            </div>
            
            <div class="board-members-bar">
                <div class="members-list">
                    <span class="members-label">Members:</span>
                    ${renderMembersPreview(board.members, board.owner)}
                </div>
                ${board.is_owner ? `<button onclick="showAddMemberForm()" class="btn btn-outline">+ Add Member</button>` : ''}
            </div>
            
            <div class="lists-container" id="lists-container">
                ${renderLists(board.lists || [])}
                
                <!-- Add List Form (initially hidden) -->
                <div class="list add-list-form" id="add-list-form" style="display: none;">
                    <div class="list-header">
                        <h4>Add New List</h4>
                    </div>
                    <div class="list-content">
                        <input type="text" id="new-list-title" placeholder="Enter list title" class="list-input">
                        <div class="list-form-actions">
                            <button onclick="createList()" class="btn btn-primary">Add List</button>
                            <button onclick="hideAddListForm()" class="btn btn-secondary">Cancel</button>
                        </div>
                    </div>
                </div>
                
                <!-- Add List Button (always visible) -->
                <div class="list add-list-button">
                    <button onclick="showAddListForm()" class="btn-add-list">
                        + Add Another List
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Card Details Modal -->
        <div id="card-modal" class="modal">
            <div class="modal-content card-modal-content">
                <span class="close">&times;</span>
                <div id="card-modal-body">
                    <!-- Card details will be loaded here -->
                </div>
            </div>
        </div>
        
        <!-- Label Modal -->
        <div id="label-modal" class="modal">
            <div class="modal-content label-modal-content">
                <span class="close">&times;</span>
                <div id="label-modal-body">
                    <!-- Label manager will be loaded here -->
                </div>
            </div>
        </div>
    `;
}
