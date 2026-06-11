// Manejo de controles táctiles (Joystick y Vista)
const UI = {
    moveInput: { x: 0, y: 0 },
    lookInput: { x: 0, y: 0 },
    isLooking: false,
    
    init() {
        this.initJoystick();
        this.initCameraTouch();
    },

    initJoystick() {
        const base = document.getElementById('joystick-base');
        const handle = document.getElementById('joystick-handle');
        const maxRadius = 45; // Límite de movimiento del botón

        let startX = 0, startY = 0;

        base.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            const rect = base.getBoundingClientRect();
            startX = rect.left + rect.width / 2;
            startY = rect.top + rect.height / 2;
        });

        base.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            
            let dx = touch.clientX - startX;
            let dy = touch.clientY - startY;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > maxRadius) {
                dx = (dx / distance) * maxRadius;
                dy = (dy / distance) * maxRadius;
                distance = maxRadius;
            }

            handle.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

            // Normalizar valores entre -1 y 1 para el movimiento del jugador
            this.moveInput.x = dx / maxRadius;
            this.moveInput.y = -(dy / maxRadius); // Invertido para concordar con los ejes 3D
        });

        base.addEventListener('touchend', () => {
            handle.style.transform = 'translate(-50%, -50%)';
            this.moveInput.x = 0;
            this.moveInput.y = 0;
        });
    },

    initCameraTouch() {
        const cameraZone = document.getElementById('camera-zone');
        let lastTouchX = 0, lastTouchY = 0;

        cameraZone.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;
            this.isLooking = true;
        });

        cameraZone.addEventListener('touchmove', (e) => {
            if (!this.isLooking) return;
            const touch = e.touches[0];
            
            // Sensibilidad de la cámara de la tablet
            const sensitivity = 0.005;
            this.lookInput.x = (touch.clientX - lastTouchX) * sensitivity;
            this.lookInput.y = (touch.clientY - lastTouchY) * sensitivity;

            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;
        });

        cameraZone.addEventListener('touchend', () => {
            this.isLooking = false;
            this.lookInput.x = 0;
            this.lookInput.y = 0;
        });
    }
};

