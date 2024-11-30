const cameraSelect = document.getElementById('cameraSelect');
const resolutionSelect = document.getElementById('resolutionSelect');
const patchSizeInput = document.getElementById('patchSize');
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
    cameraSelect.innerHTML = videoDevices.map(device => `<option value="${device.deviceId}">${device.label || 'Camera ' + (videoDevices.indexOf(device) + 1)}</option>`).join('');
}

// Start the camera with selected options
async function startCamera() {
    if (stream) stopCamera();
    const deviceId = cameraSelect.value;
    const resolution = resolutionSelect.value.split('x');
    stream = await navigator.mediaDevices.getUserMedia({
        video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { exact: parseInt(resolution[0]) },
            height: { exact: parseInt(resolution[1]) }
        }
    });
    camera.srcObject = stream;
}

// Stop the camera
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

// Draw ROI on canvas
function drawROI() {
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(camera, 0, 0, canvas.width, canvas.height);
    ctx.strokeRect(roi.x, roi.y, roi.width, roi.height);
}

// Process a frame
async function processFrame() {
    if (!processing) return;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(camera, 0, 0, canvas.width, canvas.height);
    const frame = ctx.getImageData(roi.x, roi.y, roi.width, roi.height);
    output.textContent = 'Processing...';

    try {
        const patchSize = parseInt(patchSizeInput.value) || 20;
        const { data: { text } } = await Tesseract.recognize(frame, 'eng', {
            logger: info => console.log(info),
            tessedit_pageseg_mode: 1, // Single column mode for improved ROI processing
            oem: patchSize // Custom patch size to process smaller chunks
        });
        output.textContent = text || 'No text detected';
    } catch (error) {
        output.textContent = `Error: ${error.message}`;
    }

    requestAnimationFrame(processFrame);
}

// Initialize camera options
startBtn.addEventListener('click', async () => {
    await startCamera();
    drawROI();
    processing = true;
    processFrame();
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-block';
});

// Stop processing and camera
stopBtn.addEventListener('click', () => {
    stopCamera();
    processing = false;
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    output.textContent = 'Scanner stopped.';
});

// Enable ROI resizing
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    canvas.addEventListener('mousemove', onDrag);
    canvas.addEventListener('mouseup', () => canvas.removeEventListener('mousemove', onDrag));

    function onDrag(e) {
        const newX = e.clientX - rect.left;
        const newY = e.clientY - rect.top;
        roi.width = Math.abs(newX - startX);
        roi.height = Math.abs(newY - startY);
        drawROI();
    }
});

// Populate camera list on load
getCameras();
