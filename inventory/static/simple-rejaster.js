// register.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registerForm');
    const btn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            name: document.getElementById('firstName').value.trim() + ' ' +
                  document.getElementById('lastName').value.trim(),
            gender: '',                     // you can add a select later
            email: document.getElementById('email').value.trim(),
            age: parseInt(document.getElementById('phone').value) || 0, // reuse phone field as age for demo
            password: document.getElementById('password').value
        };

        // Very light client validation
        if (!payload.email || !payload.password || payload.password.length < 6) {
            alert('Check all fields (password ≥6 chars)');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Creating…';

        try {
            const res = await fetch('http://127.0.0.1:5000/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                alert('Account created! You can now log in.');
                window.location.href = './log-in.html';
            } else {
                alert(data.message || 'Registration failed');
            }
        } catch (err) {
            console.error(err);
            alert('Network error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Sign up';
        }
    });
});