// login.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const btn = document.getElementById('loginBtn');
    const spinner = btn.querySelector('.loading');
    const loginText = btn.querySelector('.login-text');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const remember = document.getElementById('rememberMe').checked;

        // Simple client-side validation
        if (!email || !password) {
            alert('Please fill in both fields');
            return;
        }

        // Show loading
        btn.disabled = true;
        spinner.classList.add('show');
        loginText.textContent = 'Logging in…';

        try {
            const res = await fetch('http://127.0.0.1:5000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (res.ok) {
                // Store minimal info (you can expand with JWT later)
                localStorage.setItem('user', JSON.stringify({
                    id: data.id,
                    name: data.name,
                    email: data.email
                }));
                if (remember) {
                    localStorage.setItem('remember', 'true');
                } else {
                    localStorage.removeItem('remember');
                }

                // alert('Login successful! Redirecting…');
                window.location.href ="http://127.0.0.1:5501/inventory/templates/employee.html";  
            } else {
                alert(data.message || 'Login failed');
            }
        } catch (err) {
            console.error(err);
            alert('Network error – check console');
        } finally {
            btn.disabled = false;
            spinner.classList.remove('show');
            loginText.textContent = 'Login';
        }
    });
});