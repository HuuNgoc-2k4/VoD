// ===================================
// VoD Streaming - Auth Helper
// Shared auth utilities for all pages
// ===================================

const AUTH_TOKEN_KEY = 'vod_token';
const AUTH_USER_KEY = 'vod_user';

function getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

function getCurrentUser() {
    const data = localStorage.getItem(AUTH_USER_KEY);
    return data ? JSON.parse(data) : null;
}

function isLoggedIn() {
    return !!getToken();
}

function isAdmin() {
    const user = getCurrentUser();
    return user && user.role === 'admin';
}

function saveAuth(token, user) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function logout() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    window.location.href = '/';
}

function authHeaders() {
    const token = getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function authFetch(url, options = {}) {
    const headers = { ...authHeaders(), ...(options.headers || {}) };
    return fetch(url, { ...options, headers });
}

// Render auth section in navbar
function renderAuthNav() {
    const navList = document.querySelector('.navbar-nav');
    if (!navList) return;

    // Remove old auth items
    navList.querySelectorAll('.auth-nav-item').forEach(el => el.remove());

    const user = getCurrentUser();

    if (user) {
        // Admin link
        if (user.role === 'admin') {
            const adminLi = document.createElement('li');
            adminLi.className = 'auth-nav-item';
            adminLi.innerHTML = `<a href="/admin.html" id="navAdmin"><span class="nav-text">Admin</span></a>`;
            navList.appendChild(adminLi);
        }

        // User info + logout
        const userLi = document.createElement('li');
        userLi.className = 'auth-nav-item';
        userLi.innerHTML = `
            <a href="#" onclick="logout(); return false;" style="display: flex; align-items: center; gap: 6px;">
                <span class="user-badge">${user.display_name.charAt(0).toUpperCase()}</span>
                <span class="nav-text">${user.display_name}</span>
            </a>
        `;
        navList.appendChild(userLi);
    } else {
        const loginLi = document.createElement('li');
        loginLi.className = 'auth-nav-item';
        loginLi.innerHTML = `<a href="/login.html"><span class="nav-text">Đăng nhập</span></a>`;
        navList.appendChild(loginLi);
    }
}

// Auto-render auth nav on page load
document.addEventListener('DOMContentLoaded', renderAuthNav);
