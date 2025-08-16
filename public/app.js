// Global variables
let currentUser = null;
let socket = null;
let whatsappConnected = false;

// Comprehensive browser extension error suppression
(function () {
    'use strict';

    // List of extension-related error patterns
    const extensionErrorPatterns = [
        'message channel closed',
        'listener indicated an asynchronous response',
        'Extension context invalidated',
        'chrome-extension://',
        'moz-extension://',
        'safari-extension://',
        'The message port closed before a response was received',
        'Could not establish connection',
        'Receiving end does not exist'
    ];

    // Function to check if error is extension-related
    function isExtensionError(message) {
        if (!message) return false;
        return extensionErrorPatterns.some(pattern =>
            message.toLowerCase().includes(pattern.toLowerCase())
        );
    }

    // Handle unhandled promise rejections (most common source)
    window.addEventListener('unhandledrejection', function (event) {
        const message = event.reason?.message || event.reason?.toString() || '';
        if (isExtensionError(message)) {
            event.preventDefault();
            event.stopPropagation();
            // Optionally log for debugging (remove in production)
            // console.log('🔇 Suppressed extension error:', message);
            return false;
        }
    }, true);

    // Handle general JavaScript errors
    window.addEventListener('error', function (event) {
        const message = event.message || event.error?.message || '';
        if (isExtensionError(message)) {
            event.preventDefault();
            event.stopPropagation();
            // Optionally log for debugging (remove in production)
            // console.log('🔇 Suppressed extension error:', message);
            return false;
        }
    }, true);

    // Override console.error to filter extension errors
    const originalConsoleError = console.error;
    console.error = function (...args) {
        const message = args.join(' ');
        if (!isExtensionError(message)) {
            originalConsoleError.apply(console, args);
        }
    };

    // Suppress specific Chrome extension errors
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        const originalSendMessage = chrome.runtime.sendMessage;
        chrome.runtime.sendMessage = function (...args) {
            try {
                return originalSendMessage.apply(this, args);
            } catch (error) {
                if (isExtensionError(error.message)) {
                    return Promise.resolve();
                }
                throw error;
            }
        };
    }
})();

// Add immediate debugging
console.log('🔧 JavaScript file loaded');

// Test if DOM is ready
if (document.readyState === 'loading') {
    console.log('📄 DOM is still loading...');
} else {
    console.log('📄 DOM is already ready');
}

