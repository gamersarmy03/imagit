// server.js
const express = require('express');
const multer = require('multer');
const { Client, Databases, Query } = require('node-appwrite'); // Added Query
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid'); // For generating unique identifiers
const cors = require('cors'); // Import CORS middleware

const app = express();
const port = process.env.PORT || 3000; // Use environment port or default to 3000

// --- Configure CORS ---
// Adjust this based on your frontend's actual origin.
// For local development, you might allow all: app.use(cors());
// For production, specify your frontend domain:
const corsOptions = {
    origin: 'http://localhost:8000', // Example if your home.html is served from a simple HTTP server on port 8000
    // Or if you open home.html directly in browser (file://), you might need to allow null origin
    // origin: ['http://localhost:8000', null], // Allows for file:// access in some browsers
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204 // Some legacy browsers (IE11, various SmartTVs) choke on 200
};
app.use(cors(corsOptions));


// Multer storage configuration for handling file uploads
// Using memory storage for simplicity, but for large files, diskStorage is better
const upload = multer({ storage: multer.memoryStorage() });

// Appwrite setup
// IMPORTANT: Replace 'YOUR_APPWRITE_ENDPOINT' and 'YOUR_APPWRITE_API_KEY'
const appwriteClient = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1') // Your Appwrite endpoint
    .setProject('imagit112233')
    .setKey('YOUR_APPWRITE_API_KEY'); // Your Appwrite API key - KEEP THIS SECRET!

const databases = new Databases(appwriteClient);

const DATABASE_ID = 'uploads1122';
const COLLECTION_ID = 'uploads112233';

// Internet Archive S3 setup
const iaS3Client = new S3Client({
    endpoint: 'https://s3.us.archive.org',
    region: 'us-east-1', // Required but can be arbitrary for IA
    credentials: {
        accessKeyId: 'jBR7XOg62J8mIUEg',
        secretAccessKey: 'pPzeXleaI98sZLhe',
    },
    forcePathStyle: true, // Needed for Internet Archive
});

app.use(express.json()); // For parsing JSON request bodies

// --- Upload Endpoint ---
app.post('/api/upload', upload.array('images'), async (req, res) => {
    console.log('Received upload request.');
    try {
        const { title } = req.body;
        const files = req.files; // Array of files from multer

        if (!files || files.length === 0) {
            console.warn('Upload Error: No files received.');
            return res.status(400).json({ message: 'No files uploaded. Please select at least one image.' });
        }
        console.log(`Received ${files.length} files. Title: ${title || 'No Title'}`);

        const uploadedImagesData = [];

        for (const file of files) {
            try {
                const identifier = `imagit-${uuidv4()}`; // Unique identifier for IA item
                const fileExtension = file.originalname.split('.').pop();
                const iaFileName = `${uuidv4()}.${fileExtension}`; // Unique filename within the IA item
                const iaObjectKey = `${identifier}/${iaFileName}`; // Path for IA object

                console.log(`Processing file: ${file.originalname}, Identifier: ${identifier}, IA Key: ${iaObjectKey}`);

                // --- Upload to Internet Archive S3 ---
                const iaUploadParams = {
                    Bucket: identifier, // IA uses identifier as bucket name
                    Key: iaFileName, // Name of the file inside the IA item
                    Body: file.buffer, // Use file buffer from multer
                    ContentType: file.mimetype,
                    ACL: 'public-read', // Make it publicly readable
                };

                console.log(`Attempting S3 upload for ${iaObjectKey}...`);
                await iaS3Client.send(new PutObjectCommand(iaUploadParams));
                console.log(`Successfully uploaded ${iaObjectKey} to Internet Archive.`);

                const imageUrl = `https://archive.org/download/${identifier}/${iaFileName}`; // Correct URL format for IA
                const mediaType = file.mimetype;
                const createdAt = new Date().toISOString();

                // --- Save metadata to Appwrite ---
                console.log(`Attempting to save metadata to Appwrite for ${file.originalname}...`);
                const document = await databases.createDocument(
                    DATABASE_ID,
                    COLLECTION_ID,
                    'unique()', // Let Appwrite generate ID for the document
                    {
                        title: title || 'Untitled Album',
                        identifier,
                        url: imageUrl,
                        mediaType,
                        createdAt,
                    }
                );
                console.log(`Successfully saved metadata to Appwrite for ${file.originalname}. Document ID: ${document.$id}`);
                uploadedImagesData.push(document);

            } catch (innerError) {
                console.error(`Error processing individual file ${file.originalname}:`, innerError);
                // If one file fails, you might want to return an error for the whole batch
                // or just log and continue. For robustness, we'll return an error.
                return res.status(500).json({
                    message: `Failed to upload or save metadata for ${file.originalname}.`,
                    error: innerError.message,
                    originalFile: file.originalname
                });
            }
        }

        console.log('All files processed successfully. Sending response.');
        res.status(200).json({ message: 'Files uploaded successfully!', uploadedImages: uploadedImagesData });

    } catch (error) {
        console.error('Overall upload process error (caught at top level):', error);
        // Ensure that in case of any unhandled error in the try block, a JSON response is sent.
        res.status(500).json({ message: 'Internal server error during upload process.', error: error.message });
    }
});

// --- Fetch Images Endpoint ---
app.get('/api/images', async (req, res) => {
    console.log('Received request to fetch images.');
    try {
        // Fetch documents from Appwrite, sorted by createdAt in descending order
        const response = await databases.listDocuments(
            DATABASE_ID,
            COLLECTION_ID,
            [
                Query.orderDesc('createdAt'), // Order by creation date, newest first
                Query.limit(50) // Limit to, for example, 50 images
            ]
        );
        console.log(`Workspaceed ${response.documents.length} images from Appwrite.`);
        res.status(200).json({ images: response.documents });
    } catch (error) {
        console.error('Error fetching images from Appwrite:', error);
        res.status(500).json({ message: 'Failed to fetch images from the database.', error: error.message });
    }
});

// --- Serve static files ---
// Assuming your home.html is in a directory named 'public'
// If you're opening home.html directly via file://, this part isn't strictly necessary for the frontend.
// However, it's good practice for serving web apps.
app.use(express.static('public'));

// Catch-all for undefined routes
app.use((req, res) => {
    res.status(404).send('Not Found');
});


app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
    console.log(`Make sure your Appwrite endpoint and API key are correctly configured in server.js`);
});
