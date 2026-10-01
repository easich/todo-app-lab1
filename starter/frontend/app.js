// =============================================================================
// API CONFIGURATION
// =============================================================================
// This is the base URL of our Flask backend. Every API call will be prefixed
// with this string. Keeping it in one constant means we only need to change
// it in one place if the server address ever changes (e.g. moving to production).
const API_BASE_URL = 'http://127.0.0.1:5000/api';


// =============================================================================
// STATE MANAGEMENT
// =============================================================================
// "State" is the data the app needs to remember between user interactions.
// We store it in module-level variables so every function can read and update it.

// The full list of todos fetched from the server. We keep a local copy so we
// can filter and re-render without making a new network request every time.
let todos = [];

// Tracks which filter tab is active: 'all' | 'active' | 'completed'.
// Defaults to 'all' so the user sees everything on first load.
let currentFilter = 'all';


// =============================================================================
// DOM ELEMENT REFERENCES
// =============================================================================
// We grab references to the HTML elements we need to read from or write to.
// Doing this once at startup is faster than calling getElementById() repeatedly
// inside functions that run on every render.
const todoTitleInput       = document.getElementById('todoTitle');
const todoDescriptionInput = document.getElementById('todoDescription');
const addBtn               = document.getElementById('addBtn');
const todoList             = document.getElementById('todoList');
const emptyState           = document.getElementById('emptyState');
const filterBtns           = document.querySelectorAll('.filter-btn');
const totalCount           = document.getElementById('totalCount');
const activeCount          = document.getElementById('activeCount');
const completedCount       = document.getElementById('completedCount');
const toast                = document.getElementById('toast');


// =============================================================================
// APP INITIALIZATION
// =============================================================================
// 'DOMContentLoaded' fires once the browser has fully parsed the HTML and built
// the DOM tree — but before images and stylesheets finish loading. This is the
// right moment to attach event listeners and make the first API call, because
// all our getElementById() calls above are guaranteed to succeed.
document.addEventListener('DOMContentLoaded', () => {
    loadTodos();          // Fetch todos from the server right away
    setupEventListeners(); // Wire up buttons and keyboard shortcuts
});


// =============================================================================
// EVENT LISTENERS
// =============================================================================
// Centralising all event listener setup in one function keeps the initialisation
// logic clean and makes it easy to see every user interaction at a glance.
function setupEventListeners() {
    // Clicking the "Add Todo" button submits the form
    addBtn.addEventListener('click', handleAddTodo);

    // Pressing Enter inside the title input is a common shortcut users expect —
    // this makes the app feel more natural without any extra UI.
    todoTitleInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleAddTodo();
        }
    });

    // Each filter button stores its filter value in a data-filter HTML attribute
    // (e.g. data-filter="active"). When clicked, we read that value, update
    // currentFilter, swap the 'active' CSS class for visual feedback, then
    // re-render the list — no network request needed because we already have
    // all todos in memory.
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentFilter = btn.dataset.filter;
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderTodos();
        });
    });
}


// =============================================================================
// API FUNCTIONS  —  How network requests work
// =============================================================================
//
// WHY async/await?
// ----------------
// Network requests take time — the browser has to send a request to the server
// and wait for a response. JavaScript is single-threaded, so if we blocked and
// waited synchronously the entire page would freeze until the response arrived.
//
// The solution is Promises: a Promise represents a value that will be available
// in the future. `async/await` is syntactic sugar over Promises that lets us
// write asynchronous code that reads like normal top-to-bottom code:
//
//   // Without async/await (harder to read):
//   fetch(url).then(res => res.json()).then(data => { ... }).catch(err => { ... });
//
//   // With async/await (reads like synchronous code):
//   const res  = await fetch(url);
//   const data = await res.json();
//
// The `await` keyword pauses execution of the current function until the Promise
// resolves — but it does NOT block the browser. Other events (clicks, animations)
// keep working normally while we wait.
//
// HOW error handling works
// ------------------------
// We wrap every async operation in a try/catch block.
//
//   try {
//       // Code that might fail goes here.
//       // If ANY awaited call throws (network error, bad status, etc.),
//       // execution immediately jumps to the catch block.
//   } catch (error) {
//       // `error` is the thrown value — usually an Error object with a message.
//       // We log it to the console for debugging and show a toast to the user.
//   } finally {
//       // Code here runs regardless of success or failure — useful for
//       // cleanup tasks like hiding a loading spinner.
//   }
//
// We also check `response.ok` after every fetch(). The fetch() API only rejects
// its Promise on network failures (e.g. server unreachable). A 404 or 500
// response from the server is considered a "successful" fetch, so we must
// explicitly check response.ok (true for 200–299) and throw manually to route
// those cases through the catch block too.
// =============================================================================


