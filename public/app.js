// Global variables
let currentUser = null;
let socket = null;
let whatsappConnected = false;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    // Initialize socket connection
    socket = io();
    
    // Socket event listeners
    socket.on('whatsapp-qr', (qr) => {
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
    
    // Reset QR container
    const qrContainer = document.getElementById('qrCodeContainer');
    qrContainer.innerHTML = `
        <div class="spinner-border text-success mb-3" role="status">
            <span class="visually-hidden">Generating QR Code...</span>
        </div>
        <p>Generating QR Code...</p>
    `;
}

function displayQRCode(qrData) {
    const qrContainer = document.getElementById('qrCodeContainer');
    
    // Create QR code container
    qrContainer.innerHTML = `
        <div class="qr-code-display mb-3">
            <canvas id="qrcode"></canvas>
        </div>
        <p class="text-success"><i class="fas fa-qrcode"></i> Scan this QR code with WhatsApp</p>
    `;
    
    // Generate QR code using qrcode.js library
    if (typeof QRCode !== 'undefined') {
        const canvas = document.getElementById('qrcode');
        QRCode.toCanvas(canvas, qrData, {
            width: 256,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        }, function (error) {
            if (error) {
                console.error('QR Code generation error:', error);
                // Fallback to online QR generator
                qrContainer.innerHTML = `
                    <div class="qr-code-display mb-3">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrData)}" 
                             alt="WhatsApp QR Code" class="img-fluid border rounded">
                    </div>
                    <p class="text-success"><i class="fas fa-qrcode"></i> Scan this QR code with WhatsApp</p>
                `;
            }
        });
    } else {
        // Fallback: display QR using online QR generator
        qrContainer.innerHTML = `
            <div class="qr-code-display mb-3">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrData)}" 
                     alt="WhatsApp QR Code" class="img-fluid border rounded">
            </div>
            <p class="text-success"><i class="fas fa-qrcode"></i> Scan this QR code with WhatsApp</p>
        `;
    }
}

function updateWhatsAppButton(connected) {
    const btn = document.getElementById('whatsappBtn');
    const btnText = document.getElementById('whatsappBtnText');
    
    if (connected) {
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