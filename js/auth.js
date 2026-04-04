function togglePw(id) {
  const input = document.getElementById(id);
  const btn = input.nextElementSibling;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = 'Hide';
  } else {
    input.type = 'password';
    btn.textContent = 'Show';
  }
}

// Password strength indicator
function initPasswordStrength(inputId, barId) {
  const input = document.getElementById(inputId);
  const bar = document.getElementById(barId);
  if (!input || !bar) return;
  input.addEventListener('input', () => {
    const val = input.value;
    let strength = 0;
    if (val.length >= 8) strength++;
    if (/[A-Z]/.test(val)) strength++;
    if (/[0-9]/.test(val)) strength++;
    if (/[^a-zA-Z0-9]/.test(val)) strength++;
    const colors = ['#FF6B6B', '#FFB347', '#E8FF47', '#4ECDC4'];
    const widths = ['25%', '50%', '75%', '100%'];
    if (val.length === 0) { bar.style.width = '0%'; return; }
    bar.style.width = widths[strength - 1] || '25%';
    bar.style.background = colors[strength - 1] || colors[0];
  });
}

async function handleGoogleAuth() {
  try {
    await nexusAuth.signInWithGoogle();
  } catch (err) {
    console.error('Google auth failed:', err);
    const errorMsg = document.getElementById('error-msg');
    if (errorMsg) {
      errorMsg.textContent = 'Google sign-in failed. Please try again.';
      errorMsg.style.display = 'block';
    }
  }
}
