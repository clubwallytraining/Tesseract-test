const cameraSelect = document.getElementById('cameraSelect');
const resolutionSelect = document.getElementById('resolutionSelect');
const camera = document.getElementById('camera');
const roiElement = document.getElementById('roi');
const domOverlay = document.getElementById('domOverlay');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const output = document.getElementById('output');
const testWindow = document.getElementById('testWindow');

let stream = null;
let processing = false;

// Get available video devices
async function getCameras() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    cameraSelect.innerHTML = videoDevices.map((device, index) =>
        `<option value="${device.deviceId}">${device.label || `Camera ${index + 1}`}</option>`
    ).join('');

    // Default to rear camera if available
    const rearCamera = videoDevices.find(device => device.label.toLowerCase().includes('back'));
    if (rearCamera) {
        cameraSelect.value = rearCamera.deviceId;
    }
}

// Start the camera stream
async function startCamera() {
    if (stream) stopCamera();

    const deviceId = cameraSelect.value;
    const resolution = resolutionSelect.value.split('x');

    stream = await navigator.mediaDevices.getUserMedia({
        video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { ideal: parseInt(resolution[0]) },
            height: { ideal: parseInt(resolution[1]) },
            frameRate: { ideal: 30 }
        }
    });

    camera.srcObject = stream;

    camera.onloadedmetadata = () => {
        camera.play();
        updateOverlay();
    };
}

// Stop the camera stream
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

// Update ROI and DOM overlay styling dynamically
function updateOverlay() {
    const cameraRect = camera.getBoundingClientRect();
    const roiRect = roiElement.getBoundingClientRect();

    domOverlay.style.top = `${roiElement.offsetTop}px`;
    domOverlay.style.left = `${roiElement.offsetLeft}px`;
    domOverlay.style.width = `${roiRect.width}px`;
    domOverlay.style.height = `${roiRect.height}px`;
}

// Process ROI for OCR
async function processFrame() {
    if (!processing) return;

    const roiBounds = roiElement.getBoundingClientRect();
    const cameraBounds = camera.getBoundingClientRect();

    // Calculate actual dimensions relative to video resolution
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

    // Change ROI to green to indicate processing
    roiElement.style.borderColor = 'green';

    try {
        const { data: { text } } = await Tesseract.recognize(canvas, 'eng', {
            logger: info => console.log(info)
        });

        output.textContent = text || 'No text detected.';
        testWindow.textContent = text || 'No test text detected.';
    } catch (error) {
        output.textContent = `Error: ${error.message}`;
        testWindow.textContent = `Error: ${error.message}`;
    }

    // Reset ROI color back to red after processing
    roiElement.style.borderColor = 'red';

    requestAnimationFrame(processFrame);
}

// Event listeners for controls
startBtn.addEventListener('click', async () => {
    await startCamera();
    processing = true;
    processFrame();
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-block';
});

stopBtn.addEventListener('click', () => {
    stopCamera();
    processing = false;
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    output.textContent = 'Scanner stopped.';
    testWindow.textContent = 'Scanner stopped.';
});

cameraSelect.addEventListener('change', startCamera);
resolutionSelect.addEventListener('change', startCamera);

// Initialize camera options on page load
getCameras();
