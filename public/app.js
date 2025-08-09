// Global variables
let currentUser = null;
let socket = null;
let whatsappConnected = false;

// Handle browser extension errors
window.addEventListener('unhandledrejection', function(event) {
    if (event.reason && event.reason.message && 
        (event.reason.message.includes('message channel closed') ||
         event.reason.message.includes('listener indicated an asynchronous response'))) {
        event.preventDefault();
        console.log('Suppressed browser extension error:', event.reason.message);
        return;
    }
});

// Handle general errors
window.addEventListener('error', function(event) {
    if (event.message && 
        (event.message.includes('message channel closed') ||
         event.message.includes('listener indicated an asynchronous response'))) {
        event.preventDefault();
        console.log('Suppressed browser extension error:', event.message);
        return;
    }
});

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    // Initialize socket connection
    socket = io();
    
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
    if (token) {
        validateToken(token);
    } else {
        showLoginModal();
    }

    // Form event listeners
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('assignWorkForm').addEventListener('submit', handleAssignWork);
});

// Authentication functions
function showLoginModal() {
    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    loginModal.show();
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
    
    // Always use online QR generator for reliability
    qrContainer.innerHTML = `
        <div class="qr-code-display mb-3">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrData)}" 
                 alt="WhatsApp QR Code" class="img-fluid border rounded" 
                 onload="console.log('QR image loaded successfully')"
                 onerror="console.error('QR image failed to load')">
        </div>
        <p class="text-success"><i class="fas fa-qrcode"></i> Scan this QR code with WhatsApp</p>
        <div class="mt-3">
            <button class="btn btn-primary btn-sm me-2" onclick="initializeWhatsApp()">
                <i class="fas fa-play"></i> Initialize WhatsApp
            </button>
            <button class="btn btn-warning btn-sm" onclick="restartWhatsApp()">
                <i class="fas fa-redo"></i> Restart WhatsApp
            </button>
        </div>
    `;
    
    console.log('QR code display updated');
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

// Reports Functions
let currentReportsData = null;

function showReportsModal() {
    const modal = new bootstrap.Modal(document.getElementById('reportsModal'));
    modal.show();
    
    // Set up period change handler
    document.getElementById('reportPeriod').addEventListener('change', function() {
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