// -----------------------------------------------------------------------------
// loadTodos — GET /api/todos
// -----------------------------------------------------------------------------
// Called once on startup and never again. Fetches the full list of todos from
// the server and stores them in the `todos` state variable.
//
// Flow:
//   1. Show a loading spinner while we wait for the response
//   2. GET /api/todos  →  server returns a JSON array, e.g.:
//      [{ id: 1, title: "Buy milk", completed: false, ... }, ...]
//   3. Store the array in `todos`, then render the UI
//   4. Hide the spinner whether the request succeeded or failed (finally block)
async function loadTodos() {
    try {
        showLoading();

        // fetch() sends an HTTP GET request (the default method) and returns a
        // Promise that resolves to a Response object once the server replies.
        const response = await fetch(`${API_BASE_URL}/todos`);

        // response.ok is true for HTTP 200–299. If the server returned an error
        // status (e.g. 500), we throw so the catch block handles it.
        if (!response.ok) {
            throw new Error('Failed to load todos');
        }

        // response.json() reads the response body and parses it from a JSON
        // string into a JavaScript array/object. It is also async, so we await it.
        todos = await response.json();

        renderTodos();   // Draw the todo cards in the DOM
        updateStats();   // Update the Total / Active / Completed counters
    } catch (error) {
        // console.error writes to the browser DevTools console (F12 → Console).
        // This is for developers — it shows the full error object with a stack trace.
        console.error('Error loading todos:', error);

        // showToast shows a brief message to the user. We never show raw error
        // messages to users because they are often technical and unhelpful.
        showToast('Failed to load todos', 'error');
    } finally {
        // The finally block always runs — even if an error was thrown above.
        // We use it to hide the loading spinner so the UI never gets stuck.
        hideLoading();
    }
}


// -----------------------------------------------------------------------------
// createTodo — POST /api/todos
// -----------------------------------------------------------------------------
// Sends a new todo to the server. On success, prepends it to the local `todos`
// array and re-renders, so the UI updates instantly without a full reload.
//
// Parameters:
//   title       — the todo title (required, already validated by handleAddTodo)
//   description — optional extra detail (may be an empty string)
//
// Flow:
//   1. POST /api/todos  with JSON body  { title, description }
//   2. Server creates the record, assigns an id, and returns the new todo object
//   3. We prepend it to `todos` with unshift() so it appears at the top of the list
//   4. Re-render and show a success toast
async function createTodo(title, description) {
    try {
        const response = await fetch(`${API_BASE_URL}/todos`, {
            method: 'POST',

            // Headers tell the server what format we're sending. Without
            // 'Content-Type': 'application/json', Flask won't parse the body
            // as JSON and request.get_json() will return None.
            headers: {
                'Content-Type': 'application/json',
            },

            // The body must be a string, not a JS object — JSON.stringify()
            // converts { title: "Buy milk", description: "" }  into the string
            // '{"title":"Buy milk","description":""}'
            body: JSON.stringify({ title, description })
        });

        if (!response.ok) {
            throw new Error('Failed to create todo');
        }

        // The server returns the newly created todo (with its server-assigned id
        // and created_at timestamp) — we use that authoritative object rather than
        // constructing one ourselves.
        const newTodo = await response.json();

        // unshift() adds to the front of the array (index 0) so the newest todo
        // appears at the top of the list, matching the server's ordering.
        todos.unshift(newTodo);
        renderTodos();
        updateStats();
        showToast('Todo added successfully!', 'success');

        return newTodo; // Returned so handleAddTodo() can clear the form on success
    } catch (error) {
        console.error('Error creating todo:', error);
        showToast('Failed to add todo', 'error');

        // Re-throw the error so handleAddTodo()'s .then() is skipped — the form
        // inputs are NOT cleared when a create fails, preserving the user's text.
        throw error;
    }
}


