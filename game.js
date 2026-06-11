// Configuración inicial del juego
let scene, camera, renderer, player;

function init() {
    // 1. Escena y Niebla Dreamcore (Color beige/verdoso pálido)
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdce3a1);
    // Niebla densa: empieza a los 2 metros y bloquea la vista por completo a los 35 metros
    scene.fog = new THREE.FogExp2(0xdce3a1, 0.035); 

    // 2. Cámara y Renderizador WebGL
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Optimizado para tablets
    document.getElementById('game-container').appendChild(renderer.domElement);

    // 3. Inicializar Componentes
    UI.init();
    World.create(scene);
    player = new Player(camera);

    // Ocultar pantalla de carga con retraso dramático
    setTimeout(() => {
        const loader = document.getElementById('loading-screen');
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 1000);
    }, 1500);

    // 4. Ajuste de pantalla al rotar la tablet
    window.addEventListener('resize', onWindowResize);

    // Iniciar bucle
    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Bucle de Animación constante
function animate() {
    requestAnimationFrame(animate);

    // Actualizar Jugador y controles
    if (player) player.update();

    // Comprobar si tocó la puerta de escape
    if (player && World.checkEscape(player.camera.position)) {
        // Acción de escape (por ahora reinicia la posición simulando un loop infinito)
        player.camera.position.set(0, 1.6, 20);
        alert("Cruzaste el umbral... El espacio liminal se repite.");
    }

    renderer.render(scene, camera);
}

// Arrancar juego al cargar la página
window.onload = init;

