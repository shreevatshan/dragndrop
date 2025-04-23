# Drag 'n Drop File Sharing Web Application

A lightweight file sharing web application built with Go that allows users to upload and download files without authentication.

## Features

- Simple and intuitive user interface
- File upload with drag and drop functionality
- File selection via traditional file picker
- Folder upload with maintained directory structure
- List of all uploaded files with download links
- Copy download URL to clipboard
- Download folders as ZIP files
- Responsive design that works on mobile and desktop

## Prerequisites

- Go 1.16 or higher

## Installation

1. Clone this repository or download the source code
2. Navigate to the project directory

## Running the Application

To run the application, use the following command:

```bash
go run main.go
```

The server will start at http://localhost:8080

### Configuration Options

You can configure the application using a single command-line flag:

- `-baseurl`: Set the complete base URL for the application (default: http://localhost:8080)

The port to run the server on is automatically extracted from the base URL. If no port is specified in the URL, the default port (80 for HTTP, 443 for HTTPS) is used.

Examples:

```bash
# Run with default settings
go run main.go
```

This will start the server at http://localhost:8080

```bash
# Run with a custom domain
go run main.go -baseurl "http://example.com"
```

This will start the server at http://example.com (port 80)

```bash
# Run with a custom domain and port
go run main.go -baseurl "http://example.com:8080"
```

This will start the server at http://example.com:8080

```bash
# Run with a custom domain, port, and path
go run main.go -baseurl "http://example.com:8080/fileshare"
```

This will start the server at http://example.com:8080/fileshare

## Usage

1. Open your web browser and navigate to http://localhost:8080
2. Choose between "Upload Files" or "Download Files" tabs
3. To upload files:
   - Drag and drop files onto the upload area, or
   - Click "Choose Files" to select individual files from your device
   - Click "Choose Folder" to select and upload an entire folder with its structure
4. To download files:
   - Click the "Download Files" tab to see all uploaded files and folders
   - For individual files:
     - Click "Download" to download a file directly
     - Click "Copy URL" to copy the download link to your clipboard
   - For folders:
     - Click "Download" to download the entire folder as a ZIP archive

## Project Structure

```
.
├── main.go                # Go server implementation
├── templates/
│   └── index.html         # HTML template for the web interface
├── static/
│   ├── css/
│   │   └── style.css      # CSS styles
│   ├── js/
│   │   └── app.js         # JavaScript functionality
│   └── uploads/           # Directory for uploaded files
└── README.md              # This file
```
## Disclaimer

Built with Cline AI Extension

## License

This project is open source and available under the [MIT License](LICENSE).