// -----------------------------------------------------------------------------
// updateTodo — PUT /api/todos/<id>
// -----------------------------------------------------------------------------
// Sends a partial update to the server. Only the fields included in `updates`
// are changed — other fields are left untouched (the backend supports this).
//
// Parameters:
//   id      — the numeric id of the todo to update
//   updates — an object containing only the fields to change, e.g. { completed: true }
//
// Flow:
//   1. PUT /api/todos/<id>  with JSON body  { completed: true }
//   2. Server updates only the fields provided and returns the full updated todo
//   3. We find the old todo in the local array by id and replace it in-place
//   4. Re-render to reflect the change (e.g. strike-through for completed todos)
async function updateTodo(id, updates) {
    try {
        // Template literal `${id}` interpolates the todo's id into the URL path,
        // producing e.g. 'http://127.0.0.1:5000/api/todos/3'
        const response = await fetch(`${API_BASE_URL}/todos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });

        if (!response.ok) {
            throw new Error('Failed to update todo');
        }

        const updatedTodo = await response.json();

        // findIndex() scans the array and returns the position of the todo whose
        // id matches. Returns -1 if not found (shouldn't happen in normal usage).
        const index = todos.findIndex(t => t.id === id);
        if (index !== -1) {
            // Replace the old object at that index with the server's updated version.
            // This ensures our local state always mirrors the server's truth.
            todos[index] = updatedTodo;
        }

        renderTodos();
        updateStats();

        return updatedTodo;
    } catch (error) {
        console.error('Error updating todo:', error);
        showToast('Failed to update todo', 'error');
        throw error;
    }
}


// -----------------------------------------------------------------------------
// deleteTodo — DELETE /api/todos/<id>
// -----------------------------------------------------------------------------
// Asks the server to permanently remove a todo, then removes it from the
// local array so the UI updates without a full reload.
//
// Parameters:
//   id — the numeric id of the todo to delete
//
// Flow:
//   1. DELETE /api/todos/<id>  (no body needed — the id is in the URL)
//   2. Server deletes the record and returns { message: "Todo deleted successfully" }
//   3. We filter `todos` to remove the deleted item from local state
//   4. Re-render and show a success toast
async function deleteTodo(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/todos/${id}`, {
            method: 'DELETE'
            // No Content-Type or body needed — DELETE requests carry no payload
        });

        if (!response.ok) {
            throw new Error('Failed to delete todo');
        }

        // Array.filter() returns a NEW array containing only items where the
        // callback returns true. This removes the deleted todo without mutating
        // the original array directly, which is a safer pattern.
        todos = todos.filter(t => t.id !== id);

        renderTodos();
        updateStats();
        showToast('Todo deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting todo:', error);
        showToast('Failed to delete todo', 'error');
        throw error;
    }
}


// =============================================================================
// UI HANDLER FUNCTIONS
// =============================================================================
// These functions sit between raw user events (clicks, keypresses) and the API
// functions above. They validate input and translate user intent into API calls.


// -----------------------------------------------------------------------------
// handleAddTodo
// -----------------------------------------------------------------------------
// Called when the user clicks "Add Todo" or presses Enter. Reads and validates
// the input fields before delegating to createTodo(). Clears the form on success.
function handleAddTodo() {
    // .trim() removes leading/trailing whitespace so "   " is treated as empty
    const title       = todoTitleInput.value.trim();
    const description = todoDescriptionInput.value.trim();

    // Client-side validation: catch the obvious mistake before wasting a network
    // round-trip. The backend also validates, but checking here gives instant feedback.
    if (!title) {
        showToast('Please enter a todo title', 'error');
        todoTitleInput.focus(); // Return focus to the field so the user can type
        return; // Stop here — don't call createTodo with an empty title
    }

    // createTodo() returns a Promise. We chain .then() to run the form-clear
    // logic ONLY if the API call succeeded. If it throws, the .then() is
    // skipped and the user's text is preserved so they can try again.
    createTodo(title, description).then(() => {
        todoTitleInput.value       = '';
        todoDescriptionInput.value = '';
        todoTitleInput.focus(); // Ready for the next todo immediately
    });
}


