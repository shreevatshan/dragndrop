package main

import (
	"archive/zip"
	"encoding/json"
	"flag"
	"fmt"
	"html/template"
	"io"
	"io/fs"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Config holds the application configuration
type Config struct {
	BaseURL string
}

// FileInfo represents information about an uploaded file
type FileInfo struct {
	Name       string    `json:"name"`
	Size       int64     `json:"size"`
	URL        string    `json:"url"`
	Path       string    `json:"path,omitempty"` // Path within folder structure
	UploadedAt time.Time `json:"uploadedAt"`
}

func main() {
	// Parse command line flags
	config := Config{}
	flag.StringVar(&config.BaseURL, "baseurl", "http://localhost:8080", "Base URL for the application (e.g., http://example.com:8080/fileshare)")
	flag.Parse()

	// Create uploads directory if it doesn't exist
	os.MkdirAll("./static/uploads", os.ModePerm)

	// Extract path from base URL
	u, err := url.Parse(config.BaseURL)
	if err != nil {
		log.Fatalf("Invalid base URL: %v", err)
	}

	// Get path from URL or use default
	basePath := u.Path

	// Create a new ServeMux for our routes
	mux := http.NewServeMux()

	// Serve static files
	mux.Handle(basePath+"/static/", http.StripPrefix(basePath+"/static/", http.FileServer(http.Dir("static"))))

	// Home page
	mux.HandleFunc(basePath+"/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != basePath+"/" && r.URL.Path != basePath {
			http.NotFound(w, r)
			return
		}
		homeHandler(w, r, config)
	})

	// Upload handler
	mux.HandleFunc(basePath+"/upload", func(w http.ResponseWriter, r *http.Request) {
		uploadHandler(w, r, config)
	})

	// List files handler
	mux.HandleFunc(basePath+"/files", func(w http.ResponseWriter, r *http.Request) {
		listFilesHandler(w, r, config)
	})

	// Download handler
	mux.HandleFunc(basePath+"/download/", func(w http.ResponseWriter, r *http.Request) {
		downloadHandler(w, r)
	})

	// Download ZIP handler
	mux.HandleFunc(basePath+"/download-zip/", func(w http.ResponseWriter, r *http.Request) {
		downloadZipHandler(w, r)
	})

	// Delete file handler
	mux.HandleFunc(basePath+"/delete/", func(w http.ResponseWriter, r *http.Request) {
		deleteHandler(w, r)
	})

	// Get port from URL or use default
	port := u.Port()
	if port == "" {
		if u.Scheme == "https" {
			port = "443"
		} else {
			port = "80"
		}
	}

	// Start the server
	fmt.Printf("Server started at %s\n", config.BaseURL)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func homeHandler(w http.ResponseWriter, r *http.Request, config Config) {
	tmpl, err := template.ParseFiles("templates/index.html")
	if err != nil {
		sendErrorResponse(w, "Failed to load template: "+err.Error(), http.StatusInternalServerError)
		return
	}

	err = tmpl.Execute(w, map[string]string{
		"BaseURL": config.BaseURL,
	})

	if err != nil {
		sendErrorResponse(w, "Failed to render template: "+err.Error(), http.StatusInternalServerError)
		return
	}
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error string `json:"error"`
}

// sendErrorResponse sends a JSON error response
func sendErrorResponse(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(ErrorResponse{Error: message})
}

