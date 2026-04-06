import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Setup renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop( animate );
document.body.appendChild(renderer.domElement);

// Setup scene
const scene = new THREE.Scene();

// Setup camera
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 1);

// Setup controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = false;
controls.enablePan = false;
controls.rotateSpeed = -0.5;
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Setup texture
const textureLoader = new THREE.TextureLoader();
const panoramaTexture = textureLoader.load(
    'panorama.png',
    () => {
        console.log("Texture loaded");
    }
);
panoramaTexture.wrapS = THREE.RepeatWrapping;
panoramaTexture.wrapT = THREE.ClampToEdgeWrapping;
panoramaTexture.minFilter = THREE.LinearFilter;
panoramaTexture.magFilter = THREE.LinearFilter;

const geometry = new THREE.PlaneGeometry(2, 2);
const material = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0.0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uInverseProjection: { value: new THREE.Matrix4() },
        uInverseView: { value: new THREE.Matrix4() },
        uTexture: { value: panoramaTexture }
    },
    vertexShader: `
        // Simple pass-through.
        void main() {
            gl_Position = vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uTime;
        uniform vec2 uResolution;
        uniform mat4 uInverseProjection;
        uniform mat4 uInverseView;
        uniform sampler2D uTexture;

        const float PI = 3.14159265359;

        void main() {
            // --- 1. Screen to World Ray (Unproject) ---
            vec2 uv = gl_FragCoord.xy / uResolution;
            vec2 ndc = uv * 2.0 - 1.0;
            
            vec4 clipPos = vec4(ndc, 0.0, 1.0);
            vec4 viewPos = uInverseProjection * clipPos;
            vec3 viewRay = normalize(viewPos.xyz);

            vec3 worldRay = (uInverseView * vec4(viewRay, 0.0)).xyz;
            worldRay = normalize(worldRay);

            // --- 2. World Ray to Spherical Coordinates ---
            float theta = atan(worldRay.z, worldRay.x);
            float phi = asin(worldRay.y);

            // --- 3. Spherical to Equirectangular UV Coordinates ---
            float u = 0.5 + theta / (2.0 * PI);
            float v = 0.5 + phi / PI;

            // --- 4. Sample Texture ---
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

// Animation loop
function animate( time ) {
	controls.update();
    camera.updateMatrixWorld();

    material.uniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);
    material.uniforms.uInverseView.value.copy(camera.matrixWorld); 
    //material.uniforms.uTime.value += elapsedTime;

    renderer.render(scene, camera);
}