// Initialize app
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 App initializing...');

    // Test basic DOM elements
    const loginModal = document.getElementById('loginModal');
    const dashboardContent = document.getElementById('dashboardContent');
    console.log('🔍 DOM Elements Check:');
    console.log('  - Login Modal:', loginModal ? '✅ Found' : '❌ Missing');
    console.log('  - Dashboard:', dashboardContent ? '✅ Found' : '❌ Missing');

    // Initialize socket connection
    try {
        socket = io();
        console.log('📡 Socket initialized successfully');
    } catch (error) {
        console.error('❌ Socket initialization failed:', error);
    }

    // Socket event listeners
    socket.on('whatsapp-initializing', (message) => {
        showWhatsAppStatus(message, 'info');
    });

    socket.on('whatsapp-qr', (qr) => {
        console.log('Received QR code from server:', qr ? 'QR data received' : 'No QR data');
        showWhatsAppStatus('Scan QR code to connect WhatsApp', 'warning');
        displayQRCode(qr);
        updateWhatsAppButton(false);
    });

    socket.on('whatsapp-ready', () => {
        showWhatsAppStatus('WhatsApp connected successfully!', 'success');
        whatsappConnected = true;
        updateWhatsAppButton(true);
        hideQRModal();
    });

    socket.on('whatsapp-disconnected', () => {
        showWhatsAppStatus('WhatsApp disconnected', 'danger');
        whatsappConnected = false;
        updateWhatsAppButton(false);
    });

    socket.on('whatsapp-timeout', () => {
        showWhatsAppStatus('WhatsApp initialization timed out. Try restarting.', 'warning');
        const qrContainer = document.getElementById('qrCodeContainer');
        if (qrContainer) {
            qrContainer.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle"></i> QR generation timed out
                </div>
                <button class="btn btn-warning" onclick="restartWhatsApp()">
                    <i class="fas fa-redo"></i> Restart WhatsApp
                </button>
            `;
        }
    });

    socket.on('whatsapp-error', (error) => {
        showWhatsAppStatus('WhatsApp error: ' + error, 'danger');
        const qrContainer = document.getElementById('qrCodeContainer');
        if (qrContainer) {
            qrContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle"></i> ${error}
                </div>
                <button class="btn btn-warning" onclick="restartWhatsApp()">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            `;
        }
    });

    // Handle detailed error reporting
    socket.on('whatsapp-detailed-error', (errorData) => {
        console.error('WhatsApp detailed error:', errorData);
        showWhatsAppStatus(`WhatsApp Error: ${errorData.message}`, 'danger');

        const qrContainer = document.getElementById('qrCodeContainer');
        if (qrContainer) {
            let solutionHtml = '';

            // Provide specific solutions based on error type
            switch (errorData.type) {
                case 'chromium-missing':
                    solutionHtml = `
                        <div class="alert alert-info mt-2">
                            <strong>Solution:</strong> Run <code>npm install</code> to install missing dependencies.
                        </div>
                    `;
                    break;
                case 'navigation-timeout':
                    solutionHtml = `
                        <div class="alert alert-info mt-2">
                            <strong>Solution:</strong> Check your internet connection and try restarting.
                        </div>
                    `;
                    break;
                case 'protocol-error':
                    solutionHtml = `
                        <div class="alert alert-info mt-2">
                            <strong>Solution:</strong> Clear session data using "Reset All" button.
                        </div>
                    `;
                    break;
                case 'connection-refused':
                    solutionHtml = `
                        <div class="alert alert-info mt-2">
                            <strong>Solution:</strong> Check internet connection and firewall settings.
                        </div>
                    `;
                    break;
            }

            qrContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle"></i> <strong>WhatsApp Error</strong>
                    <hr>
                    <p><strong>Issue:</strong> ${errorData.message}</p>
                    <p><strong>Attempt:</strong> ${errorData.attempt}/${errorData.maxRetries}</p>
                    <small class="text-muted">Time: ${new Date(errorData.timestamp).toLocaleString()}</small>
                </div>
                ${solutionHtml}
                <div class="btn-group mt-3" role="group">
                    <button class="btn btn-success" onclick="fixWhatsApp()">
                        <i class="fas fa-wrench"></i> Quick Fix
                    </button>
                    <button class="btn btn-warning" onclick="restartWhatsApp()">
                        <i class="fas fa-redo"></i> Restart Service
                    </button>
                    <button class="btn btn-danger" onclick="resetWhatsAppService()">
                        <i class="fas fa-power-off"></i> Reset All
                    </button>
                </div>
                <div class="mt-2">
                    <small class="text-muted">
                        <strong>Debug Info:</strong> ${errorData.originalError}
                    </small>
                </div>
            `;
        }
    });

    // Handle retry notifications
    socket.on('whatsapp-retry', (retryData) => {
        showWhatsAppStatus(`Retrying WhatsApp connection... (${retryData.attempt}/${retryData.maxRetries})`, 'warning');
        const qrContainer = document.getElementById('qrCodeContainer');
        if (qrContainer) {
            qrContainer.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-redo"></i> <strong>Retrying Connection</strong>
                    <hr>
                    <p>Attempt ${retryData.attempt} of ${retryData.maxRetries} failed.</p>
                    <p>Next retry in ${retryData.nextRetryIn} seconds...</p>
                    <div class="progress mt-2">
                        <div class="progress-bar progress-bar-striped progress-bar-animated" 
                             role="progressbar" style="width: ${(retryData.attempt / retryData.maxRetries) * 100}%">
                        </div>
                    </div>
                </div>
            `;
        }
    });

    // Handle status updates
    socket.on('whatsapp-status-update', (statusData) => {
        console.log('WhatsApp status update:', statusData);
        if (statusData.status === 'qr-ready') {
            showWhatsAppStatus(statusData.message, 'success');
        }
    });

    // Handle state changes
    socket.on('whatsapp-state-change', (state) => {
        console.log('WhatsApp state changed to:', state);
        showWhatsAppStatus(`WhatsApp state: ${state}`, 'info');
    });

    socket.on('whatsapp-disabled', (message) => {
        showWhatsAppStatus(message, 'info');
        const qrContainer = document.getElementById('qrCodeContainer');
        if (qrContainer) {
            qrContainer.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i> WhatsApp Integration Disabled
                    <hr>
                    <p class="mb-2"><strong>Production Mode:</strong> WhatsApp is disabled in production for stability and resource optimization.</p>
                    <p class="mb-2"><strong>Task Management:</strong> All other features work normally - you can still assign tasks, track progress, and generate reports.</p>
                    <p class="mb-0"><strong>Notifications:</strong> Users will need to check the dashboard for task updates.</p>
                </div>
                <div class="mt-3">
                    <small class="text-muted">
                        <i class="fas fa-lightbulb"></i> 
                        <strong>Tip:</strong> For WhatsApp integration, run the application locally in development mode.
                    </small>
                </div>
            `;
        }

        // Update WhatsApp button to show disabled state
        updateWhatsAppButton(false, true);
    });

    // Handle real-time work completion updates
    socket.on('work-completed', (data) => {
        showNotification(`✅ Task "${data.title}" completed by ${data.completedBy}`, 'success');
        loadWorks(); // Refresh the work list
    });

    // Check if user is logged in
    const token = localStorage.getItem('token');
    console.log('🔑 Token check:', token ? 'Token found' : 'No token');

    if (token) {
        console.log('🔍 Validating existing token...');
        validateToken(token);
    } else {
        console.log('🚪 No token found, showing login modal...');
        showLoginModal();
    }

    // Form event listeners
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('assignWorkForm').addEventListener('submit', handleAssignWork);
});

// Authentication functions
function showLoginModal() {
    console.log('🚪 Attempting to show login modal...');
    try {
        const loginModalElement = document.getElementById('loginModal');
        console.log('🔍 Login modal element:', loginModalElement ? 'Found' : 'Not found');

        if (!loginModalElement) {
            console.error('❌ Login modal element not found in DOM');
            // Fallback: show a simple alert
            alert('Login system loading... Please refresh the page if this persists.');
            return;
        }

        const loginModal = new bootstrap.Modal(loginModalElement);
        loginModal.show();
        console.log('✅ Login modal should be visible now');
    } catch (error) {
        console.error('❌ Error showing login modal:', error);
        // Fallback: show a simple alert
        alert('Login system error. Please refresh the page.');
    }
}

async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            showDashboard();
            bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
}

async function validateToken(token) {
    try {
        const response = await fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            currentUser = await response.json();
            showDashboard();
        } else {
            localStorage.removeItem('token');
            showLoginModal();
        }
    } catch (error) {
        localStorage.removeItem('token');
        showLoginModal();
    }
}

function logout() {
    localStorage.removeItem('token');
    currentUser = null;
    document.getElementById('dashboardContent').style.display = 'none';
    showLoginModal();
}

// Dashboard functions
function showDashboard() {
    document.getElementById('userInfo').textContent = `${currentUser.name} (${currentUser.role})`;
    document.getElementById('dashboardContent').style.display = 'block';

    // Show assign work button for managers and admins
    if (['admin', 'manager'].includes(currentUser.role)) {
        document.getElementById('assignWorkBtn').style.display = 'inline-block';
        document.getElementById('reportsBtn').style.display = 'inline-block';
        loadUsers();
    }

    // Show WhatsApp button for admin only
    if (currentUser.role === 'admin') {
        document.getElementById('whatsappBtn').style.display = 'inline-block';
        updateWhatsAppButton(whatsappConnected);

        // Auto-check WhatsApp status and show connection popup if needed
        setTimeout(() => {
            checkWhatsAppStatusAndPrompt();
        }, 1000);
    }

    loadWorks();
}

// Work management functions
async function loadWorks() {
    try {
        const response = await fetch('/api/work', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        const works = await response.json();
        displayWorks(works);
    } catch (error) {
        alert('Failed to load works: ' + error.message);
    }
}

function displayWorks(works) {
    const workList = document.getElementById('workList');

    if (!works || works.length === 0) {
        workList.innerHTML = '<p class="text-muted">No work assignments found.</p>';
        return;
    }

    workList.innerHTML = works.map(work => {
        // Safety checks for work object properties
        if (!work || !work.assignedBy || !work.assignedTo) {
            console.warn('Invalid work object:', work);
            return '';
        }

        return `
            <div class="card mb-3 priority-${work.priority || 'medium'} status-${work.status || 'pending'}">
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-8">
                            <h6 class="card-title">${work.title || 'Untitled'}</h6>
                            <p class="card-text">${work.description || 'No description'}</p>
                            <small class="text-muted">
                                <i class="fas fa-user"></i> Assigned by: ${work.assignedBy?.name || 'Unknown'} |
                                <i class="fas fa-user-tag"></i> Assigned to: ${work.assignedTo?.name || 'Unknown'} |
                                <i class="fas fa-calendar"></i> Due: ${work.dueDate ? new Date(work.dueDate).toLocaleDateString() : 'No due date'}
                            </small>
                        </div>
                        <div class="col-md-4 text-end">
                            <span class="badge bg-${getPriorityColor(work.priority || 'medium')} mb-2">${(work.priority || 'medium').toUpperCase()}</span><br>
                            <span class="badge bg-${getStatusColor(work.status || 'pending')} mb-2">${(work.status || 'pending').toUpperCase()}</span><br>
                            ${work.assignedTo && work.assignedTo._id === currentUser.id ? `
                                <select class="form-select form-select-sm" onchange="updateWorkStatus('${work._id}', this.value)">
                                    <option value="pending" ${work.status === 'pending' ? 'selected' : ''}>Pending</option>
                                    <option value="in-progress" ${work.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                                    <option value="completed" ${work.status === 'completed' ? 'selected' : ''}>Completed</option>
                                </select>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).filter(html => html !== '').join('');
}

async function loadUsers() {
    try {
        const response = await fetch('/api/work/users', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        const users = await response.json();
        const assignToSelect = document.getElementById('assignTo');

        assignToSelect.innerHTML = '<option value="">Select User</option>' +
            users.map(user => `<option value="${user._id}">${user.name} (${user.role} - ${user.department})</option>`).join('');
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

function showAssignWorkModal() {
    const modal = new bootstrap.Modal(document.getElementById('assignWorkModal'));
    modal.show();
}

async function handleAssignWork(e) {
    e.preventDefault();

    const workData = {
        title: document.getElementById('workTitle').value,
        description: document.getElementById('workDescription').value,
        assignedTo: document.getElementById('assignTo').value,
        priority: document.getElementById('workPriority').value,
        dueDate: document.getElementById('workDueDate').value
    };

    try {
        const response = await fetch('/api/work', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(workData)
        });

        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('assignWorkModal')).hide();
            document.getElementById('assignWorkForm').reset();
            loadWorks();
            alert('Work assigned successfully!');
        } else {
            const error = await response.json();
            alert('Failed to assign work: ' + error.message);
        }
    } catch (error) {
        alert('Failed to assign work: ' + error.message);
    }
}

async function updateWorkStatus(workId, status) {
    try {
        const response = await fetch(`/api/work/${workId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ status })
        });

        if (response.ok) {
            loadWorks();
        } else {
            const error = await response.json();
            alert('Failed to update status: ' + error.message);
        }
    } catch (error) {
        alert('Failed to update status: ' + error.message);
    }
}

