# 🖥️ AUAU Builder PC Local

### PC Configuration Builder Powered by Local Artificial Intelligence

![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-API-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?logo=sqlite&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Frontend-F7DF1E?logo=javascript&logoColor=black)
![AI](https://img.shields.io/badge/AI-Qwen3%204B-blueviolet)
![CUDA](https://img.shields.io/badge/GPU-CUDA-76B900?logo=nvidia&logoColor=white)
![Status](https://img.shields.io/badge/Status-Beta-orange)

---

## 📖 Overview

**AUAU Builder PC Local** is a web application designed to create, manage, save, analyze, and compare computer configurations.

The project combines a traditional PC configuration builder with locally executed artificial intelligence. It provides a centralized component library, configuration management, price calculations, and AI-assisted PC analysis using a locally hosted Qwen model.

The application is built around:

- Node.js as the server-side runtime.
- Express 5 for the HTTP server and REST API.
- SQLite for local data storage.
- HTML, CSS, and JavaScript for the frontend.
- User accounts and session management.
- Qwen3 4B in GGUF format for AI analysis.
- `node-llama-cpp` for local model inference.
- CUDA acceleration in compatible environments.

This project is developed as part of a **Holberton School portfolio**.

### Project Goals

- Simplify PC configuration creation.
- Centralize computer components.
- Save and manage multiple configurations.
- Support user accounts and profiles.
- Calculate configuration prices.
- Compare multiple PC builds.
- Run artificial intelligence locally.
- Separate verifiable technical data from AI-generated explanations.
- Prepare for a future hardware compatibility engine.

---

## ✨ Features

### 🖥️ 1. PC Configuration Builder

The application allows users to build computer configurations using components stored in the local library.

Supported component categories include:

- CPUs
- GPUs
- RAM
- Motherboards
- Storage
- Power Supplies (PSU)
- PC Cases
- Cooling
- Fans
- Thermal Paste

Users can select components, view their prices, and calculate the total cost of a configuration.

Configurations can be saved, viewed, edited, and deleted.

### 💾 2. User Accounts and Configuration Management

The application includes an authentication system with:

- User registration.
- User login.
- User logout.
- Session verification.
- User profile management.

Passwords are hashed using `bcryptjs` before being stored in SQLite.

User sessions are managed with `express-session`.

Configurations are associated with their owners. The build management routes check the authenticated user's ID to restrict access to their own configurations.

The component library is shared between users.

### 👤 3. User Profiles and Avatars

The home page includes a user profile menu.

Users can:

- View their account username.
- Upload a profile picture.
- Log out of their account.

Supported image formats:

- PNG
- JPEG
- WebP

The maximum avatar upload size is 2 MB.

Avatar files are stored in `public/uploads/avatars/`, while their references are saved in SQLite.

### 🧩 4. Component Library

The component library centralizes the hardware components used in PC configurations.

It provides:

- Component listing.
- Search by name.
- Filtering by brand.
- Filtering by category.
- Manual component creation.
- Component editing.
- Price updates.
- Component deletion.

Stored component information includes:

- Name.
- Category.
- Price.
- Brand.
- Technical specifications.
- Custom component indicator.

Component names are checked to reduce duplicate entries, using case-insensitive comparison.

**Important:** the component library is shared between users. Changing a component's price can therefore affect the displayed totals of configurations that use that component.

### 🌐 5. External Component Import with VantaSpec

The project integrates external product search through the VantaSpec API.

Users can search for computer hardware and retrieve available information such as:

- Product name.
- Brand.
- Category.
- Description.
- Available price.
- Currency.
- Retailer.
- Product URL.
- Product image.
- Stock availability, when provided.

Search results can be imported into the local component library.

Imported product prices from the external source are preserved in the component's additional specifications. The initial local component price is set to zero.

Therefore, the external retailer price must not be confused with the local price stored in the component library.

This feature requires an Internet connection and depends on the availability of the external service.

### 💰 6. Configuration Price Calculation

Component prices are used to calculate the total cost of a PC configuration.

The build retrieval routes recalculate the total from the associated components.

This makes it possible to reflect current component prices when retrieving a saved configuration.

**Note:** dynamically recalculating the total does not automatically update the historical `total_price` column in SQLite whenever a component price changes.

### ⚖️ 7. Classic PC Comparison

The application includes a comparison interface that allows users to select multiple configurations.

It displays information such as:

- Total prices.
- Selected components.
- Differences between component categories.
- Detected technical characteristics.
- Observations and advantages or limitations calculated from available information.

The classic comparison uses local JavaScript rules to analyze data retrieved from the API.

### 🤖 8. Local Artificial Intelligence Analysis

The project integrates **Qwen3 4B in GGUF format**.

The model is configured in:

`services/localAI.js`

The local inference engine uses:

- `node-llama-cpp`
- Qwen3 4B Q4_K_M.
- A configured context size of 8192.
- Dedicated generation parameters.
- Lazy model initialization.
- A queue to serialize generation requests.
- CUDA acceleration in compatible environments.

The model generates textual analyses of PC configurations.

The analysis follows ten main sections:

1. General Overview.
2. Processors.
3. Graphics Cards.
4. RAM.
5. Storage.
6. Cooling and Case.
7. Other Components.
8. Price Comparison.
9. Advantages and Limitations.
10. Final Recommendation.

The backend retrieves component information from SQLite before preparing the data sent to the model.

Technical information is also extracted and verified on the server side to distinguish retrieved facts from AI-generated explanations.

**The model runs directly through `node-llama-cpp`. LM Studio is not required for this integration.**

### 🔍 9. Technical Data and Reliability

The project aims to reduce analysis errors by using components actually stored in the database.

The backend extracts information such as:

- Processor details.
- Graphics cards and their quantities.
- RAM capacity and memory type.
- Detected storage capacity.
- Power supply specifications.
- Available cooling and case information.

Some technical characteristics may be missing, incomplete, or impossible to extract automatically.

Artificial intelligence can also generate inaccurate information. Its recommendations must not be considered a definitive technical certification.

---

## 🏗️ Technical Architecture

The application separates the frontend, backend, database, and local AI engine.

```text
                  USER
                   |
                   v
              WEB INTERFACE
               HTML / CSS / JS
                   |
                   v
                NODE.JS
                 EXPRESS
                   |
          +--------+--------+
          |        |        |
          v        v        v
        SQLITE   REST API  LOCAL AI
          |        |        |
          |        |        v
          |        |     QWEN3 4B
          |        |        |
          |        |   node-llama-cpp
          |        |        |
          |        |       CUDA
          |        |
          +--------+
                   |
                   v
              WEB RESULTS
```

### General Workflow

1. The user interacts with the web interface.
2. The frontend sends HTTP requests to the Express server.
3. The server validates requests and checks sessions when required.
4. SQLite provides the stored information.
5. API routes process the requests.
6. The local AI engine is called when an AI analysis is requested.
7. The server returns the results to the frontend.

---

## 🛠️ Technologies Used

| Technology | Purpose |
|---|---|
| Node.js | Server-side JavaScript runtime |
| Express 5 | HTTP server and REST API |
| SQLite | Local database |
| sqlite3 | SQLite database access |
| express-session | Session management |
| bcryptjs | Password hashing |
| Multer | Profile image uploads |
| CORS | Cross-origin request handling |
| JavaScript | Frontend and backend logic |
| HTML5 | Web page structure |
| CSS3 | User interface styling |
| Qwen3 4B | Local AI model |
| GGUF | Model file format |
| node-llama-cpp | Local model inference |
| CUDA | GPU acceleration |
| Nodemon | Development server monitoring |
| Git | Version control |
| GitHub | Source code hosting |
| Ubuntu / WSL | Development environment |

---

## 📂 Project Structure

```text
auau-builder-pc-local/
│
├── server.js
├── package.json
├── package-lock.json
├── README.md
│
├── database/
│   ├── db.js
│   ├── init.sql
│   ├── database.db
│   └── optional backups
│
├── models/
│   └── qwen3-4b-q4_k_m.gguf
│
├── public/
│   ├── index.html
│   ├── builder.html
│   ├── components.html
│   ├── compare.html
│   ├── login.html
│   │
│   ├── css/
│   │   ├── style.css
│   │   ├── home.css
│   │   ├── builder.css
│   │   ├── components.css
│   │   └── compare.css
│   │
│   ├── js/
│   │   ├── home.js
│   │   ├── profile.js
│   │   ├── app.js
│   │   ├── components.js
│   │   └── compare.js
│   │
│   └── uploads/
│       └── avatars/
│
├── routes/
│   ├── auth.js
│   ├── profile.js
│   ├── builds.js
│   ├── components.js
│   ├── import.js
│   └── ai.js
│
└── services/
    └── localAI.js
```

This structure represents the main application files. Backup files and auxiliary files are not all included.

### Main Files

- `server.js`: initializes Express, sessions, API routes, and static file serving.
- `database/db.js`: manages SQLite access.
- `database/init.sql`: contains the database initialization schema.
- `routes/auth.js`: registration, login, session verification, and logout.
- `routes/profile.js`: profile retrieval and avatar management.
- `routes/builds.js`: creation, retrieval, updating, and deletion of PC configurations.
- `routes/components.js`: component library management.
- `routes/import.js`: external product search through VantaSpec.
- `routes/ai.js`: AI analysis preparation and processing.
- `services/localAI.js`: local model loading and inference.
- `public/js/app.js`: PC builder frontend logic.
- `public/js/components.js`: component library frontend logic.
- `public/js/compare.js`: classic comparison and AI analysis.
- `public/js/home.js`: saved configuration display.
- `public/js/profile.js`: profile interface management.

---

## ⚙️ Requirements

To run the project, you need:

- Node.js.
- npm.
- Git.
- An environment compatible with the project dependencies.
- An initialized SQLite database.
- The GGUF model expected by the AI engine.

### GPU Acceleration Requirements

For CUDA acceleration:

- A compatible NVIDIA GPU.
- Appropriate NVIDIA drivers.
- A working CUDA environment.
- A `node-llama-cpp` installation compatible with CUDA.

The project was developed in an Ubuntu environment under WSL with CUDA acceleration.

The current GPU configuration does not guarantee identical model performance on every machine.

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone <GITHUB_REPOSITORY_URL>
```

Navigate to the project directory:

```bash
cd auau-builder-pc-local
```

Replace `<GITHUB_REPOSITORY_URL>` with the actual repository URL.

### 2. Install Dependencies

```bash
npm install
```

This installs the dependencies declared in `package.json`.

### 3. Prepare the Database

The default database file is:

```text
database/database.db
```

At startup, the server executes `database/init.sql` to create missing tables.

**Important:** the current `init.sql` schema does not fully match the development database schema. In particular, the existing development database includes a `builds.user_id` column that is not declared in the current initialization file.

A fresh installation therefore needs a schema consistent with the current application routes before build management can work correctly. Running `init.sql` alone does not automatically migrate an older database structure.

Do not replace an existing database without first creating a backup.

### 4. Configure the Session Secret

The server uses the `SESSION_SECRET` environment variable to sign user sessions.

On Linux or WSL, generate a random secret before starting the server:

```bash
export SESSION_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
```

Keep the same secret between restarts if you want existing sessions to remain valid.

Never publish this value in a GitHub repository.

### 5. Prepare the AI Model

The expected model is configured in `services/localAI.js`:

```text
models/qwen3-4b-q4_k_m.gguf
```

Make sure the GGUF file exists at this location.

The model is large and may need to be distributed separately from the source code.

### 6. Start the Server

The current `package.json` does not define `start` or `dev` scripts.

To start the server directly:

```bash
node server.js
```

The application should then be available at:

```text
http://localhost:3000
```

Open this address in your browser.

---

## 🗄️ SQLite Database

The project uses SQLite to store accounts, components, and PC configurations.

The main tables are:

| Table | Purpose |
|---|---|
| `users` | User accounts and profile information |
| `components` | Shared component library |
| `builds` | Saved PC configurations |
| `build_items` | Relationships between builds and components |

### `users` Table

Stores information such as:

- User ID.
- Username.
- Hashed password.
- Creation date.
- Avatar.

### `components` Table

Stores information such as:

- Component ID.
- Name.
- Category.
- Price.
- Brand.
- Technical specifications.
- Custom component indicator.

### `builds` Table

Stores information such as:

- Build ID.
- Configuration name.
- Historical total price.
- Creation date.
- Owner ID in the current development database.

### `build_items` Table

Connects components to PC configurations.

This structure allows multiple components to be associated with a single build.

### Database Backup

Before performing important database operations, create a backup:

```bash
sqlite3 database/database.db ".backup '/tmp/auau-backup.db'"
```

This creates a database copy in `/tmp`.

To work without modifying the main database, use a separate copy whenever possible.

### Custom Database Path

The project also supports the `AUAU_DB_PATH` environment variable to select another SQLite database file:

```bash
AUAU_DB_PATH=/path/to/database.db node server.js
```

Verify the selected database path before using this option with important data.

---

## 🌐 REST API

The backend exposes HTTP endpoints organized in the `routes/` directory.

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Log in |
| GET | `/api/auth/me` | Check the current session |
| POST | `/api/auth/logout` | Log out |

### User Profile

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/profile/me` | Retrieve the current profile |
| POST | `/api/profile/avatar` | Upload a profile avatar |

### PC Builds

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/builds` | List the user's builds |
| GET | `/api/builds/:id` | Retrieve a build |
| POST | `/api/builds` | Create a build |
| PUT | `/api/builds/:id` | Update a build |
| DELETE | `/api/builds/:id` | Delete a build |

Build management routes require an authenticated session and check configuration ownership.

### Components

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/components` | List components |
| POST | `/api/components` | Add a component |
| PUT | `/api/components/:id` | Update a component |
| DELETE | `/api/components/:id` | Delete a component |

### External Import

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/import/search?q=...` | Search external products |

This endpoint communicates with the VantaSpec service.

### Artificial Intelligence

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/ai/stats` | Retrieve generation statistics |
| POST | `/api/ai/compare` | Compare multiple builds using Qwen |

Example request:

```http
POST /api/ai/compare
Content-Type: application/json
```

JSON body:

```json
{
  "buildIds": [5, 6]
}
```

The comparison accepts between 2 and 6 distinct build IDs.

These IDs are examples and must correspond to builds present in the database.

**Security note:** the code audit identified insufficient access controls on some component routes and on build access through the AI route. These issues should be addressed before production deployment with multiple users or sensitive data.

---

## 🧪 Testing and Verification

The project does not currently have an automated test suite configured in `package.json`.

The `npm test` script is still a placeholder.

Some checks can nevertheless be performed manually.

### Check JavaScript Syntax

```bash
node --check routes/ai.js
```

```bash
node --check routes/builds.js
```

### Check the Server

Start the application:

```bash
node server.js
```

Open:

```text
http://localhost:3000
```

### Test an API Endpoint

Example:

```bash
curl http://localhost:3000/api/builds
```

This endpoint requires an authenticated session.

To test protected endpoints, use a session obtained after logging in.

### Test AI Comparison

```bash
curl -X POST http://localhost:3000/api/ai/compare \
  -H "Content-Type: application/json" \
  -d '{"buildIds":[5,6]}'
```

This test requires existing builds in SQLite and a correctly initialized local AI engine.

---

## 🔒 Privacy and Security

The Qwen model runs locally. AI inference therefore does not need to be sent to a remote AI service.

However, this does not mean that every application feature works offline.

VantaSpec product imports require an Internet connection.

Important security considerations:

- Passwords are hashed with bcryptjs.
- Sessions are managed with `express-session`.
- Build management routes check configuration ownership.
- Avatar files are stored in a public directory.
- Not all component management routes currently require authentication.
- The AI route needs stronger access control to guarantee isolation between users.
- The session secret must remain confidential.
- SQLite data should be backed up regularly.

This project is currently a beta development application. Additional security reviews are necessary before production deployment.

---

## 🧩 Known Limitations

### Hardware Compatibility

The project does not yet include a complete deterministic engine capable of guaranteeing compatibility between all hardware components.

AI-generated analyses must not be treated as definitive technical validation.

### Component Specifications

Component data may be incomplete or contain commercial descriptions that are difficult to interpret automatically.

### Price Calculation

Totals are calculated using current component prices. Updating a shared component price can therefore change the displayed total of an older configuration.

### External Product Import

External searches depend on the availability of VantaSpec and an Internet connection.

### AI Performance

Performance depends on several factors:

- CPU.
- GPU.
- Available memory.
- GGUF model.
- Context size.
- CUDA configuration.

### Database Transactions

Some build creation, update, and deletion operations involve multiple SQLite writes that are not yet grouped into a single transaction.

An interruption during these operations may leave partially modified data.

### SQLite Initialization

The `init.sql` schema must be aligned with the schema expected by the current application routes before a fresh installation can be considered fully automated.

---

## 🛣️ Roadmap

### Existing Features

- [x] Node.js / Express backend.
- [x] SQLite database.
- [x] User registration and login.
- [x] Session management.
- [x] User profile management.
- [x] Avatar uploads.
- [x] PC configuration creation and management.
- [x] Component library.
- [x] Component price updates.
- [x] VantaSpec product import.
- [x] Configuration price calculation.
- [x] Classic PC comparison.
- [x] Qwen3 4B integration.
- [x] Local inference using `node-llama-cpp`.
- [x] CUDA acceleration configuration.
- [x] Extraction of selected technical data for AI analysis.

### Planned Improvements

- [ ] Strengthen API access controls.
- [ ] Improve SQLite transaction handling.
- [ ] Align the initialization schema with the current database structure.
- [ ] Add automated tests.
- [ ] Improve technical specification normalization.
- [ ] Improve component identification.
- [ ] Improve electrical specification extraction.
- [ ] Improve portability across environments.
- [ ] Improve performance and error messages.
- [ ] Expand technical documentation.

### 🔧 Future Project: Assembly Hardware Compatibility Engine

One planned evolution is the development of a hardware compatibility engine using x86-64 Assembly.

The objective is to separate deterministic technical checks from AI-generated explanations.

Potential checks include:

**CPU and Motherboard Compatibility**

Check processor sockets and supported motherboard characteristics.

**RAM Compatibility**

Compare memory generations and supported memory specifications.

**Power Supply Compatibility**

Compare estimated system power requirements with power supply specifications.

**PC Case Compatibility**

Check component form factors and physical dimensions.

### Proposed Architecture

```text
              AUAU BUILDER
                   |
                   v
                NODE.JS
                   |
         +---------+---------+
         |                   |
         v                   v
       SQLITE          ASSEMBLY ENGINE
         |                   |
         |              Technical Rules
         |                   |
         +---------+---------+
                   |
                   v
            VERIFIED RESULTS
                   |
                   v
               LOCAL QWEN
                   |
                   v
           USER-FRIENDLY EXPLANATION
```

The Assembly engine would handle deterministic technical rules. Qwen could then explain the results in accessible language.

**This engine is a future feature and has not yet been implemented in the current version.**

---

## 🎓 Educational Context

This project is developed as part of a learning and software development journey within a Holberton School portfolio.

It provides practical experience with:

- Frontend and backend JavaScript.
- REST API development.
- Server architecture.
- Relational databases.
- Authentication and sessions.
- File management.
- Local AI model integration.
- GPU and CUDA usage.
- Debugging and code analysis.
- Git version control.
- Technical documentation.

---

## 🤝 Contributions

This project is currently developed as a personal and educational project.

Feedback, suggestions, and improvement proposals are welcome.

To contribute, use the issue tracking and discussion features of the GitHub repository when available.

---

## 📄 License

No specific open-source license is currently defined for this project.

Reuse and redistribution conditions should be clarified by adding an appropriate license to the repository.

---

## 👨‍💻 Author

**AUAU Builder PC Local**

Personal project developed as part of a Holberton School portfolio.

---

## ⭐ Conclusion

AUAU Builder PC Local combines a PC configuration builder, a component library, a local database, and locally executed artificial intelligence.

The project demonstrates how Node.js, Express, SQLite, and Qwen3 can work together to create, manage, analyze, and compare computer configurations.

The beta version is the first step toward a more complete application, with planned improvements to security, technical data management, and the development of an independent hardware compatibility engine.

**AUAU Builder PC Local — Build, Compare, and Understand Your PC Configuration.**
