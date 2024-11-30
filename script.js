const camera = document.getElementById('camera');
const roiElement = document.getElementById('roi');
const startBtn = document.getElementById('start');
const output = document.getElementById('output');

let stream = null;
let processing = false;

// Start Scanner: Chain begins
startBtn.addEventListener('click', async () => {
    try {
        // Request camera permissions
        stream = await navigator.mediaDevices.getUserMedia({ video: true });

        // If permissions are granted, refresh the page to populate options
        location.reload();
    } catch (err) {
        alert("Camera permissions are required to use this scanner.");
    }
});

// Initialize the camera, start scanning, and detect text
async function initializeScanner() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    if (videoDevices.length === 0) {
        alert("No camera devices found.");
        return;
    }

    // Select the first available camera
    const defaultDeviceId = videoDevices[0].deviceId;

    // Set up the video stream
    stream = await navigator.mediaDevices.getUserMedia({
        video: {
            deviceId: { exact: defaultDeviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
        }
    });

    camera.srcObject = stream;

    camera.onloadedmetadata = () => {
        camera.play();
        startProcessing();
    };
}

// Start text processing
function startProcessing() {
    processing = true;

    function processFrame() {
        if (!processing) return;

        // Calculate ROI bounds relative to the video resolution
        const roiBounds = roiElement.getBoundingClientRect();
        const cameraBounds = camera.getBoundingClientRect();

        const scaleX = camera.videoWidth / cameraBounds.width;
        const scaleY = camera.videoHeight / cameraBounds.height;

        const sx = (roiBounds.left - cameraBounds.left) * scaleX;
        const sy = (roiBounds.top - cameraBounds.top) * scaleY;
        const sWidth = roiBounds.width * scaleX;
        const sHeight = roiBounds.height * scaleY;

        // Extract ROI frame
        const canvas = document.createElement('canvas');
        canvas.width = sWidth;
        canvas.height = sHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(camera, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

        // Process text in ROI
        Tesseract.recognize(canvas, 'eng')
            .then(({ data: { text } }) => {
                if (text.trim()) {
                    roiElement.style.borderColor = 'green'; // Turn ROI green
                    output.textContent = text.trim(); // Display text
                } else {
                    roiElement.style.borderColor = 'red'; // Reset ROI to red
                }
            })
            .catch(err => {
                console.error(err);
                roiElement.style.borderColor = 'red';
            });

        requestAnimationFrame(processFrame);
    }

    processFrame();
}

// Start the scanner when the page loads (if permissions are already granted)
if (navigator.mediaDevices && stream) {
    initializeScanner();
}