// Utility functions
function getPriorityColor(priority) {
    const colors = {
        low: 'success',
        medium: 'warning',
        high: 'danger',
        urgent: 'dark'
    };
    return colors[priority] || 'secondary';
}

function getStatusColor(status) {
    const colors = {
        pending: 'warning',
        'in-progress': 'info',
        completed: 'success',
        cancelled: 'danger'
    };
    return colors[status] || 'secondary';
}

function showWhatsAppStatus(message, type) {
    const statusDiv = document.getElementById('whatsappStatus');
    statusDiv.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            <i class="fab fa-whatsapp"></i> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
}

function showNotification(message, type) {
    const statusDiv = document.getElementById('whatsappStatus');
    statusDiv.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            <i class="fas fa-bell"></i> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;

    // Auto-hide after 5 seconds
    setTimeout(() => {
        const alert = statusDiv.querySelector('.alert');
        if (alert) {
            alert.remove();
        }
    }, 5000);
}

// WhatsApp QR Code Functions
function showWhatsAppModal() {
    const modal = new bootstrap.Modal(document.getElementById('whatsappQRModal'));
    modal.show();

    // Fix accessibility issue by removing aria-hidden when modal is shown
    const modalElement = document.getElementById('whatsappQRModal');
    modalElement.addEventListener('shown.bs.modal', function () {
        modalElement.removeAttribute('aria-hidden');
    });

    modalElement.addEventListener('hidden.bs.modal', function () {
        modalElement.setAttribute('aria-hidden', 'true');
    });

    // Check WhatsApp status first to determine what to show
    checkWhatsAppStatus();
}

// Function to automatically check WhatsApp status and prompt admin to connect
async function checkWhatsAppStatusAndPrompt() {
    if (currentUser.role !== 'admin') return;

    try {
        const response = await fetch('/api/whatsapp/status', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            const status = await response.json();

            // If WhatsApp is not connected and not in production mode, show prompt
            if (!status.isReady && !status.fallbackMode) {
                showWhatsAppConnectionPrompt();
            } else if (status.fallbackMode) {
                // WhatsApp is in fallback mode - could be disabled or having issues
                showWhatsAppConnectionPrompt(true);
            }
        }
    } catch (error) {
        console.error('Error checking WhatsApp status:', error);
    }
}

