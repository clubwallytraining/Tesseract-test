const startBtn = document.getElementById('start');
const cameraSelect = document.getElementById('cameraSelect');
const resolutionSelect = document.getElementById('resolutionSelect');
const cameraContainer = document.getElementById('cameraContainer');
const cameraControls = document.getElementById('cameraControls');
const camera = document.getElementById('camera');
const roiElement = document.getElementById('roi');
const output = document.getElementById('output');

let stream = null;
let processing = false;

// Start Scanner Button
startBtn.addEventListener('click', async () => {
    try {
        // Request camera permissions
        await navigator.mediaDevices.getUserMedia({ video: true });

        // Populate camera options after permissions are granted
        await populateCameraOptions();

        // Display camera controls and video container
        cameraControls.style.display = 'flex';
        cameraContainer.style.display = 'block';
        output.style.display = 'block';

        // Initialize scanner
        initializeScanner();
    } catch (err) {
        alert("Camera permissions are required to use this scanner.");
    }
});

// Populate camera options
async function populateCameraOptions() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    if (videoDevices.length === 0) {
        alert("No camera devices found.");
        return;
    }

    cameraSelect.innerHTML = videoDevices.map((device, index) =>
        `<option value="${device.deviceId}">${device.label || `Camera ${index + 1}`}</option>`
    ).join('');
}

// Initialize the scanner
async function initializeScanner() {
    const deviceId = cameraSelect.value || cameraSelect.options[0].value;
    const resolution = resolutionSelect.value.split('x');

    if (stream) {
        stopStream();
    }

    stream = await navigator.mediaDevices.getUserMedia({
        video: {
            deviceId: { exact: deviceId },
            width: { ideal: parseInt(resolution[0]) },
            height: { ideal: parseInt(resolution[1]) },
            frameRate: { ideal: 30 }
        }
    });

    camera.srcObject = stream;

    camera.onloadedmetadata = () => {
        camera.play();
        startProcessing();
    };
}

// Stop current video stream
function stopStream() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

// Update video feed dynamically on option changes
cameraSelect.addEventListener('change', initializeScanner);
resolutionSelect.addEventListener('change', initializeScanner);

// Start processing text in the ROI
function startProcessing() {
    processing = true;

    function processFrame() {
        if (!processing) return;

        const roiBounds = roiElement.getBoundingClientRect();
        const cameraBounds = camera.getBoundingClientRect();

        const scaleX = camera.videoWidth / cameraBounds.width;
        const scaleY = camera.videoHeight / cameraBounds.height;

        const sx = (roiBounds.left - cameraBounds.left) * scaleX;
        const sy = (roiBounds.top - cameraBounds.top) * scaleY;
        const sWidth = roiBounds.width * scaleX;
        const sHeight = roiBounds.height * scaleY;

        const canvas = document.createElement('canvas');
        canvas.width = sWidth;
        canvas.height = sHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(camera, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

        Tesseract.recognize(canvas, 'eng')
            .then(({ data: { text } }) => {
                if (text.trim()) {
                    roiElement.style.borderColor = 'green'; // Turn ROI green
                    output.textContent = text.trim(); // Show text in output
                } else {
                    roiElement.style.borderColor = 'red'; // Reset ROI to red
                }
            })
            .catch(err => {
                roiElement.style.borderColor = 'red';
                output.textContent = '';
            });

        requestAnimationFrame(processFrame);
    }

    processFrame();
}
