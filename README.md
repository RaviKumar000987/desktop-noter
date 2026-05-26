# 🚀 Entering Editor

A modern desktop text editor built with Electron + Monaco Editor.

Entering Editor is a fast, lightweight, and customizable desktop editor designed to evolve into a premium professional editing experience.

---

## ✨ Current Features

### 📝 Monaco Editor Integration

- Monaco Editor engine
- Smooth cursor animation
- Word wrapping
- Minimap support
- Automatic layout adjustment
- Professional dark theme
- Rounded selections
- Custom font support
- Enhanced line spacing
- Smooth scrolling

---

### 📊 Status Panel

Live editor information:

- Total Words Count
- Cursor Position
  - Line Number
  - Column Number
- UTF-8 indicator
- Language display

Example:

```
Words: 128 | Ln 15, Col 8
```

---

### 📂 File Menu Features

Current supported actions:

#### File → New

Create a fresh document instantly.

Features:

- Confirmation before clearing text
- Cursor reset to line 1
- Auto focus editor after creation

#### File → Open

Open files directly into the editor.

Supported:

- .txt
- .js
- .html
- .css
- .json
- .md

---

### 🎨 Custom Desktop UI

Custom desktop interface built from scratch:

- Frameless Electron window
- Custom title bar
- Custom menu bar
- Dropdown menu system
- Minimize button
- Maximize button
- Close button

---

### ⚡ Performance & Architecture

Built using:

- Electron
- Monaco Editor
- HTML
- CSS
- JavaScript

Architecture:

```

Renderer Process
↓
Preload Layer
↓
IPC Communication
↓
Electron Main Process

```

Secure Electron configuration:

- Context Isolation Enabled
- Node Integration Disabled
- Secure IPC Bridge

---

## 📁 Project Structure

```

Entering-Editor/

├── main.js
├── preload.js
├── app.js
├── index.html
├── style.css
├── package.json
├── package-lock.json
├── .gitignore

```

---

## 🚀 Installation

Clone repository:

```bash
git clone YOUR_REPOSITORY_URL
```

Move inside project:

```bash
cd entering-editor
```

Install dependencies:

```bash
npm install
```

Run project:

```bash
npm start
```

---

## 🔥 Upcoming Features

Planned roadmap:

- Save File
- Save As
- Recent Files
- Auto Save
- Theme System
- Split Editor
- Terminal Integration
- Multiple Tabs
- File Explorer Sidebar
- Find & Replace
- Command Palette
- Git Integration
- Session Restore
- AI Features
- Plugin System
- Workspace Support

---

## 💡 Vision

Entering Editor aims to become a professional desktop editor experience built completely with Electron.

Focused on:

- Speed
- Productivity
- Simplicity
- Customization

---

## 👨‍💻 Developer

Made with dedication and caffeine.

Built by Ravi Kumar - sparrow.

---

⭐ Star this repository if you like the project.

## 🚀 Installation Guide

### 1. Clone Repository

```bash
git clone YOUR_REPOSITORY_URL
```

Example:

```bash
git clone https://github.com/RaviKumar000987/desktop-noter.git
```

---

### 2. Move Into Project Folder

```bash
cd desktop-noter
```

---

### 3. Install Dependencies

```bash
npm install
```

This command installs all required packages automatically from:

- package.json
- package-lock.json

---

### 4. Run Application

```bash
npm start
```

Application will launch automatically.

---

## 🛠 Requirements

Install before running:

### Node.js

Recommended:

```
Node.js v22+
```

Check installed version:

```bash
node --version
```

---

### npm

Check npm:

```bash
npm --version
```

---

### Git

Check Git:

```bash
git --version
```

---

## ⚡ Quick Setup

For developers:

```bash
git clone https://github.com/RaviKumar000987/desktop-noter.git

cd desktop-noter

npm install

npm start
```

Done 🎉

⚠ This project is currently under active development.
Features may change over time.