// Function to show a simple WhatsApp connection prompt
function showWhatsAppConnectionPrompt(isReset = false) {
    const message = isReset
        ? 'WhatsApp service needs to be reset. Would you like to connect WhatsApp for task notifications?'
        : 'WhatsApp is not connected. Would you like to connect it now for task notifications?';

    const promptHtml = `
        <div class="alert alert-warning alert-dismissible fade show whatsapp-prompt" role="alert">
            <i class="fab fa-whatsapp text-success"></i> <strong>WhatsApp Setup Required</strong>
            <hr>
            <p class="mb-3">${message}</p>
            <div class="d-flex gap-2 flex-wrap">
                <button class="btn btn-success btn-sm pulse-success" onclick="connectWhatsAppNow()">
                    <i class="fas fa-link"></i> Connect Now
                </button>
                <button class="btn btn-outline-secondary btn-sm" onclick="dismissWhatsAppPrompt()">
                    <i class="fas fa-clock"></i> Maybe Later
                </button>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert" onclick="dismissWhatsAppPrompt()"></button>
        </div>
    `;

    document.getElementById('whatsappStatus').innerHTML = promptHtml;
}

// Function to connect WhatsApp immediately
function connectWhatsAppNow() {
    dismissWhatsAppPrompt();
    showWhatsAppModal();
}

// Function to dismiss the WhatsApp prompt
function dismissWhatsAppPrompt() {
    document.getElementById('whatsappStatus').innerHTML = '';
}

