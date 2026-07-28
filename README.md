# Telegram Drive Web

Telegram Drive Web is a self-hosted web-based port of [Telegram-Drive](https://github.com/caamer20/Telegram-Drive). It transforms your Telegram account into an unlimited, secure cloud storage drive, built with a **Node.js (Express + gram.js)** backend and a premium **React (Vite + TypeScript)** frontend.

This project is fully **multi-user**, allowing multiple separate accounts to run isolated from each other.

## Features

- **Unlimited Cloud Storage**: Harness the power of Telegram's infrastructure to store files of any size.
- **Multi-User Account System**: 
  - Register and login to your own TeleDrive web account using a username, password, and optional email (for recovery).
  - Fully isolated databases, caches, file/folder listings, groups, and share links per user.
- **Dynamic Telegram Auth**: Log in natively with your own Telegram account using either a **QR Code Scan** or **Phone Number & OTP** inside your TeleDrive dashboard.
- **Smart Phone Number Formatting**: Input local Indonesian phone numbers (e.g. `081...`) and the backend will automatically format them to international format (`+6281...`) to prevent invalid credentials errors.
- **Resend OTP Option**: Easy Kirim Ulang OTP with a 60-second countdown timer. Re-initializes a fresh Telegram connection to prevent expired sessions.
- **Folder Upload Zipping**: Select and upload folders directly; they will be zipped automatically on the client-side before storing to conserve structure and transfer time.
- **Interactive API Configuration**: Input your custom `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` directly on the login screen. No need to hardcode credentials or rebuild containers.
- **Flexible Theme Control**: Toggle between premium dark-mode (default glassmorphism) and light-mode themes dynamically.
- **Dynamic File Sharing**: Generate secure public sharing links with:
  - Optional password protection.
  - Custom link expiration boundaries (e.g. 1 hour, 1 day, 7 days, custom hours, or never).
  - Streamed public downloads directly via the server (bypasses admin portal credentials).
- **Folder / Channel Context Menu**:
  - Rename and Delete folders (channels).
  - Toggle folder publicity between public (with custom username `@my_folder`) and private.
  - Export and copy invite links.
- **Fast Navigation Caching**: Powered by SQLite (`sql.js`) to cache file/folder metadata, reducing Telegram API rate limits.
- **Docker Ready**: Multi-stage `Dockerfile` and `docker-compose.yml` for quick and containerized deployment.

---

## Universal Deployment & Installation

### Option 1: Docker Compose (Recommended)

Docker Compose is the easiest way to deploy the application on any platform (Linux, macOS, Windows, or NAS OS like CasaOS).

1. Create a project directory:
   ```bash
   mkdir telegram-drive-web
   cd telegram-drive-web
   ```
2. Create a `docker-compose.yml` file:
   ```yaml
   services:
     telegram-drive:
       image: irnhakim/telegram-drive-web:latest
       container_name: telegram-drive-web
       restart: unless-stopped
       ports:
         - "3001:3001"
       volumes:
         - telegram-drive-data:/app/data

   volumes:
     telegram-drive-data:
       driver: local
   ```
3. Start the container:
   ```bash
   docker compose up -d
   ```
4. Access the Web UI by navigating to `http://<your-server-ip>:3001`. Register your TeleDrive account first, then connect your Telegram!

---

### Option 2: Native Node.js Installation

1. Clone the repository and install dependencies for both the frontend and backend:
   ```bash
   # Clone repository
   git clone https://github.com/caamer20/Telegram-Drive.git # (or your fork repository URL)
   cd Telegram-Drive-WebServer

   # Set up backend
   cd server
   npm install
   npm run build

   # Set up frontend
   cd ../client
   npm install
   npm run build
   ```
2. Create a `.env` file in the root of the server directory:
   ```env
   PORT=3001
   ```
3. Start the production server:
   ```bash
   cd ../server
   npm start
   ```
4. Open your browser and navigate to `http://localhost:3001`.

---

## Local Development Setup

To run client and server concurrently with hot reloading:

1. Configure the `.env` file in the root workspace directory.
2. Run the backend server in development mode:
   ```bash
   cd server
   npm run dev
   ```
3. In a separate terminal, start the Vite development server:
   ```bash
   cd client
   npm run dev
   ```
4. Access the development environment at `http://localhost:5173`.

## License

This project is licensed under the MIT License - see the [LICENSE](file:///d:/Programing/web/Telegram-Drive-WebServer/LICENSE) file for details.
