# 🚀 La Vie En Rose 34 - First Time Setup Guide

## ✅ Problem Solved!

The error "Connexion impossible. Vérifiez votre connexion internet" occurred because the **backend server was not running**. I've started it for you, and now everything should work!

## 🔑 Default Login Credentials

For first-time use, the application automatically creates a default admin user:

- **Username**: `admin`
- **Password**: `admin`

## 📋 How to Use the Application

### Step 1: Start the Backend Server
The backend server must always be running before you launch the application:

```bash
# Method 1: From project root
cd backend
npm start

# Method 2: From project root (development)
npm run dev:backend
```

The server runs on: `http://localhost:8787`

### Step 2: Launch the Application
```bash
# From project root
npm run electron
```

### Step 3: Login
- Open the application
- Enter username: `admin`
- Enter password: `admin`
- Click "Connexion" (Login)

## 👥 Creating New Users

After logging in as admin, you can create new users:

### Method 1: Through the Application
1. Login as `admin`
2. Go to **Settings** ⚙️
3. Navigate to **Users** section
4. Click **Add User** or **Create User**
5. Fill in user details:
   - Username
   - Password
   - Role (Admin/Manager/Employee)
   - User information
6. Save the new user

### Method 2: Direct Database (Advanced)
For advanced users, you can add users directly to the database:

```sql
INSERT INTO users (id, username, password_hash, role, active, created_at) 
VALUES ('u_newuser', 'newuser', '$2a$10$hashed_password_here', 'employee', 1, 1700000000000);
```

## 🔄 Daily Startup Routine

### For Development:
```bash
# Terminal 1 - Start Backend
npm run dev:backend

# Terminal 2 - Start Frontend  
npm run dev:frontend

# Terminal 3 - Start Electron
npm run electron
```

### For Production (Using Built App):
1. Double-click `La Vie En Rose 34-Setup.exe` to install
2. Launch from Start Menu/Desktop
3. Backend starts automatically with the app

## 🛠️ Troubleshooting

### If you see "Connexion impossible":
1. **Check if backend is running**:
   - Open browser: `http://localhost:8787/api/health`
   - Should show: `{"ok":true,...}`

2. **Start the backend**:
   ```bash
   cd backend
   npm start
   ```

3. **Check port conflicts**:
   - Make sure port 8787 is not used by another application
   - Close other instances if needed

### If login fails:
1. **Verify credentials**: Use `admin` / `admin`
2. **Check database**: Database should be created automatically
3. **Reset admin password** (if needed):
   - Delete the database file: `C:\Users\[YourUser]\AppData\Roaming\la-vie-en-rose-34-pos\data\store.sqlite`
   - Restart application (new admin will be created)

## 📁 Important File Locations

### Database:
`C:\Users\[YourUser]\AppData\Roaming\la-vie-en-rose-34-pos\data\store.sqlite`

### Logs:
`C:\Users\[YourUser]\AppData\Roaming\la-vie-en-rose-34-pos\logs\`

### Application Data:
`C:\Users\[YourUser]\AppData\Roaming\la-vie-en-rose-34-pos\`

## 🔐 Security Recommendations

### For Production Use:
1. **Change default password** immediately after first login
2. **Create separate user accounts** for each employee
3. **Use strong passwords** for all accounts
4. **Regularly backup** the database
5. **Limit user permissions** based on their roles

### User Roles:
- **Admin**: Full access to all features
- **Manager**: Can manage products, customers, orders
- **Employee**: Limited to POS and basic operations

## 📞 Getting Help

If you encounter issues:

1. **Check the logs** in the application data folder
2. **Verify backend is running** on port 8787
3. **Ensure database permissions** are correct
4. **Restart the application** after making changes

## 🎯 Next Steps

After successful login:

1. **Configure Store Settings**: Add your store information
2. **Add Products**: Import or add your product catalog
3. **Set Up Categories**: Organize your products
4. **Create User Accounts**: Add your employees
5. **Configure Backup**: Set up automatic backups
6. **Test Features**: Try all POS functions

---

**✅ Status**: Backend server is running and ready for use!
**🔑 Login**: Use `admin` / `admin` for first-time access
**🚀 Ready**: Your La Vie En Rose 34 system is now fully operational!