// Function to check WhatsApp status
async function checkWhatsAppStatus() {
    try {
        const response = await fetch('/api/whatsapp/status', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            const status = await response.json();
            console.log('WhatsApp Status:', status);

            // Check if WhatsApp is disabled (production mode)
            if (status.fallbackMode && !status.isInitializing && !status.isReady) {
                // Show production disabled message
                const qrContainer = document.getElementById('qrCodeContainer');
                if (qrContainer) {
                    qrContainer.innerHTML = `
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle"></i> WhatsApp Integration Disabled
                            <hr>
                            <p class="mb-2"><strong>Production Mode:</strong> WhatsApp is disabled in production for stability and resource optimization.</p>
                            <p class="mb-2"><strong>Task Management:</strong> All other features work normally - you can still assign tasks, track progress, and generate reports.</p>
                            <p class="mb-0"><strong>Notifications:</strong> Users will need to check the dashboard for task updates.</p>
                        </div>
                        <div class="mt-3">
                            <small class="text-muted">
                                <i class="fas fa-lightbulb"></i> 
                                <strong>Tip:</strong> For WhatsApp integration, run the application locally in development mode.
                            </small>
                        </div>
                    `;
                }
                showWhatsAppStatus('WhatsApp integration is disabled in production for stability', 'info');
                updateWhatsAppButton(false, true);
            } else if (status.fallbackMode) {
                // Show fallback mode (development environment issue)
                showWhatsAppStatus('WhatsApp is in fallback mode. Click Reset Service to fix.', 'warning');
                const qrContainer = document.getElementById('qrCodeContainer');
                if (qrContainer) {
                    qrContainer.innerHTML = `
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle"></i> WhatsApp is in fallback mode
                        </div>
                        <div class="mt-3">
                            <button class="btn btn-danger btn-sm me-2" onclick="resetWhatsAppService()">
                                <i class="fas fa-power-off"></i> Reset Service
                            </button>
                            <button class="btn btn-warning btn-sm" onclick="restartWhatsApp()">
                                <i class="fas fa-redo"></i> Restart WhatsApp
                            </button>
                        </div>
                    `;
                }
            } else if (!status.isInitializing && !status.isReady) {
                // Show loading state and try to restart
                const qrContainer = document.getElementById('qrCodeContainer');
                if (qrContainer) {
                    qrContainer.innerHTML = `
                        <div class="spinner-border text-success mb-3" role="status">
                            <span class="visually-hidden">Generating QR Code...</span>
                        </div>
                        <p>Generating QR Code...</p>
                        <div class="mt-3">
                            <button class="btn btn-warning btn-sm" onclick="restartWhatsApp()">
                                <i class="fas fa-redo"></i> Restart WhatsApp (if taking too long)
                            </button>
                        </div>
                    `;
                }
                console.log('WhatsApp not initializing, forcing restart...');
                restartWhatsApp();
            }
        }
    } catch (error) {
        console.error('Error checking WhatsApp status:', error);
        // Show error state
        const qrContainer = document.getElementById('qrCodeContainer');
        if (qrContainer) {
            qrContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle"></i> Unable to check WhatsApp status
                </div>
                <div class="mt-3">
                    <button class="btn btn-warning btn-sm" onclick="checkWhatsAppStatus()">
                        <i class="fas fa-redo"></i> Try Again
                    </button>
                </div>
            `;
        }
    }
}

function displayQRCode(qrData) {
    console.log('Displaying QR code:', qrData.substring(0, 50) + '...');
    const qrContainer = document.getElementById('qrCodeContainer');

    if (!qrContainer) {
        console.error('QR container not found!');
        return;
    }

    // Show success message and QR code
    qrContainer.innerHTML = `
        <div class="alert alert-success mb-3">
            <i class="fas fa-check-circle"></i> <strong>QR Code Ready!</strong>
            <br><small>Scan with your phone to connect WhatsApp</small>
        </div>
        <div class="qr-code-display mb-3 p-3 bg-white border rounded shadow-sm">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}" 
                 alt="WhatsApp QR Code" class="img-fluid" 
                 onload="console.log('QR image loaded successfully')"
                 onerror="handleQRImageError(this)">
        </div>
        <div class="text-center">
            <div class="spinner-border spinner-border-sm text-success me-2" role="status">
                <span class="visually-hidden">Waiting for scan...</span>
            </div>
            <small class="text-muted">Waiting for you to scan the QR code...</small>
        </div>
    `;

    // Auto-refresh QR code after 2 minutes if not connected
    setTimeout(() => {
        if (!whatsappConnected && qrContainer.innerHTML.includes('Waiting for you to scan')) {
            showWhatsAppStatus('QR code expired. Generating a new one...', 'warning');
            restartWhatsApp();
        }
    }, 120000); // 2 minutes

    console.log('QR code display updated');
}

// Handle QR image loading errors
function handleQRImageError(img) {
    console.error('QR image failed to load, trying alternative method');
    img.parentElement.innerHTML = `
        <div class="alert alert-warning">
            <i class="fas fa-exclamation-triangle"></i> QR image failed to load
        </div>
        <button class="btn btn-warning btn-sm" onclick="restartWhatsApp()">
            <i class="fas fa-redo"></i> Try Again
        </button>
    `;
}

function updateWhatsAppButton(connected, disabled = false) {
    const btn = document.getElementById('whatsappBtn');
    const btnText = document.getElementById('whatsappBtnText');

    if (disabled) {
        btn.className = 'btn btn-secondary me-2';
        btnText.innerHTML = '<i class="fas fa-ban"></i> WhatsApp Disabled (Production)';
        btn.disabled = true;
    } else if (connected) {
        btn.className = 'btn btn-success me-2';
        btnText.innerHTML = '<i class="fas fa-check-circle"></i> WhatsApp Connected';
        btn.disabled = true;
    } else {
        btn.className = 'btn btn-outline-success me-2';
        btnText.innerHTML = 'Connect WhatsApp';
        btn.disabled = false;
    }
}

function hideQRModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('whatsappQRModal'));
    if (modal) {
        modal.hide();
    }
}

// Function to restart WhatsApp service for faster QR generation
async function restartWhatsApp() {
    try {
        showWhatsAppStatus('Restarting WhatsApp service...', 'info');

        const response = await fetch('/api/whatsapp/restart', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            showWhatsAppStatus('WhatsApp service restarted. Generating new QR code...', 'success');

            // Reset QR container to show loading
            const qrContainer = document.getElementById('qrCodeContainer');
            qrContainer.innerHTML = `
                <div class="spinner-border text-success mb-3" role="status">
                    <span class="visually-hidden">Generating QR Code...</span>
                </div>
                <p>Generating new QR Code...</p>
            `;
        } else {
            const error = await response.json();
            showWhatsAppStatus('Failed to restart WhatsApp: ' + error.message, 'danger');
        }
    } catch (error) {
        showWhatsAppStatus('Error restarting WhatsApp: ' + error.message, 'danger');
    }
}

// Function to manually initialize WhatsApp
async function initializeWhatsApp() {
    try {
        showWhatsAppStatus('Initializing WhatsApp service...', 'info');

        const response = await fetch('/api/whatsapp/init', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            showWhatsAppStatus('WhatsApp initialization triggered. Please wait...', 'success');

            // Reset QR container to show loading
            const qrContainer = document.getElementById('qrCodeContainer');
            qrContainer.innerHTML = `
                <div class="spinner-border text-success mb-3" role="status">
                    <span class="visually-hidden">Initializing WhatsApp...</span>
                </div>
                <p>Initializing WhatsApp service...</p>
            `;
        } else {
            const error = await response.json();
            showWhatsAppStatus('Failed to initialize WhatsApp: ' + error.message, 'danger');
        }
    } catch (error) {
        showWhatsAppStatus('Error initializing WhatsApp: ' + error.message, 'danger');
    }
}

// Function to reset WhatsApp service completely (get out of fallback mode)
async function resetWhatsAppService() {
    try {
        showWhatsAppStatus('Resetting WhatsApp service completely...', 'info');

        const response = await fetch('/api/whatsapp/reset', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            showWhatsAppStatus('WhatsApp service reset successfully. Generating QR code...', 'success');

            // Reset QR container to show loading
            const qrContainer = document.getElementById('qrCodeContainer');
            qrContainer.innerHTML = `
                <div class="spinner-border text-success mb-3" role="status">
                    <span class="visually-hidden">Resetting and generating QR...</span>
                </div>
                <p>Service reset complete. Generating new QR code...</p>
            `;
        } else {
            const error = await response.json();
            showWhatsAppStatus('Failed to reset WhatsApp service: ' + error.message, 'danger');
        }
    } catch (error) {
        showWhatsAppStatus('Error resetting WhatsApp service: ' + error.message, 'danger');
    }
}

// Function to run comprehensive WhatsApp diagnostics
async function runWhatsAppDiagnostics() {
    try {
        showWhatsAppStatus('Running WhatsApp diagnostics...', 'info');

        const qrContainer = document.getElementById('qrCodeContainer');
        qrContainer.innerHTML = `
            <div class="spinner-border text-info mb-3" role="status">
                <span class="visually-hidden">Running diagnostics...</span>
            </div>
            <p>Analyzing WhatsApp service...</p>
        `;

        const response = await fetch('/api/whatsapp/diagnostics', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            const diagnostics = await response.json();
            console.log('WhatsApp Diagnostics:', diagnostics);

            showWhatsAppStatus('Diagnostics completed. Check results below.', 'success');

            // Display comprehensive diagnostics
            let issuesHtml = '';
            if (diagnostics.issues && diagnostics.issues.length > 0) {
                issuesHtml = `
                    <div class="alert alert-warning">
                        <h6><i class="fas fa-exclamation-triangle"></i> Issues Found:</h6>
                        <ul class="mb-0">
                            ${diagnostics.issues.map(issue => `<li>${issue}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }

            qrContainer.innerHTML = `
                <div class="alert alert-info">
                    <h6><i class="fas fa-stethoscope"></i> WhatsApp Diagnostics Report</h6>
                    <small class="text-muted">Generated: ${new Date(diagnostics.timestamp).toLocaleString()}</small>
                </div>
                
                ${issuesHtml}
                
                <div class="row">
                    <div class="col-md-6">
                        <div class="card border-info mb-3">
                            <div class="card-header bg-info text-white">
                                <h6 class="mb-0">Service Status</h6>
                            </div>
                            <div class="card-body">
                                <ul class="list-unstyled mb-0">
                                    <li><strong>Ready:</strong> ${diagnostics.whatsappService.isReady ? '✅ Yes' : '❌ No'}</li>
                                    <li><strong>Initializing:</strong> ${diagnostics.whatsappService.isInitializing ? '🔄 Yes' : '✅ No'}</li>
                                    <li><strong>Fallback Mode:</strong> ${diagnostics.whatsappService.fallbackMode ? '⚠️ Yes' : '✅ No'}</li>
                                    <li><strong>Attempts:</strong> ${diagnostics.whatsappService.initializationAttempts}/${diagnostics.whatsappService.maxRetries}</li>
                                    <li><strong>Client Exists:</strong> ${diagnostics.whatsappService.clientExists ? '✅ Yes' : '❌ No'}</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card border-secondary mb-3">
                            <div class="card-header bg-secondary text-white">
                                <h6 class="mb-0">Environment</h6>
                            </div>
                            <div class="card-body">
                                <ul class="list-unstyled mb-0">
                                    <li><strong>Node:</strong> ${diagnostics.environment.nodeVersion}</li>
                                    <li><strong>Platform:</strong> ${diagnostics.environment.platform}</li>
                                    <li><strong>Architecture:</strong> ${diagnostics.environment.arch}</li>
                                    <li><strong>Environment:</strong> ${diagnostics.environment.nodeEnv || 'development'}</li>
                                    <li><strong>WhatsApp Disabled:</strong> ${diagnostics.environment.disableWhatsApp || 'false'}</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="card border-warning mb-3">
                    <div class="card-header bg-warning">
                        <h6 class="mb-0">Dependencies & Files</h6>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-6">
                                <ul class="list-unstyled mb-0">
                                    <li><strong>node_modules:</strong> ${diagnostics.directories.nodeModulesExists ? '✅ Found' : '❌ Missing'}</li>
                                    <li><strong>Puppeteer:</strong> ${diagnostics.directories.puppeteerExists ? '✅ Found' : '❌ Missing'}</li>
                                </ul>
                            </div>
                            <div class="col-md-6">
                                <ul class="list-unstyled mb-0">
                                    <li><strong>Auth Folder:</strong> ${diagnostics.directories.authExists ? '✅ Found' : '❌ Missing'}</li>
                                    <li><strong>Cache Folder:</strong> ${diagnostics.directories.cacheExists ? '✅ Found' : '❌ Missing'}</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="text-center mt-3">
                    <div class="btn-group" role="group">
                        <button class="btn btn-success btn-sm" onclick="initializeWhatsApp()">
                            <i class="fas fa-play"></i> Try Initialize
                        </button>
                        <button class="btn btn-warning btn-sm" onclick="restartWhatsApp()">
                            <i class="fas fa-redo"></i> Restart
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="resetWhatsAppService()">
                            <i class="fas fa-power-off"></i> Reset
                        </button>
                    </div>
                    <div class="mt-2">
                        <button class="btn btn-outline-success btn-sm me-2" onclick="toggleWhatsAppService(true)" 
                                ${diagnostics.environment.disableWhatsApp === 'false' ? 'disabled' : ''}>
                            <i class="fas fa-toggle-on"></i> Enable WhatsApp
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="toggleWhatsAppService(false)"
                                ${diagnostics.environment.disableWhatsApp === 'true' ? 'disabled' : ''}>
                            <i class="fas fa-toggle-off"></i> Disable WhatsApp
                        </button>
                    </div>
                </div>
                
                <div class="mt-3">
                    <details>
                        <summary class="btn btn-outline-secondary btn-sm">
                            <i class="fas fa-code"></i> View Raw Diagnostics
                        </summary>
                        <pre class="mt-2 p-2 bg-light border rounded" style="font-size: 0.8em; max-height: 200px; overflow-y: auto;">
${JSON.stringify(diagnostics, null, 2)}
                        </pre>
                    </details>
                </div>
            `;

        } else {
            const error = await response.json();
            showWhatsAppStatus('Failed to run diagnostics: ' + error.message, 'danger');
            qrContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle"></i> Diagnostics Failed
                    <hr>
                    <p>${error.message}</p>
                </div>
                <button class="btn btn-warning" onclick="runWhatsAppDiagnostics()">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            `;
        }
    } catch (error) {
        showWhatsAppStatus('Error running diagnostics: ' + error.message, 'danger');
        console.error('Diagnostics error:', error);
    }
}

// Function to toggle WhatsApp service on/off
async function toggleWhatsAppService(enable) {
    try {
        const action = enable ? 'Enabling' : 'Disabling';
        showWhatsAppStatus(`${action} WhatsApp service...`, 'info');

        const response = await fetch('/api/whatsapp/toggle', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ enable })
        });

        if (response.ok) {
            const result = await response.json();
            showWhatsAppStatus(result.message, 'success');

            // Refresh the diagnostics to show updated status
            setTimeout(() => {
                runWhatsAppDiagnostics();
            }, 2000);

            // Update WhatsApp button state
            if (enable) {
                updateWhatsAppButton(false); // Not connected yet, but enabled
            } else {
                updateWhatsAppButton(false, true); // Disabled
            }
        } else {
            const error = await response.json();
            showWhatsAppStatus(`Failed to ${enable ? 'enable' : 'disable'} WhatsApp: ${error.message}`, 'danger');
        }
    } catch (error) {
        showWhatsAppStatus(`Error ${enable ? 'enabling' : 'disabling'} WhatsApp: ${error.message}`, 'danger');
    }
}

