const World = {
    escapeDoor: null,

    create(scene) {
        // 1. Iluminación surrealista
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xfffaed, 0.5);
        sunLight.position.set(10, 20, 10);
        scene.add(sunLight);

        // 2. Suelo de Pasto Plano e Infinito
        const floorGeo = new THREE.PlaneGeometry(1000, 1000);
        // Creamos un color verde vivo, ligeramente lavado por la estética dreamcore
        const floorMat = new THREE.MeshLambertMaterial({ color: 0x557a46 }); 
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);

        // 3. La Puerta de Escape (Un objeto liminal en medio de la nada)
        const doorGroup = new THREE.Group();
        
        // Marco de la puerta
        const frameGeo = new THREE.BoxGeometry(2.2, 3.2, 0.2);
        const frameMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.y = 1.6;
        doorGroup.add(frame);

        // El centro de la puerta (Brillante / Teletransporte)
        const portalGeo = new THREE.PlaneGeometry(1.8, 2.8);
        const portalMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
        const portal = new THREE.Mesh(portalGeo, portalMat);
        portal.position.set(0, 1.6, 0.11);
        doorGroup.add(portal);

        // Ubicar la puerta a una distancia al frente para que el jugador la busque
        doorGroup.position.set(0, 0, -30); 
        scene.add(doorGroup);
        
        this.escapeDoor = doorGroup;
    },

    checkEscape(playerPosition) {
        // Verificar si el jugador está muy cerca de la puerta
        const distance = playerPosition.distanceTo(this.escapeDoor.position);
        if (distance < 2.0) {
            return true;
        }
        return false;
    }
};