// -----------------------------------------------------------------------------
// handleToggleComplete
// -----------------------------------------------------------------------------
// Called when the user clicks a todo's checkbox. Sends only the `completed`
// field to the server — the backend leaves title and description unchanged.
//
// Parameters:
//   id        — the todo's id
//   completed — the checkbox's new checked state (true or false)
function handleToggleComplete(id, completed) {
    // Shorthand property: { completed } is equivalent to { completed: completed }
    updateTodo(id, { completed });
}


// -----------------------------------------------------------------------------
// handleDeleteTodo
// -----------------------------------------------------------------------------
// Called when the user clicks the 🗑️ button. Shows a confirmation dialog to
// prevent accidental deletions, then calls deleteTodo() if confirmed.
//
// Parameters:
//   id — the todo's id
function handleDeleteTodo(id) {
    // confirm() shows a browser-native dialog and returns true if the user
    // clicks OK, false if they click Cancel. Simple and requires no extra UI.
    if (confirm('Are you sure you want to delete this todo?')) {
        deleteTodo(id);
    }
}


// =============================================================================
// RENDERING FUNCTIONS
// =============================================================================
// These functions are responsible for turning the `todos` array in memory into
// visible HTML in the browser. They are "pure" in the sense that they only read
// state and update the DOM — they never make network calls.