// Reports Functions
let currentReportsData = null;

function showReportsModal() {
    const modal = new bootstrap.Modal(document.getElementById('reportsModal'));
    modal.show();

    // Set up period change handler
    document.getElementById('reportPeriod').addEventListener('change', function () {
        const customDateFields = ['customDateStart', 'customDateEnd'];
        if (this.value === 'custom') {
            customDateFields.forEach(id => document.getElementById(id).style.display = 'block');
        } else {
            customDateFields.forEach(id => document.getElementById(id).style.display = 'none');
        }
    });

    // Load initial reports
    loadReports();
}

async function loadReports() {
    const loadingDiv = document.getElementById('reportsLoading');
    const contentDiv = document.getElementById('reportsContent');

    // Show loading
    loadingDiv.style.display = 'block';
    contentDiv.style.display = 'none';

    try {
        const period = document.getElementById('reportPeriod').value;
        let url = `/api/work/reports?period=${period}`;

        // Add custom date range if selected
        if (period === 'custom') {
            const startDate = document.getElementById('reportStartDate').value;
            const endDate = document.getElementById('reportEndDate').value;

            if (startDate && endDate) {
                url += `&startDate=${startDate}&endDate=${endDate}`;
            } else {
                alert('Please select both start and end dates for custom range');
                loadingDiv.style.display = 'none';
                contentDiv.style.display = 'block';
                return;
            }
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            currentReportsData = await response.json();
            displayReports(currentReportsData);
        } else {
            const error = await response.json();
            alert('Failed to load reports: ' + error.message);
        }
    } catch (error) {
        alert('Failed to load reports: ' + error.message);
    } finally {
        loadingDiv.style.display = 'none';
        contentDiv.style.display = 'block';
    }
}

