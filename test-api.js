const fetch = require('node-fetch');

async function testAPI() {
  try {
    console.log('Testing Admin Login...');
    
    // Test login
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@ezzymadrasa.com',
        password: 'admin123'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login Response:', loginData);
    
    if (loginData.token) {
      console.log('\n✅ Admin login successful!');
      
      // Test users endpoint
      console.log('\nTesting Users API...');
      const usersResponse = await fetch('http://localhost:3000/api/work/users', {
        headers: {
          'Authorization': `Bearer ${loginData.token}`
        }
      });
      
      const users = await usersResponse.json();
      console.log('Users for dropdown:', users);
      
      if (users.length > 0) {
        console.log('\n✅ Users API working! Found users:');
        users.forEach(user => {
          console.log(`- ${user.name} (${user.role} - ${user.department})`);
        });
      } else {
        console.log('❌ No users found in dropdown');
      }
    } else {
      console.log('❌ Login failed');
    }
    
  } catch (error) {
    console.error('Error testing API:', error.message);
  }
}

testAPI();