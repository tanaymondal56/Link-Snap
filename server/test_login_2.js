async function run() {
  const res = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@linksnap.com', password: 'password123' })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

run();
