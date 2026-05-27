# tdimagedown / TD Image Downloader

[English](#english) | [中文](#chinese)

---

<a name="english"></a>
## 🇬🇧 English

**tdimagedown** is a powerful Manifest V3 Chrome extension designed to seamlessly extract, filter, and download images from any web page using the Chrome Side Panel.

### ✨ Features
- **Side Panel Integration**: Extracts and previews images in a convenient side panel without leaving your current tab.
- **Smart Filtering**: Filter images by type (JPG, PNG, WEBP, GIF, SVG, AVIF, etc.), minimum width, and minimum height.
- **Search & Sort**: Search images by URL or filename. Sort by largest area, page order, or URL.
- **Batch Download**: Select multiple images and download them all with a single click.
- **Multi-language Support**: Switch between English and Chinese (中文) seamlessly.

### 🚀 Getting Started

#### Prerequisites
- [Node.js](https://nodejs.org/) installed on your machine.
- Google Chrome (or a Chromium-based browser).

#### Build & Install

1. Clone the repository and navigate to the project directory:
   ```bash
   git clone <your-repo-url>
   cd tdimagedown
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
   *The built extension will be placed in the `dist` directory.*

4. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable **Developer mode** in the top right corner.
   - Click **Load unpacked** and select the `dist` directory inside your project folder.

### 🛠️ Development
During development, after making any code changes, simply run `npm run build` again and click the refresh icon on the extension card in `chrome://extensions/`.

---

<a name="chinese"></a>
## 🇨🇳 中文

**tdimagedown** 是一款基于 Manifest V3 的 Chrome 浏览器插件，可通过侧边栏 (Side Panel) 方便地提取、筛选并批量下载网页上的图片。

### ✨ 功能特点
- **侧边栏集成**：在不离开当前标签页的情况下，通过侧边栏提取并预览页面图片。
- **智能筛选**：支持按图片格式（JPG、PNG、WEBP、GIF、SVG、AVIF 等）、最小宽度、最小高度进行过滤。
- **搜索与排序**：支持按 URL 或文件名搜索图片，支持按面积大小、页面顺序或 URL 排序。
- **批量下载**：一键全选并批量下载您需要的图片。
- **多语言支持**：内置英文与中文无缝切换。

### 🚀 快速开始

#### 环境要求
- 需安装 [Node.js](https://nodejs.org/)。
- 谷歌浏览器 (Google Chrome) 或其他基于 Chromium 的浏览器。

#### 构建与安装

1. 克隆项目并进入目录：
   ```bash
   git clone <your-repo-url>
   cd tdimagedown
   ```
2. 安装依赖：
   ```bash
   npm install
   ```
3. 构建项目：
   ```bash
   npm run build
   ```
   *构建好的插件代码将生成在 `dist` 目录下。*

4. 在 Chrome 中加载插件：
   - 在浏览器地址栏输入 `chrome://extensions/` 并回车。
   - 打开右上角的 **开发者模式**。
   - 点击 **加载已解压的扩展程序**，选择本项目生成的 `dist` 文件夹。

### 🛠️ 开发说明
在开发过程中，修改代码后，只需再次运行 `npm run build`，然后在 `chrome://extensions/` 页面点击该插件的刷新按钮即可生效。
