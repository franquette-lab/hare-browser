# Hare Browser

[![GitHub Release](https://shields.io)](https://github.com)
[![Download Hare Browser on SourceForge](https://shields.io)](https://sourceforge.net)
[![License: MIT](https://shields.io)](LICENSE)

**Hare Browser** is a powerful, privacy-focused multi-tile web browser designed for productivity, research, and local AI-assisted browsing on **Windows** and **Linux**.

---

## ✨ Features

- **Multi-Tile Mosaic Workspace:** Organize multiple websites side-by-side with horizontal and vertical split views.
- **Floating Navigation Bar:** Clean, distraction-free navigation controls per tile.
- **Local AI Assistant (Ollama):** Built-in AI assistant powered by [Ollama](https://ollama.com) so your prompts and browsing data stay 100% private on your machine.
- **Built-in Ad & Tracker Blocking:** Fast browsing out of the box with privacy-focused search integration.
- **Session Management:** Save and restore complex multi-tile workspaces anytime.
- **Smart Bookmarks & Themes:** Advanced bookmark organization with light and dark themes.

---

## 📥 Download & Installation

Official installers for Windows and Linux are available on both **[GitHub Releases](https://github.com)** and **[SourceForge](https://sourceforge.net)**:

[![Download Hare Browser](https://fsdn.com)](https://sourceforge.netfiles/latest/download)

### 🪟 Windows (x64)

1. Download **`Hare-Browser-Setup-1.0.2.exe`** from [GitHub Releases](https://github.com) or [SourceForge](https://sourceforge.netfiles/).
2. Run the installer and follow the setup wizard.
3. Launch **Hare Browser** from the Start menu or Desktop shortcut.

---

### 🐧 Linux (x64)

#### Option 1: Debian / Ubuntu / Linux Mint (`.deb`)

1. Download **`Hare-Browser-1.0.2-amd64.deb`** from [GitHub Releases](https://github.com) or [SourceForge](https://sourceforge.netfiles/).
2. Install it via terminal:
   ```bash
   sudo apt install ./Hare-Browser-1.0.2-amd64.deb
   ```
3. Launch **Hare Browser** from your application menu or by running `hare-browser`.

#### Option 2: Universal Linux Binary (`.AppImage`)

Works on Fedora, Arch Linux, openSUSE, Ubuntu, and most x86_64 distributions without installation:

1. Download **`Hare-Browser-1.0.2-x86_64.AppImage`** from [GitHub Releases](https://github.com) or [SourceForge](https://sourceforge.netfiles/).
2. Make the file executable and run it:
   ```bash
   chmod +x Hare-Browser-1.0.2-x86_64.AppImage
   ./Hare-Browser-1.0.2-x86_64.AppImage
   ```

---

## 🤖 Local AI Setup (Optional)

Hare Browser integrates directly with **Ollama** running locally (`http://127.0.0.1:11434`):

1. Install [Ollama](https://ollama.com) on your system (or install it directly from Hare Browser's built-in assistant prompt).
2. Pull a model (e.g., `ollama pull llama3.2` or `ollama pull mistral`).
3. Open the AI sidebar in Hare Browser to summarize pages, compare open tiles, or ask questions privately.

---

## 🛠️ Development

### Requirements

- **Node.js** 22+
- **npm**

### Run from source

```bash
git clone https://github.com
cd hare-browser
npm install
npm start
```

### Build installers

```bash
# Windows installer (.exe)
npm run build:win

# Linux packages (.deb & .AppImage)
npm run build:linux
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
