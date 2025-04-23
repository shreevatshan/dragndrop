document.addEventListener('DOMContentLoaded', function() {
    // Tab switching functionality
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all buttons and panes
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            // Add active class to clicked button and corresponding pane
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            
            // If download tab is selected, load the file list
            if (tabId === 'download') {
                loadFileList();
            }
        });
    });
    
    // File upload functionality
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('fileInput');
    const folderInput = document.getElementById('folderInput');
    const uploadList = document.getElementById('uploadList');
    const uploadProgress = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropArea.classList.add('highlight');
    }
    
    function unhighlight() {
        dropArea.classList.remove('highlight');
    }
    
    // Handle dropped files
    dropArea.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        // Check if this is a folder drop by looking at the items
        let isFolder = false;
        
        // If dataTransfer.items is available, we can check if any item is a directory
        if (dt.items && dt.items.length > 0) {
            for (let i = 0; i < dt.items.length; i++) {
                // Try to get the entry (Chrome and Firefox support this)
                const entry = dt.items[i].webkitGetAsEntry && dt.items[i].webkitGetAsEntry();
                if (entry && entry.isDirectory) {
                    isFolder = true;
                    break;
                }
            }
        }
        
        // If we couldn't determine if it's a folder, check if any file has a path separator
        if (!isFolder && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                if (files[i].name.includes('/') || files[i].name.includes('\\')) {
                    isFolder = true;
                    break;
                }
            }
        }
        
        // If it's a folder, show a warning message
        if (isFolder) {
            showToast('Please use the "Choose Folder" button for folder uploads', true);
            return;
        }
        
        // Only handle files, not folders
        handleFiles(files, false);
    }
    
    // Handle selected files from file input
    fileInput.addEventListener('change', function() {
        handleFiles(this.files, false);
    });
    
    // Handle selected folders from folder input
    folderInput.addEventListener('change', function() {
        handleFiles(this.files, true);
    });
    
    // Initialize toggle button for upload list
    const toggleUploadListBtn = document.getElementById('toggleUploadList');
    toggleUploadListBtn.addEventListener('click', function() {
        const uploadList = document.getElementById('uploadList');
        uploadList.classList.toggle('collapsed');
        this.classList.toggle('collapsed');
        this.textContent = uploadList.classList.contains('collapsed') ? '►' : '▼';
    });
    
    // File counter elements
    const pendingCountEl = document.getElementById('pendingCount');
    const successCountEl = document.getElementById('successCount');
    const failedCountEl = document.getElementById('failedCount');
    
    // File counters
    let fileCounters = {
        pending: 0,
        success: 0,
        failed: 0
    };
    
    // Update file counters
    function updateFileCounters() {
        pendingCountEl.textContent = fileCounters.pending;
        successCountEl.textContent = fileCounters.success;
        failedCountEl.textContent = fileCounters.failed;
    }
    
    function handleFiles(files, isFolder) {
        // Clear the upload list and reset counters
        uploadList.innerHTML = '';
        
        // Log the total number of files
        console.log(`Total files to upload: ${files.length}`);
        
        fileCounters = {
            pending: files.length,
            success: 0,
            failed: 0
        };
        updateFileCounters();
        
        // Display each file in the upload list with pending status
        Array.from(files).forEach(file => {
            const li = document.createElement('li');
            li.id = `file-${file.name.replace(/[^a-zA-Z0-9]/g, '-')}`;
            
            const fileInfo = document.createElement('div');
            const path = isFolder ? file.webkitRelativePath : file.name;
            fileInfo.textContent = `${path} (${formatFileSize(file.size)})`;
            
            const fileStatus = document.createElement('span');
            fileStatus.className = 'file-status pending';
            fileStatus.textContent = 'Pending';
            
            li.appendChild(fileInfo);
            li.appendChild(fileStatus);
            uploadList.appendChild(li);
        });
        
        // Upload the files
        uploadFiles(files, isFolder);
    }
    
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    function uploadFiles(files, isFolder) {
        // Show progress bar
        uploadProgress.style.display = 'block';
        progressFill.style.width = '0%';
        progressText.textContent = 'Preparing upload...';
        
        // Create FormData object
        const formData = new FormData();
        
        // Upload one file at a time for simplicity
        // In a real app, you might want to handle multiple files
        if (files.length > 0) {
            const file = files[0];
            formData.append('file', file);
            
            // If it's a folder upload, add the path information
            if (isFolder) {
                // If webkitRelativePath is available, use it
                if (file.webkitRelativePath) {
                    formData.append('path', file.webkitRelativePath);
                } else {
                    // For drag and drop folders, we need to create a path
                    // Use the file name as the path since it's likely to contain folder structure
                    // for drag and dropped folders
                    formData.append('path', file.name);
                    console.log('Using file name as path for drag and drop folder:', file.name);
                }
            }
            
            // Update file status to uploading
            const fileId = `file-${file.name.replace(/[^a-zA-Z0-9]/g, '-')}`;
            const fileItem = document.getElementById(fileId);
            if (fileItem) {
                const statusElement = fileItem.querySelector('.file-status');
                if (statusElement) {
                    statusElement.className = 'file-status uploading';
                    statusElement.textContent = 'Uploading...';
                }
            }
            
            // Update counters
            fileCounters.pending--;
            updateFileCounters();
            
            // Send the file to the server
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', function(e) {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    const loadedSize = formatFileSize(e.loaded);
                    const totalSize = formatFileSize(e.total);
                    
                    progressFill.style.width = percentComplete + '%';
                    progressText.textContent = `Uploading: ${loadedSize} of ${totalSize} (${Math.round(percentComplete)}%)`;
                    
                    // Update file status with progress
                    if (fileItem) {
                        const statusElement = fileItem.querySelector('.file-status');
                        if (statusElement) {
                            statusElement.textContent = `${Math.round(percentComplete)}%`;
                        }
                    }
                }
            });
            
            xhr.addEventListener('load', function() {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    progressText.textContent = 'Upload complete!';
                    
                    // Update file status to success
                    if (fileItem) {
                        const statusElement = fileItem.querySelector('.file-status');
                        if (statusElement) {
                            statusElement.className = 'file-status success';
                            statusElement.textContent = 'Success';
                        }
                    }
                    
                    // Update counters
                    fileCounters.success++;
                    updateFileCounters();
                    
                    // Log success
                    console.log(`Successfully uploaded file: ${file.name}`);
                    console.log(`Progress: ${fileCounters.success + fileCounters.failed}/${files.length} files processed`);
                    
                    // If there are more files, upload the next one
                    if (files.length > 1) {
                        // Use setTimeout to give the browser a chance to update the UI
                        setTimeout(() => {
                            uploadFiles(Array.from(files).slice(1), isFolder);
                        }, 10);
                    } else {
                        // All files have been processed, hide progress bar after a delay
                        setTimeout(() => {
                            uploadProgress.style.display = 'none';
                            progressText.textContent = '';
                            progressFill.style.width = '0%';
                            
                            // Final check to ensure all files have been updated in the UI
                            const pendingItems = document.querySelectorAll('.file-status.pending');
                            pendingItems.forEach(item => {
                                item.className = 'file-status success';
                                item.textContent = 'Success';
                            });
                            
                            // Update counters one last time
                            fileCounters.success += fileCounters.pending;
                            fileCounters.pending = 0;
                            updateFileCounters();
                            
                            console.log('Upload complete. Final counts:', fileCounters);
                        }, 2000);
                    }
                } else {
                    // Try to parse error message from response
                    let errorMessage;
                    try {
                        const errorResponse = JSON.parse(xhr.responseText);
                        errorMessage = errorResponse.error || xhr.statusText;
                    } catch (e) {
                        // If we can't parse the response, just show the status
                        errorMessage = xhr.statusText || 'Error ' + xhr.status;
                    }
                    
                    progressText.textContent = `Upload failed: ${errorMessage}`;
                    progressText.style.color = 'red';
                    
                    // Update file status to error
                    if (fileItem) {
                        const statusElement = fileItem.querySelector('.file-status');
                        if (statusElement) {
                            statusElement.className = 'file-status error';
                            statusElement.textContent = 'Failed';
                            statusElement.title = errorMessage;
                        }
                    }
                    
                    // Update counters
                    fileCounters.failed++;
                    updateFileCounters();
                    
                    // Log failure
                    console.log(`Failed to upload file: ${file.name}, Error: ${errorMessage}`);
                    console.log(`Progress: ${fileCounters.success + fileCounters.failed}/${files.length} files processed`);
                    
                    // Reset progress bar after a delay
                    setTimeout(() => {
                        progressText.style.color = '';
                        uploadProgress.style.display = 'none';
                    }, 5000);
                }
            });
            
            xhr.addEventListener('error', function(e) {
                progressText.textContent = `Upload failed: Network error`;
                progressText.style.color = 'red';
                
                // Update file status to error
                if (fileItem) {
                    const statusElement = fileItem.querySelector('.file-status');
                    if (statusElement) {
                        statusElement.className = 'file-status error';
                        statusElement.textContent = 'Failed';
                        statusElement.title = 'Network error';
                    }
                }
                
                // Update counters
                fileCounters.failed++;
                updateFileCounters();
                
                // Log network error
                console.log(`Network error while uploading file: ${file.name}`);
                console.log(`Progress: ${fileCounters.success + fileCounters.failed}/${files.length} files processed`);
                
                // Reset progress bar after a delay
                setTimeout(() => {
                    progressText.style.color = '';
                    uploadProgress.style.display = 'none';
                }, 5000);
            });
            
            // Use the base URL if available
            const baseURL = window.baseURL || '';
            xhr.open('POST', baseURL + '/upload');
            xhr.send(formData);
        }
    }
    
    // Function to delete a file or folder
    function deleteFile(path) {
        // Use the base URL if available
        const baseURL = window.baseURL || '';
        const url = baseURL + '/delete/' + path;
        
        fetch(url, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to delete file');
            }
            return response.json();
        })
        .then(data => {
            // Show success toast
            showToast('File deleted successfully');
            
            // Reload the file list
            loadFileList();
        })
        .catch(error => {
            console.error('Error deleting file:', error);
            showToast('Failed to delete file', true);
        });
    }
    
    // File list functionality
    function loadFileList() {
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '<p class="loading-text">Loading files...</p>';
        
        // Use the base URL if available
        const baseURL = window.baseURL || '';
        fetch(baseURL + '/files')
            .then(response => response.json())
            .then(files => {
                if (files.length === 0) {
                    fileList.innerHTML = '<p class="loading-text">No files available</p>';
                    return;
                }
                
                fileList.innerHTML = '';
                
                // Group files by top-level directory
                const filesByTopDir = {};
                const rootFiles = [];
                
                files.forEach(file => {
                    if (file.path && file.path.includes('/')) {
                        // This is a file in a directory
                        // Get the top-level directory name
                        const topDirName = file.path.split('/')[0];
                        
                        if (!filesByTopDir[topDirName]) {
                            filesByTopDir[topDirName] = [];
                        }
                        filesByTopDir[topDirName].push(file);
                    } else {
                        // This is a root file
                        rootFiles.push(file);
                    }
                });
                
                // First add directories
                Object.keys(filesByTopDir).forEach(dirName => {
                    const dirFiles = filesByTopDir[dirName];
                    
                    const fileItem = document.createElement('div');
                    fileItem.className = 'file-item';
                    
                    const fileInfo = document.createElement('div');
                    fileInfo.className = 'file-info';
                    
                    const fileName = document.createElement('div');
                    fileName.className = 'file-name';
                    fileName.textContent = dirName + ' (folder)';
                    
                    const fileMeta = document.createElement('div');
                    fileMeta.className = 'file-meta';
                    fileMeta.textContent = `${dirFiles.length} files`;
                    
                    fileInfo.appendChild(fileName);
                    fileInfo.appendChild(fileMeta);
                    
                    const fileActions = document.createElement('div');
                    fileActions.className = 'file-actions';
                    
                    // Download as zip button
                    const downloadZipBtn = document.createElement('a');
                    downloadZipBtn.className = 'btn btn-download';
                    downloadZipBtn.textContent = 'Download';
                    // Use the base URL if available
                    const baseURL = window.baseURL || '';
                    const zipUrl = '/download-zip/' + dirName;
                    downloadZipBtn.href = baseURL + zipUrl;
                    downloadZipBtn.setAttribute('download', '');
                    
                    // Copy URL button for folder
                    const copyBtn = document.createElement('button');
                    copyBtn.className = 'btn btn-copy';
                    copyBtn.textContent = 'Copy URL';
                    copyBtn.addEventListener('click', function() {
                        // Use the base URL if available
                        const baseURL = window.baseURL || window.location.origin;
                        const url = baseURL + zipUrl;
                        
                        // Create a temporary input element
                        const tempInput = document.createElement('input');
                        tempInput.value = url;
                        document.body.appendChild(tempInput);
                        
                        // Select the text and copy it
                        tempInput.select();
                        document.execCommand('copy');
                        
                        // Remove the temporary element
                        document.body.removeChild(tempInput);
                        
                        // Show toast notification
                        showToast('Link copied to clipboard!');
                    });
                    
                    // Delete button for folder
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'btn btn-delete';
                    deleteBtn.textContent = 'Delete';
                    deleteBtn.addEventListener('click', function() {
                        if (confirm(`Are you sure you want to delete the folder "${dirName}" and all its contents?`)) {
                            deleteFile(dirName);
                        }
                    });
                    
                    fileActions.appendChild(downloadZipBtn);
                    fileActions.appendChild(copyBtn);
                    fileActions.appendChild(deleteBtn);
                    
                    fileItem.appendChild(fileInfo);
                    fileItem.appendChild(fileActions);
                    
                    fileList.appendChild(fileItem);
                });
                
                // Then add individual files
                rootFiles.forEach(file => {
                    const fileItem = document.createElement('div');
                    fileItem.className = 'file-item';
                    
                    const fileInfo = document.createElement('div');
                    fileInfo.className = 'file-info';
                    
                    const fileName = document.createElement('div');
                    fileName.className = 'file-name';
                    fileName.textContent = file.name;
                    
                    const fileMeta = document.createElement('div');
                    fileMeta.className = 'file-meta';
                    fileMeta.textContent = `${formatFileSize(file.size)} • ${formatDate(file.uploadedAt)}`;
                    
                    fileInfo.appendChild(fileName);
                    fileInfo.appendChild(fileMeta);
                    
                    const fileActions = document.createElement('div');
                    fileActions.className = 'file-actions';
                    
                    const downloadBtn = document.createElement('a');
                    downloadBtn.className = 'btn btn-download';
                    downloadBtn.textContent = 'Download';
                    // Use the base URL if available
                    const baseURL = window.baseURL || '';
                    // Ensure we don't double up on slashes
                    const fileUrl = file.url.startsWith('/') ? file.url : '/' + file.url;
                    downloadBtn.href = baseURL + fileUrl;
                    downloadBtn.setAttribute('download', '');
                    
                    const copyBtn = document.createElement('button');
                    copyBtn.className = 'btn btn-copy';
                    copyBtn.textContent = 'Copy URL';
                    copyBtn.addEventListener('click', function() {
                        // Use the base URL if available
                        const baseURL = window.baseURL || window.location.origin;
                        // Ensure we don't double up on slashes
                        const fileUrl = file.url.startsWith('/') ? file.url : '/' + file.url;
                        const url = baseURL + fileUrl;
                        
                        // Create a temporary input element
                        const tempInput = document.createElement('input');
                        tempInput.value = url;
                        document.body.appendChild(tempInput);
                        
                        // Select the text and copy it
                        tempInput.select();
                        document.execCommand('copy');
                        
                        // Remove the temporary element
                        document.body.removeChild(tempInput);
                        
                        // Show toast notification
                        showToast('Link copied to clipboard!');
                    });
                    
                    // Delete button for file
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'btn btn-delete';
                    deleteBtn.textContent = 'Delete';
                    deleteBtn.addEventListener('click', function() {
                        if (confirm(`Are you sure you want to delete "${file.name}"?`)) {
                            // Extract the path from the URL
                            const path = file.path || file.name;
                            deleteFile(path);
                        }
                    });
                    
                    fileActions.appendChild(downloadBtn);
                    fileActions.appendChild(copyBtn);
                    fileActions.appendChild(deleteBtn);
                    
                    fileItem.appendChild(fileInfo);
                    fileItem.appendChild(fileActions);
                    
                    fileList.appendChild(fileItem);
                });
            })
            .catch(error => {
                console.error('Error loading files:', error);
                fileList.innerHTML = '<p class="loading-text">Error loading files</p>';
            });
    }
    
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }
    
    // Toast notification
    function showToast(message = 'Link copied to clipboard!', isError = false) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        
        if (isError) {
            toast.style.backgroundColor = '#e74c3c';
        } else {
            toast.style.backgroundColor = '#2ecc71';
        }
        
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    
    // Create upload icon SVG
    createUploadIcon();
});

// Fallback function to copy text to clipboard
function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Make the textarea out of viewport
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
    } catch (err) {
        console.error('Fallback: Unable to copy', err);
    }
    
    document.body.removeChild(textArea);
}

// Function to create the upload icon SVG
function createUploadIcon() {
    // Create a simple upload icon using SVG
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "64");
    svg.setAttribute("height", "64");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "#3498db");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    
    // Create the arrow up path
    const arrowPath = document.createElementNS(svgNS, "path");
    arrowPath.setAttribute("d", "M12 15V3m0 0L6 9m6-6l6 6");
    
    // Create the line at the bottom
    const linePath = document.createElementNS(svgNS, "path");
    linePath.setAttribute("d", "M3 21h18");
    
    svg.appendChild(arrowPath);
    svg.appendChild(linePath);
    
    // Convert SVG to a data URL
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const svgURL = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    
    // Set the upload icon src
    const uploadIcon = document.querySelector('.upload-icon');
    if (uploadIcon) {
        // Use the base URL if available
        const baseURL = window.baseURL || '';
        uploadIcon.src = svgURL;
    }
}
