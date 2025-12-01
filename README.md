# Builders-Liability-AMMC-BACKEND

Backend API for the FCT-DCIP Leaders Network platform. This project manages authentication, employee and user management, property records, policy generation, and OTP-based security features.

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Features
- User and Employee authentication (JWT)
- OTP generation and verification for email/password security
- Email notifications (Gmail SMTP)
- Property and Policy management
- Custom error handling middleware
- API key-based route protection

## Tech Stack
- Node.js
- Express.js
- MongoDB (Mongoose)
- Nodemailer (Email)
- Vercel (Deployment)

## Setup & Installation
1. **Clone the repository:**
	 ```sh
	 git clone https://github.com/Leaders-Network/FCT-DCIP-BACKEND.git
	 cd FCT-DCIP-BACKEND
	 ```
2. **Install dependencies:**
	 ```sh
	 npm install
	 ```
3. **Configure environment variables:**
	 - Copy `.env.example` to `.env` and fill in your credentials:
		 ```
		 MONGO_URI=your_mongodb_uri
		 APIKEY=your_api_key
		 EMAIL=your_gmail_address
		 EMAIL_PASSWORD=your_gmail_app_password
		 EMAIL_FROM=Your Name <your_gmail_address>
		 NEXT_PUBLIC_BASE_URL=http://localhost:3000
		 ```
4. **Run the server:**
	 ```sh
	 node app.js
	 # or
	 npm start
	 ```

## Environment Variables
| Variable              | Description                       |
|-----------------------|-----------------------------------|
| MONGO_URI             | MongoDB connection string         |
| APIKEY                | API key for protected routes      |
| EMAIL                 | Gmail address for sending emails  |
| EMAIL_PASSWORD        | Gmail app password                |
| EMAIL_FROM            | Sender name and email             |
| NEXT_PUBLIC_BASE_URL  | Frontend base URL                 |

## API Endpoints
### Auth Routes
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/verify-otp` - Verify OTP
- `POST /api/auth/send-reset-password-otp` - Send OTP for password reset
- `POST /api/auth/reset-password` - Reset password

### Employee Routes
- `POST /api/auth/register-employee` - Register employee
- `POST /api/auth/login-employee` - Login employee
- `GET /api/auth/get-all-employees` - List employees

### Property Routes
- `POST /api/auth/add-property` - Add property
- `GET /api/auth/get-all-properties` - List properties
- `PUT /api/auth/update-property/:id` - Update property
- `DELETE /api/auth/delete-property/:id` - Delete property

### Policy Routes
- `POST /api/auth/new-policy` - Create new policy

## Project Structure
```
app.js
package.json
vercel.json
controllers/
	auth.js
middlewares/
	authentication.js
	error-handler.js
	generate-api-key.js
	PolicyNumberGenerator.js
models/
	Employee.js
	OTP.js
	Policy.js
	Property.js
	User.js
routes/
	auth.js
utils/
	sendEmail.js
```

## Usage
- Use Postman or similar tools to test API endpoints.
- Ensure MongoDB and email credentials are valid.
- For deployment, configure Vercel or your preferred platform.

## Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License
[MIT](LICENSE)
"# FCT-DCIP-BACKEND" 