func uploadHandler(w http.ResponseWriter, r *http.Request, config Config) {
	if r.Method != http.MethodPost {
		sendErrorResponse(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse the multipart form with 32MB max memory
	err := r.ParseMultipartForm(32 << 20)
	if err != nil {
		sendErrorResponse(w, "Failed to parse form: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Get the file from the request
	file, handler, err := r.FormFile("file")
	if err != nil {
		sendErrorResponse(w, "Failed to get file: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Check if this is a folder upload by looking for the path parameter
	path := r.FormValue("path")
	var filePath string

	if path != "" {
		// This is a folder upload
		log.Printf("Folder upload detected with path: %s", path)

		// Extract the directory structure from the path
		dirPath := filepath.Dir(path)

		// For drag and drop folders, the path might be the filename itself
		// In this case, we need to extract any directory structure from the filename
		if dirPath == "." && strings.Contains(handler.Filename, "/") {
			// Use the filename as the path
			dirPath = filepath.Dir(handler.Filename)
			path = handler.Filename
			log.Printf("Using filename as path: %s, dirPath: %s", path, dirPath)
		}

		// Create the directory structure if it doesn't exist
		uploadDir := filepath.Join("static/uploads", dirPath)
		err = os.MkdirAll(uploadDir, os.ModePerm)
		if err != nil {
			sendErrorResponse(w, "Failed to create directory: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// Set the file path to include the directory structure
		filePath = filepath.Join("static/uploads", path)
	} else {
		// This is a regular file upload
		// Ensure filename is safe
		filename := filepath.Base(handler.Filename)
		filePath = filepath.Join("static/uploads", filename)
	}

	// Check if file already exists
	if fileInfo, err := os.Stat(filePath); err == nil {
		log.Printf("File already exists: %s, deleting it before upload", filePath)

		// Check if it's a directory
		if fileInfo.IsDir() {
			// Delete the directory and all its contents
			err = os.RemoveAll(filePath)
		} else {
			// Delete the file
			err = os.Remove(filePath)
		}

		if err != nil {
			log.Printf("Failed to delete existing file/folder: %s, error: %v", filePath, err)
			sendErrorResponse(w, "Failed to delete existing file/folder: "+err.Error(), http.StatusInternalServerError)
			return
		}

		log.Printf("Successfully deleted existing file/folder: %s", filePath)
	}

	// Create directory structure if needed
	dirPath := filepath.Dir(filePath)
	if err := os.MkdirAll(dirPath, os.ModePerm); err != nil {
		log.Printf("Failed to create directory structure: %s, error: %v", dirPath, err)
		sendErrorResponse(w, "Failed to create directory structure: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Create the file
	dst, err := os.Create(filePath)
	if err != nil {
		log.Printf("Failed to create file: %s, error: %v", filePath, err)
		sendErrorResponse(w, "Failed to create file: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	// Copy the uploaded file to the destination file
	bytesWritten, err := io.Copy(dst, file)
	if err != nil {
		log.Printf("Failed to save file: %s, error: %v", filePath, err)
		sendErrorResponse(w, "Failed to save file: "+err.Error(), http.StatusInternalServerError)
		return
	}

	log.Printf("Successfully uploaded file: %s, size: %d bytes", filePath, bytesWritten)

	// Return success response
	w.Header().Set("Content-Type", "application/json")

	// Use the path if it exists, otherwise use the filename
	filename := filepath.Base(filePath)
	downloadPath := "/download/" + filename
	if path != "" {
		downloadPath = "/download/" + path
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":  "File uploaded successfully",
		"filename": filename,
		"url":      downloadPath,
		"path":     path,
		"baseURL":  config.BaseURL,
	})
}

func listFilesHandler(w http.ResponseWriter, r *http.Request, config Config) {
	var fileInfos []FileInfo

	// Check if uploads directory exists
	if _, err := os.Stat("static/uploads"); os.IsNotExist(err) {
		// If directory doesn't exist, return empty list
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(fileInfos)
		return
	}

	// Walk through the uploads directory recursively
	err := filepath.WalkDir("static/uploads", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// Skip directories
		if d.IsDir() {
			return nil
		}

		// Get file info
		fileInfo, err := d.Info()
		if err != nil {
			return nil
		}

		// Get relative path from uploads directory
		relPath, err := filepath.Rel("static/uploads", path)
		if err != nil {
			return nil
		}

		fileInfos = append(fileInfos, FileInfo{
			Name:       d.Name(),
			Size:       fileInfo.Size(),
			URL:        "/download/" + relPath,
			Path:       relPath,
			UploadedAt: fileInfo.ModTime(),
		})

		return nil
	})

	if err != nil {
		sendErrorResponse(w, "Failed to list files: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(fileInfos)
}

// downloadZipHandler creates a zip file from a directory and serves it
func downloadZipHandler(w http.ResponseWriter, r *http.Request) {
	// Extract the folder name from the URL
	u, err := url.Parse(r.URL.String())
	if err != nil {
		sendErrorResponse(w, "Invalid URL", http.StatusBadRequest)
		return
	}

	// Get the folder name from the path
	path := u.Path
	parts := strings.Split(path, "/download-zip/")
	if len(parts) < 2 {
		sendErrorResponse(w, "Folder not specified", http.StatusBadRequest)
		return
	}

	folderName := parts[1]
	if folderName == "" {
		sendErrorResponse(w, "Folder not specified", http.StatusBadRequest)
		return
	}

	// Check if folder exists
	folderPath := filepath.Join("static/uploads", folderName)
	if _, err := os.Stat(folderPath); os.IsNotExist(err) {
		sendErrorResponse(w, "Folder not found", http.StatusNotFound)
		return
	}

	// Set the content type and headers for zip file
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.zip\"", folderName))

	// Create a new zip writer
	zipWriter := zip.NewWriter(w)
	defer zipWriter.Close()

	// Walk through the folder and add files to the zip
	err = filepath.WalkDir(folderPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// Skip directories in the zip file
		if d.IsDir() {
			return nil
		}

		// Get relative path from the folder
		relPath, err := filepath.Rel(folderPath, path)
		if err != nil {
			return err
		}

		// Create a new file in the zip
		zipFile, err := zipWriter.Create(relPath)
		if err != nil {
			return err
		}

		// Open the source file
		srcFile, err := os.Open(path)
		if err != nil {
			return err
		}
		defer srcFile.Close()

		// Copy the file content to the zip
		_, err = io.Copy(zipFile, srcFile)
		return err
	})

	if err != nil {
		sendErrorResponse(w, "Failed to create zip file: "+err.Error(), http.StatusInternalServerError)
		return
	}
}

func deleteHandler(w http.ResponseWriter, r *http.Request) {
	// Only allow DELETE method
	if r.Method != http.MethodDelete {
		sendErrorResponse(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract the base path from the URL
	u, err := url.Parse(r.URL.String())
	if err != nil {
		sendErrorResponse(w, "Invalid URL", http.StatusBadRequest)
		return
	}

	// Get the file path from the URL
	path := u.Path
	parts := strings.Split(path, "/delete/")
	if len(parts) < 2 {
		sendErrorResponse(w, "File not specified", http.StatusBadRequest)
		return
	}

	filePath := parts[1]
	if filePath == "" {
		sendErrorResponse(w, "File not specified", http.StatusBadRequest)
		return
	}

	// Construct the full path to the file
	fullPath := filepath.Join("static/uploads", filePath)

	// Check if file exists
	fileInfo, err := os.Stat(fullPath)
	if os.IsNotExist(err) {
		sendErrorResponse(w, "File not found", http.StatusNotFound)
		return
	}

	// Check if it's a directory
	if fileInfo.IsDir() {
		// Delete the directory and all its contents
		err = os.RemoveAll(fullPath)
	} else {
		// Delete the file
		err = os.Remove(fullPath)
	}

	if err != nil {
		sendErrorResponse(w, "Failed to delete: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Successfully deleted",
		"path":    filePath,
	})
}

func downloadHandler(w http.ResponseWriter, r *http.Request) {
	// Extract the base path from the URL
	u, err := url.Parse(r.URL.String())
	if err != nil {
		sendErrorResponse(w, "Invalid URL", http.StatusBadRequest)
		return
	}

	// Get the file path from the URL
	path := u.Path
	parts := strings.Split(path, "/download/")
	if len(parts) < 2 {
		sendErrorResponse(w, "File not specified", http.StatusBadRequest)
		return
	}

	filePath := parts[1]
	if filePath == "" {
		sendErrorResponse(w, "File not specified", http.StatusBadRequest)
		return
	}

	// Construct the full path to the file
	fullPath := filepath.Join("static/uploads", filePath)

	// Check if file exists
	_, statErr := os.Stat(fullPath)
	if os.IsNotExist(statErr) {
		sendErrorResponse(w, "File not found", http.StatusNotFound)
		return
	}

	// Set the content disposition header to suggest a filename for download
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filepath.Base(filePath)))

	// Serve the file
	http.ServeFile(w, r, fullPath)
}
