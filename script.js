// Shared auth helpers used by index3.html
function checkAuth(page) {
  const token = localStorage.getItem('authToken');
  if (page !== 'login.html' && !token) {
    alert('Please login first');
    location.href = 'login.html';
  } else {
    location.href = page;
  }
}

function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userData');
  localStorage.removeItem('loginProvider');
  location.href = 'index3.html';
}
