class Player {
    constructor(camera) {
        this.camera = camera;
        this.camera.position.set(0, 1.6, 0); // Altura de los ojos del jugador
        
        this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');
        this.speed = 0.08;
    }

    update() {
        // 1. Rotación de Cámara (Mirar alrededor en Tablet)
        if (UI.isLooking) {
            this.rotation.y -= UI.lookInput.x;
            this.rotation.x -= UI.lookInput.y;
            
            // Limitar vista arriba y abajo (no dar la vuelta completa)
            this.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.rotation.x));
            
            this.camera.quaternion.setFromEuler(this.rotation);
            // Resetear input acumulado para evitar giros infinitos
            UI.lookInput.x = 0;
            UI.lookInput.y = 0;
        }

        // 2. Movimiento del Jugador (Joystick)
        if (UI.moveInput.x !== 0 || UI.moveInput.y !== 0) {
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
            
            // Forzar a quedarse en el plano del suelo (eje Y plano)
            forward.y = 0;
            right.y = 0;
            forward.normalize();
            right.normalize();

            // Combinar direcciones basadas en el Joystick
            const moveDirection = forward.multiplyScalar(UI.moveInput.y).add(right.multiplyScalar(UI.moveInput.x));
            
            this.camera.position.add(moveDirection.multiplyScalar(this.speed));
        }
    }
}

