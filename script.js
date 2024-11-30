const cameraSelect = document.getElementById('cameraSelect');
const resolutionSelect = document.getElementById('resolutionSelect');
const camera = document.getElementById('camera');
const canvas = document.getElementById('viewport');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const output = document.getElementById('output');

let stream = null;
let processing = false;
let roi = { x: 50, y: 50, width: 200, height: 100 };

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
            height: { ideal: parseInt(resolution[1]) }
        }
    });

    camera.srcObject = stream;
    drawROI();
}

// Stop the camera stream
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

// Draw the ROI rectangle
function drawROI() {
    const ctx = canvas.getContext('2d');
    canvas.width = camera.videoWidth;
    canvas.height = camera.videoHeight;

    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeRect(roi.x, roi.y, roi.width, roi.height);
}

// Process the ROI frame for OCR
async function processFrame() {
    if (!processing) return;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(camera, 0, 0, canvas.width, canvas.height);

    const frame = ctx.getImageData(roi.x, roi.y, roi.width, roi.height);
    output.textContent = 'Processing...';

    try {
        const { data: { text } } = await Tesseract.recognize(frame, 'eng', {
            logger: info => console.log(info)
        });
        output.textContent = text || 'No text detected.';
    } catch (error) {
        output.textContent = `Error: ${error.message}`;
    }

    requestAnimationFrame(processFrame);
}

// Event listeners for buttons and dynamic updates
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
});

// Update camera stream on camera or resolution change
cameraSelect.addEventListener('change', startCamera);
resolutionSelect.addEventListener('change', startCamera);

// Initialize camera options on page load
getCameras();
