import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'stats';
import GUI from 'lil-gui';

// Adjustable settings
const settings = {
    fov: 75,
    panorama: '1',
	lowerY: -0.6,
    upperY: 0.6,
    phase: 0.0,
    speed: 0.0,
    twisting: 0.0
};

// Setup renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop( animate );
document.body.appendChild(renderer.domElement);

// Setup scene
const scene = new THREE.Scene();

// Setup camera
const camera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 1);

// Setup controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = false;
controls.enablePan = false;
controls.rotateSpeed = -0.5;
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Setup texture loading
const textureLoader = new THREE.TextureLoader();
function loadPanorama( filename ) {
    const panoramaTexture = textureLoader.load(`panoramas/${filename}.png`);
    panoramaTexture.wrapS = THREE.RepeatWrapping;
    panoramaTexture.wrapT = THREE.ClampToEdgeWrapping;
    panoramaTexture.minFilter = THREE.LinearFilter;
    panoramaTexture.magFilter = THREE.LinearFilter;
    return panoramaTexture;
}

const geometry = new THREE.PlaneGeometry(2, 2);
const material = new THREE.ShaderMaterial({
    uniforms: {
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uInverseProjection: { value: new THREE.Matrix4() },
        uInverseView: { value: new THREE.Matrix4() },
        uTexture: { value: loadPanorama(settings.panorama) },
        uLowerY: { value: settings.lowerY },
        uUpperY: { value: settings.upperY },
        uPhase: { value: settings.phase },
        uTwisting: { value: settings.twisting }
    },
    vertexShader: `
        // Simple pass-through.
        void main() {
            gl_Position = vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec2 uResolution;
        uniform mat4 uInverseProjection;
        uniform mat4 uInverseView;
        uniform sampler2D uTexture;

        uniform float uLowerY;
        uniform float uUpperY;
        uniform float uPhase;
        uniform float uTwisting;

        const float PI = 3.14159265359;

        void main() {
            // --- Screen to World Ray (Unproject) ---
            vec2 uv = gl_FragCoord.xy / uResolution;
            vec2 ndc = uv * 2.0 - 1.0;
            
            vec4 clipPos = vec4(ndc, 0.0, 1.0);
            vec4 viewPos = uInverseProjection * clipPos;
            vec3 viewRay = normalize(viewPos.xyz);

            vec3 worldRay = (uInverseView * vec4(viewRay, 0.0)).xyz;
            worldRay = normalize(worldRay);

            // --- Log-Polar Coordinates in the Riemann Sphere ---
            float rho = atanh(worldRay.y);
            float theta = atan(worldRay.z, worldRay.x);

            // --- Periodic Annulus ---
            float lowerRho = atanh(uLowerY);
            float upperRho = atanh(uUpperY);
            float period = upperRho - lowerRho;

            // --- Log-Polar Rotation and Scale (Twisting) ---
            float twistingFactor = uTwisting * period / (2.0 * PI);
            float twistedRho = (rho - theta * twistingFactor);
            float twistedTheta = (theta + rho * twistingFactor);
            rho = twistedRho;
            theta = twistedTheta;

            // --- Droste Effect ---
            rho = lowerRho + mod(rho - lowerRho - uPhase * period, period);
            float newY = tanh(rho);
            float phi = asin(newY);

            // --- Spherical to Equirectangular UV Coordinates ---
            float u = 0.5 + theta / (2.0 * PI);
            float v = 0.5 + phi / PI;

            // --- Sample Texture ---
            vec3 color = texture(uTexture, vec2(u, v)).rgb;

            gl_FragColor = vec4(color, 1.0);
        }
    `
});

const quad = new THREE.Mesh(geometry, material);
scene.add(quad);

// Handle resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
});

// Setup panorama list
const panoramaList = [];
for (var i = 1; i <= 100; i++) { panoramaList.push(i.toString()); }

// Setup GUI
const gui = new GUI();
gui.add(settings, 'fov', 0, 180, 1).onChange( value => { camera.fov = value; camera.updateProjectionMatrix(); } );
gui.add(settings, 'panorama', panoramaList).onFinishChange( value => { material.uniforms.uTexture.value = loadPanorama(value); } );
gui.add(settings, 'lowerY', -0.99999, 0.99999);
gui.add(settings, 'upperY', -0.99999, 0.99999);
gui.add(settings, 'phase', 0.0, 1.0).listen();
gui.add(settings, 'speed', -1.0, 1.0);
gui.add(settings, 'twisting', 0.0, 10.0, 0.1);

// Setup stats
const stats = new Stats();
document.body.appendChild(stats.dom);

// Animation loop
let lastTime = 0;
function animate( time ) {
    stats.begin();

    const deltaTime = (time - (lastTime || time)) / 1000;
    lastTime = time;    

	controls.update();
    camera.updateMatrixWorld();

    material.uniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);
    material.uniforms.uInverseView.value.copy(camera.matrixWorld);

    settings.phase = (settings.phase + deltaTime * settings.speed) % 1;

    material.uniforms.uLowerY.value= settings.lowerY;
    material.uniforms.uUpperY.value= settings.upperY;
    material.uniforms.uPhase.value= settings.phase;
    material.uniforms.uTwisting.value= settings.twisting;

    renderer.render(scene, camera);

    stats.end();
}