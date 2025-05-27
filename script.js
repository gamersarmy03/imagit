// --- DOM Elements ---
const uploadButton = document.getElementById('uploadButton');
const uploadModal = document.getElementById('uploadModal');
const closeButton = document.querySelector('.close-button');
const uploadForm = document.getElementById('uploadForm');
const imageTitleInput = document.getElementById('imageTitle');
const imageFilesInput = document.getElementById('imageFiles');
const fileListDisplay = document.getElementById('fileList');
const submitButton = uploadForm.querySelector('.submit-button');
const uploadProgressContainer = document.getElementById('uploadProgress');
const progressBar = uploadProgressContainer.querySelector('.progress-bar');
const uploadStatus = document.getElementById('uploadStatus');
const imageGallery = document.getElementById('gallery');
const galleryPlaceholder = document.querySelector('.gallery-placeholder');

// --- Event Listeners ---
uploadButton.addEventListener('click', () => {
    uploadModal.style.display = 'flex'; // Show modal
});

closeButton.addEventListener('click', () => {
    uploadModal.style.display = 'none'; // Hide modal
    resetUploadForm();
});

// Close modal when clicking outside of it
window.addEventListener('click', (event) => {
    if (event.target === uploadModal) {
        uploadModal.style.display = 'none';
        resetUploadForm();
    }
});

imageFilesInput.addEventListener('change', () => {
    displaySelectedFiles(imageFilesInput.files);
});

uploadForm.addEventListener('submit', (event) => {
    event.preventDefault(); // Prevent default form submission
    handleUpload();
});

// --- Functions ---

function displaySelectedFiles(files) {
    fileListDisplay.innerHTML = ''; // Clear previous list
    if (files.length === 0) {
        fileListDisplay.innerHTML = '<p>No files selected.</p>';
        return;
    }

    const fileNames = Array.from(files).map(file => file.name);
    fileNames.forEach(name => {
        const p = document.createElement('p');
        p.textContent = name;
        fileListDisplay.appendChild(p);
    });
}

function resetUploadForm() {
    uploadForm.reset();
    fileListDisplay.innerHTML = '<p>No files selected.</p>';
    uploadStatus.textContent = '';
    progressBar.style.width = '0%';
    uploadProgressContainer.style.display = 'none';
    submitButton.disabled = false;
    submitButton.textContent = 'Upload Now';
}

async function handleUpload() {
    const files = imageFilesInput.files;
    const title = imageTitleInput.value.trim();

    if (files.length === 0) {
        uploadStatus.textContent = 'Please select at least one image.';
        uploadStatus.style.color = '#ff6347'; // Tomato red for error
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Uploading...';
    uploadStatus.textContent = 'Preparing files for upload...';
    uploadStatus.style.color = '#ffcc00'; // Gold for pending
    uploadProgressContainer.style.display = 'block';
    progressBar.style.width = '0%';

    const formData = new FormData();
    formData.append('title', title);
    for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]); // 'images' is the key your backend will expect for file array
    }

    try {
        // --- IMPORTANT: This is where you would make an API call to your backend ---
        // Your backend server will:
        // 1. Receive the files and title.
        // 2. Upload files to Internet Archive S3 using your access keys.
        // 3. Get the public URLs and identifiers from Internet Archive.
        // 4. Save metadata (title, identifier, URL, mediaType, createdAt) to Appwrite.
        // 5. Return success/failure and potentially the data of uploaded items.

        // Placeholder for API call
        const response = await fetch('/api/upload', { // Replace with your actual backend endpoint
            method: 'POST',
            body: formData,
            // You might need to set headers like 'Authorization' if you have user authentication
            // headers: {
            //     'Authorization': `Bearer ${yourAuthToken}`
            // }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Upload failed due to a server error.');
        }

        const result = await response.json();
        console.log('Upload successful:', result);

        uploadStatus.textContent = 'Upload successful!';
        uploadStatus.style.color = '#28a745'; // Green for success
        progressBar.style.width = '100%';

        // Assuming your backend returns an array of uploaded image data
        if (result.uploadedImages && result.uploadedImages.length > 0) {
            result.uploadedImages.forEach(image => addImageToGallery(image));
            galleryPlaceholder.style.display = 'none'; // Hide placeholder if images are loaded
        }

        setTimeout(() => {
            uploadModal.style.display = 'none';
            resetUploadForm();
        }, 2000); // Close modal after 2 seconds
        
    } catch (error) {
        console.error('Upload error:', error);
        uploadStatus.textContent = `Upload failed: ${error.message}`;
        uploadStatus.style.color = '#dc3545'; // Red for error
        progressBar.style.width = '0%'; // Reset progress bar on error
        submitButton.disabled = false;
        submitButton.textContent = 'Try Again';
    }
}

// Function to dynamically add images to the gallery
function addImageToGallery(imageData) {
    const galleryItem = document.createElement('div');
    galleryItem.classList.add('gallery-item');

    // Default image if no valid URL is provided or if it's not an image
    const imageUrl = imageData.url || 'https://via.placeholder.com/300x250?text=No+Image';

    galleryItem.innerHTML = `
        <img src="${imageUrl}" alt="${imageData.title || 'Uploaded Image'}">
        <div class="gallery-item-info">
            <h3>${imageData.title || 'Untitled Album/Image'}</h3>
            <p>Identifier: ${imageData.identifier || 'N/A'}</p>
            <p>Uploaded: ${new Date(imageData.createdAt).toLocaleString()}</p>
            <a href="${imageUrl}" target="_blank">View Original</a>
        </div>
    `;
    imageGallery.prepend(galleryItem); // Add to the beginning of the gallery
}


// --- Initial Load: Fetch existing images from Appwrite (via your backend) ---
async function loadImages() {
    try {
        // Your backend would fetch data from Appwrite's 'uploads112233' collection
        // and return it to the frontend.
        const response = await fetch('/api/images'); // Replace with your actual backend endpoint
        if (!response.ok) {
            throw new Error('Failed to fetch images.');
        }
        const { images } = await response.json(); // Assuming backend returns { images: [...] }

        if (images && images.length > 0) {
            galleryPlaceholder.style.display = 'none'; // Hide placeholder
            images.forEach(image => addImageToGallery(image));
        } else {
            galleryPlaceholder.style.display = 'block'; // Show placeholder if no images
        }

    } catch (error) {
        console.error('Error loading images:', error);
        imageGallery.innerHTML = '<p class="status-message" style="color: #dc3545;">Failed to load images. Please try again later.</p>';
        galleryPlaceholder.style.display = 'none'; // Hide placeholder as we have an error message
    }
}

// Load images when the page loads
document.addEventListener('DOMContentLoaded', loadImages);
