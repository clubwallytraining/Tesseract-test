const cameraSelect = document.getElementById('cameraSelect');
const resolutionSelect = document.getElementById('resolutionSelect');
const camera = document.getElementById('camera');
const roiElement = document.getElementById('roi');
const startBtn = document.getElementById('start');
const output = document.getElementById('output');

let stream = null;
let processing = false;

// Request permissions and start scanner
startBtn.addEventListener('click', async () => {
    try {
        // Request camera permissions
        stream = await navigator.mediaDevices.getUserMedia({ video: true });

        // Refresh to populate camera options and start scanning
        location.reload();
    } catch (err) {
        alert("Camera permissions are required to use this scanner.");
    }
});

// Initialize scanner after permissions are granted
async function initializeScanner() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    if (videoDevices.length === 0) {
        alert("No camera devices found.");
        return;
    }

    // Populate camera options
    cameraSelect.innerHTML = videoDevices.map((device, index) =>
        `<option value="${device.deviceId}">${device.label || `Camera ${index + 1}`}</option>`
    ).join('');

    // Select the first available camera
    const defaultDeviceId = videoDevices[0].deviceId;

    // Set up video stream
    const resolution = resolutionSelect.value.split('x');
    stream = await navigator.mediaDevices.getUserMedia({
        video: {
            deviceId: { exact: defaultDeviceId },
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

// Start text processing
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

// Initialize scanner if permissions are already granted
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.enumerateDevices().then(() => {
        initializeScanner();
    });
}