function displayReports(data) {
    displayReportsSummary(data.summary);
    displayMemberReports(data.memberReports);
}

function displayReportsSummary(summary) {
    const summaryDiv = document.getElementById('reportsSummary');

    summaryDiv.innerHTML = `
        <div class="col-md-3">
            <div class="card bg-primary text-white">
                <div class="card-body">
                    <div class="d-flex justify-content-between">
                        <div>
                            <h4 class="mb-0">${summary.totalMembers}</h4>
                            <p class="mb-0">Total Members</p>
                        </div>
                        <div class="align-self-center">
                            <i class="fas fa-users fa-2x"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card bg-info text-white">
                <div class="card-body">
                    <div class="d-flex justify-content-between">
                        <div>
                            <h4 class="mb-0">${summary.totalTasks}</h4>
                            <p class="mb-0">Total Tasks</p>
                        </div>
                        <div class="align-self-center">
                            <i class="fas fa-tasks fa-2x"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card bg-success text-white">
                <div class="card-body">
                    <div class="d-flex justify-content-between">
                        <div>
                            <h4 class="mb-0">${summary.completedTasks}</h4>
                            <p class="mb-0">Completed</p>
                        </div>
                        <div class="align-self-center">
                            <i class="fas fa-check-circle fa-2x"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card bg-warning text-white">
                <div class="card-body">
                    <div class="d-flex justify-content-between">
                        <div>
                            <h4 class="mb-0">${summary.overallCompletionRate}%</h4>
                            <p class="mb-0">Completion Rate</p>
                        </div>
                        <div class="align-self-center">
                            <i class="fas fa-chart-pie fa-2x"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function displayMemberReports(memberReports) {
    const tbody = document.getElementById('memberReportsBody');

    if (!memberReports || memberReports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No data available for the selected period</td></tr>';
        return;
    }

    tbody.innerHTML = memberReports.map(report => `
        <tr>
            <td>
                <div class="d-flex align-items-center">
                    <div class="avatar-circle bg-primary text-white me-2" style="width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px;">
                        ${report.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="fw-bold">${report.user.name}</div>
                        <small class="text-muted">${report.user.role}</small>
                    </div>
                </div>
            </td>
            <td>${report.user.department}</td>
            <td><span class="badge bg-primary">${report.totalTasks}</span></td>
            <td><span class="badge bg-success">${report.statusCounts.completed}</span></td>
            <td><span class="badge bg-warning">${report.statusCounts.pending}</span></td>
            <td><span class="badge bg-info">${report.statusCounts['in-progress']}</span></td>
            <td>
                <div class="d-flex align-items-center">
                    <div class="progress me-2" style="width: 60px; height: 8px;">
                        <div class="progress-bar bg-success" style="width: ${report.completionRate}%"></div>
                    </div>
                    <span class="small">${report.completionRate}%</span>
                </div>
            </td>
            <td>${report.avgCompletionTime > 0 ? report.avgCompletionTime + ' days' : 'N/A'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="showMemberDetail('${report.user.id}', '${report.user.name}')">
                    <i class="fas fa-eye"></i> View
                </button>
            </td>
        </tr>
    `).join('');
}

function showMemberDetail(userId, userName) {
    const memberReport = currentReportsData.memberReports.find(r => r.user.id === userId);
    if (!memberReport) return;

    const modal = new bootstrap.Modal(document.getElementById('memberDetailModal'));
    document.getElementById('memberDetailTitle').textContent = `${userName} - Task Details`;

    const content = document.getElementById('memberDetailContent');
    content.innerHTML = `
        <div class="row mb-4">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">
                        <h6 class="mb-0">Task Status Breakdown</h6>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-6">
                                <div class="text-center">
                                    <div class="h4 text-success">${memberReport.statusCounts.completed}</div>
                                    <div class="small text-muted">Completed</div>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="text-center">
                                    <div class="h4 text-warning">${memberReport.statusCounts.pending}</div>
                                    <div class="small text-muted">Pending</div>
                                </div>
                            </div>
                        </div>
                        <div class="row mt-2">
                            <div class="col-6">
                                <div class="text-center">
                                    <div class="h4 text-info">${memberReport.statusCounts['in-progress']}</div>
                                    <div class="small text-muted">In Progress</div>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="text-center">
                                    <div class="h4 text-danger">${memberReport.statusCounts.cancelled}</div>
                                    <div class="small text-muted">Cancelled</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">
                        <h6 class="mb-0">Priority Distribution</h6>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-6">
                                <div class="text-center">
                                    <div class="h4 text-danger">${memberReport.priorityCounts.urgent}</div>
                                    <div class="small text-muted">Urgent</div>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="text-center">
                                    <div class="h4 text-warning">${memberReport.priorityCounts.high}</div>
                                    <div class="small text-muted">High</div>
                                </div>
                            </div>
                        </div>
                        <div class="row mt-2">
                            <div class="col-6">
                                <div class="text-center">
                                    <div class="h4 text-info">${memberReport.priorityCounts.medium}</div>
                                    <div class="small text-muted">Medium</div>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="text-center">
                                    <div class="h4 text-success">${memberReport.priorityCounts.low}</div>
                                    <div class="small text-muted">Low</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h6 class="mb-0">Recent Tasks</h6>
            </div>
            <div class="card-body">
                ${memberReport.recentTasks.length > 0 ? `
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Task</th>
                                    <th>Status</th>
                                    <th>Priority</th>
                                    <th>Created</th>
                                    <th>Due Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${memberReport.recentTasks.map(task => `
                                    <tr>
                                        <td>${task.title}</td>
                                        <td><span class="badge bg-${getStatusColor(task.status)}">${task.status.toUpperCase()}</span></td>
                                        <td><span class="badge bg-${getPriorityColor(task.priority)}">${task.priority.toUpperCase()}</span></td>
                                        <td>${new Date(task.createdAt).toLocaleDateString()}</td>
                                        <td>${new Date(task.dueDate).toLocaleDateString()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<p class="text-muted">No recent tasks found</p>'}
            </div>
        </div>
    `;

    modal.show();
}

function exportReports() {
    if (!currentReportsData) {
        alert('No data to export');
        return;
    }

    // Create CSV content
    const headers = ['Member Name', 'Department', 'Role', 'Total Tasks', 'Completed', 'Pending', 'In Progress', 'Cancelled', 'Completion Rate (%)', 'Avg Completion Days'];
    const csvContent = [
        headers.join(','),
        ...currentReportsData.memberReports.map(report => [
            `"${report.user.name}"`,
            `"${report.user.department}"`,
            `"${report.user.role}"`,
            report.totalTasks,
            report.statusCounts.completed,
            report.statusCounts.pending,
            report.statusCounts['in-progress'],
            report.statusCounts.cancelled,
            report.completionRate,
            report.avgCompletionTime
        ].join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `member-reports-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Quick fix function for WhatsApp issues
async function fixWhatsApp() {
    try {
        showWhatsAppStatus('Fixing WhatsApp service...', 'info');

        const qrContainer = document.getElementById('qrCodeContainer');
        if (qrContainer) {
            qrContainer.innerHTML = `
                <div class="spinner-border text-success mb-3" role="status">
                    <span class="visually-hidden">Fixing WhatsApp...</span>
                </div>
                <p>🔧 Clearing session data and restarting service...</p>
            `;
        }

        const response = await fetch('/api/whatsapp/fix', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            showWhatsAppStatus('WhatsApp service fixed! Generating new QR code...', 'success');

            // Wait a moment for the service to restart
            setTimeout(() => {
                checkWhatsAppStatus();
            }, 3000);
        } else {
            const error = await response.json();
            showWhatsAppStatus('Fix failed: ' + error.message, 'danger');
        }
    } catch (error) {
        showWhatsAppStatus('Fix failed: ' + error.message, 'danger');
    }
}

// Restart WhatsApp function
async function restartWhatsApp() {
    try {
        showWhatsAppStatus('Restarting WhatsApp service...', 'info');

        const response = await fetch('/api/whatsapp/restart', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            showWhatsAppStatus('WhatsApp service restarted! Generating QR code...', 'success');
        } else {
            const error = await response.json();
            showWhatsAppStatus('Restart failed: ' + error.message, 'danger');
        }
    } catch (error) {
        showWhatsAppStatus('Restart failed: ' + error.message, 'danger');
    }
}

// Reset WhatsApp service completely
async function resetWhatsAppService() {
    try {
        showWhatsAppStatus('Resetting WhatsApp service completely...', 'warning');

        const response = await fetch('/api/whatsapp/reset', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            showWhatsAppStatus('WhatsApp service reset! Starting fresh...', 'success');
            setTimeout(() => {
                checkWhatsAppStatus();
            }, 2000);
        } else {
            const error = await response.json();
            showWhatsAppStatus('Reset failed: ' + error.message, 'danger');
        }
    } catch (error) {
        showWhatsAppStatus('Reset failed: ' + error.message, 'danger');
    }
}

// Update WhatsApp button state
function updateWhatsAppButton(connected, disabled = false) {
    const btn = document.getElementById('whatsappBtn');
    if (!btn) return;

    if (disabled) {
        btn.innerHTML = '<i class="fab fa-whatsapp"></i> WhatsApp (Disabled)';
        btn.className = 'btn btn-secondary me-2';
        btn.disabled = true;
    } else if (connected) {
        btn.innerHTML = '<i class="fab fa-whatsapp"></i> WhatsApp (Connected)';
        btn.className = 'btn btn-success me-2';
        btn.disabled = false;
    } else {
        btn.innerHTML = '<i class="fab fa-whatsapp"></i> Connect WhatsApp';
        btn.className = 'btn btn-warning me-2';
        btn.disabled = false;
    }
}

// Display QR Code
function displayQRCode(qrData) {
    console.log('Displaying QR code:', qrData.substring(0, 50) + '...');

    const qrContainer = document.getElementById('qrCodeContainer');
    if (!qrContainer) return;

    // Create QR code using a simple library or show as text
    qrContainer.innerHTML = `
        <div class="text-center">
            <div class="alert alert-success mb-3">
                <i class="fas fa-qrcode"></i> <strong>QR Code Generated Successfully!</strong>
            </div>
            <div id="qrcode" class="mb-3"></div>
            <p class="text-muted">Scan this QR code with your WhatsApp mobile app</p>
            <div class="mt-3">
                <button class="btn btn-outline-secondary btn-sm" onclick="fixWhatsApp()">
                    <i class="fas fa-wrench"></i> Refresh QR
                </button>
            </div>
        </div>
    `;

    // Generate QR code using qrcode.js library (if available) or show as canvas
    try {
        if (typeof QRCode !== 'undefined') {
            new QRCode(document.getElementById('qrcode'), {
                text: qrData,
                width: 256,
                height: 256,
                colorDark: '#000000',
                colorLight: '#ffffff'
            });
        } else {
            // Fallback: show QR data as text and suggest manual entry
            document.getElementById('qrcode').innerHTML = `
                <div class="alert alert-info">
                    <p><strong>QR Code Data:</strong></p>
                    <textarea class="form-control" rows="3" readonly>${qrData}</textarea>
                    <small class="text-muted mt-2 d-block">Copy this text and use "Link a Device" in WhatsApp Web</small>
                </div>
            `;
        }
    } catch (error) {
        console.error('QR Code generation error:', error);
        document.getElementById('qrcode').innerHTML = `
            <div class="alert alert-warning">
                <p>QR Code generated but display failed. Use the text below:</p>
                <textarea class="form-control" rows="3" readonly>${qrData}</textarea>
            </div>
        `;
    }
}

// Hide QR Modal
function hideQRModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('whatsappQRModal'));
    if (modal) {
        modal.hide();
    }
}