// -----------------------------------------------------------------------------
// renderTodos
// -----------------------------------------------------------------------------
// The main render function. Called after every state change (load, create,
// update, delete, filter change). Rebuilds the entire todo list in the DOM.
function renderTodos() {
    const filteredTodos = getFilteredTodos(); // Apply the active filter first

    // Show the empty state placeholder when there's nothing to display
    if (filteredTodos.length === 0) {
        todoList.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    // .map() transforms each todo object into an HTML string.
    // .join('') concatenates the array of strings into one big HTML string.
    // Setting innerHTML replaces the entire list in one operation, which is
    // faster than appending elements one by one.
    todoList.innerHTML = filteredTodos.map(todo => createTodoElement(todo)).join('');

    // After setting innerHTML, the new elements exist in the DOM but have no
    // event listeners yet. We loop through and attach them now.
    // We use data-id attributes to link DOM elements back to their todo objects.
    filteredTodos.forEach(todo => {
        const todoElement = document.querySelector(`[data-id="${todo.id}"]`);
        if (todoElement) {
            const checkbox  = todoElement.querySelector('.todo-checkbox');
            const deleteBtn = todoElement.querySelector('.delete-btn');

            checkbox.addEventListener('change', () =>
                handleToggleComplete(todo.id, checkbox.checked)
            );
            deleteBtn.addEventListener('click', () =>
                handleDeleteTodo(todo.id)
            );
        }
    });
}


// -----------------------------------------------------------------------------
// createTodoElement
// -----------------------------------------------------------------------------
// Converts a single todo data object into an HTML string for injection into
// the DOM by renderTodos(). Uses a template literal for readable multi-line HTML.
//
// Parameters:
//   todo — a todo object: { id, title, description, completed, created_at }
//
// Returns:
//   A string of HTML representing one todo card
function createTodoElement(todo) {
    // The server stores created_at as an ISO 8601 string (e.g. "2024-01-15T10:30:00").
    // toLocaleDateString() converts it to a human-readable format like "Jan 15, 2024, 10:30 AM".
    const createdDate = new Date(todo.created_at).toLocaleDateString('en-US', {
        month:  'short',
        day:    'numeric',
        year:   'numeric',
        hour:   '2-digit',
        minute: '2-digit'
    });

    // Template literals (backtick strings) allow multi-line strings and ${} interpolation,
    // making it easy to embed dynamic values directly into HTML markup.
    return `
        <div class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
            <div class="todo-header">
                <input
                    type="checkbox"
                    class="todo-checkbox"
                    ${todo.completed ? 'checked' : ''}
                >
                <div class="todo-content">
                    <div class="todo-title">${escapeHtml(todo.title)}</div>
                    ${todo.description
                        ? `<div class="todo-description">${escapeHtml(todo.description)}</div>`
                        : ''}
                    <div class="todo-meta">Created: ${createdDate}</div>
                </div>
                <div class="todo-actions">
                    <button class="todo-btn delete-btn" title="Delete">🗑️</button>
                </div>
            </div>
        </div>
    `;
}


// -----------------------------------------------------------------------------
// getFilteredTodos
// -----------------------------------------------------------------------------
// Returns a filtered subset of `todos` based on `currentFilter`.
// Called by renderTodos() to decide what to show without altering the source array.
//
// Returns:
//   Array of todo objects matching the current filter
function getFilteredTodos() {
    switch (currentFilter) {
        case 'active':
            // Show only todos that are NOT yet complete
            return todos.filter(t => !t.completed);
        case 'completed':
            // Show only todos that ARE complete
            return todos.filter(t => t.completed);
        default:
            // 'all' — return every todo unchanged
            return todos;
    }
}


// -----------------------------------------------------------------------------
// updateStats
// -----------------------------------------------------------------------------
// Recalculates the Total / Active / Completed counters and writes them to the
// DOM. Called after every operation that could change the counts.
function updateStats() {
    const total     = todos.length;
    const active    = todos.filter(t => !t.completed).length;
    const completed = todos.filter(t =>  t.completed).length;

    // .textContent sets the visible text of a DOM element without interpreting
    // HTML tags — safer than innerHTML for displaying data values.
    totalCount.textContent     = total;
    activeCount.textContent    = active;
    completedCount.textContent = completed;
}


// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================


// -----------------------------------------------------------------------------
// showToast
// -----------------------------------------------------------------------------
// Displays a brief notification banner at the bottom of the screen, then hides
// it automatically after 3 seconds. CSS handles the slide-in/out animation.
//
// Parameters:
//   message — the text to display
//   type    — 'success' (green) or 'error' (red); controls the CSS class applied
function showToast(message, type = 'success') {
    toast.textContent = message;

    // Setting className replaces all existing classes at once, ensuring we don't
    // accidentally accumulate stale 'success'/'error' classes from previous toasts.
    toast.className = `toast ${type} show`;

    // setTimeout schedules a callback to run after 3000ms (3 seconds).
    // Removing the 'show' class triggers the CSS transition that slides the toast
    // back out of view.
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}


// -----------------------------------------------------------------------------
// showLoading / hideLoading
// -----------------------------------------------------------------------------
// Inserts a temporary "Loading todos..." placeholder while the initial fetch
// is in-flight, then removes it when the response arrives.
function showLoading() {
    todoList.innerHTML = '<div class="loading">Loading todos</div>';
    emptyState.classList.add('hidden'); // Hide "No todos yet" during load
}

function hideLoading() {
    const loadingElement = todoList.querySelector('.loading');
    if (loadingElement) {
        loadingElement.remove(); // Only remove it if it's still present
    }
}


// -----------------------------------------------------------------------------
// escapeHtml
// -----------------------------------------------------------------------------
// Sanitises user-supplied text before inserting it into the DOM as HTML.
//
// WHY this matters — Cross-Site Scripting (XSS):
// If a todo title is '<script>alert("hacked")</script>', and we naively inject
// it with innerHTML, the browser would execute that script. This is an XSS attack.
//
// The trick: create a throwaway <div>, set its textContent (which the browser
// treats as plain text — no HTML parsing), then read back innerHTML. The browser
// automatically escapes special characters:
//   <  →  &lt;
//   >  →  &gt;
//   &  →  &amp;
// The escaped string is now safe to embed inside an HTML template literal.
//
// Parameters:
//   text — the raw, potentially unsafe string from the server
//
// Returns:
//   A safely escaped string ready for HTML injection
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;   // Browser escapes special chars when reading back as HTML
    return div.innerHTML;
}


// =============================================================================
// GLOBAL ERROR HANDLING
// =============================================================================
// This catches any Promise rejections that weren't handled by a try/catch block
// elsewhere in the code — a safety net for unexpected errors. In normal operation
// this should never fire because every async function has its own error handling.
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showToast('An unexpected error occurred', 'error');
});


// =============================================================================
// SERVICE WORKER (Optional — Progressive Web App)
// =============================================================================
// A Service Worker is a background script that can cache assets and API responses,
// enabling the app to work offline. Uncomment the block below to enable it.
// Requires a separate sw.js file defining the caching strategy.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // navigator.serviceWorker.register('/sw.js')
        //     .then(registration => console.log('SW registered:', registration))
        //     .catch(error => console.log('SW registration failed:', error));
    });
}

// Made with Bob
