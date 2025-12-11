// Constants
const MAX_ANGLES = 16384;
const BIG_MYSTERY = 1800;

// Settings
let settings = {
    speed: 1.0,
    streamCount: 8,
    maxParticles: 300,
    bloomStrength: 1.5,
    cameraDistance: 15
};

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, settings.cameraDistance);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Post-processing
const composer = new THREE.EffectComposer(renderer);
const renderScene = new THREE.RenderPass(scene, camera);
composer.addPass(renderScene);

const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    settings.bloomStrength,
    0.8,
    0.3
);
composer.addPass(bloomPass);

// Create particle texture
function createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    
    return new THREE.CanvasTexture(canvas);
}

const particleTexture = createParticleTexture();

// Star class
class Star {
    constructor() {
        this.pos = new THREE.Vector3(0, 0, 0);
        this.oldPos = new THREE.Vector3(0, 0, 0);
        this.mystery = Math.random() * 10.0;
        this.rotSpeed = 0.4 + Math.random() * 0.5;
    }

    update(time) {
        this.oldPos.copy(this.pos);
        
        const rotsPerSecond = (2 * Math.PI * 12 / MAX_ANGLES) * this.rotSpeed * settings.speed;
        const thisAngle = time * rotsPerSecond;

        let cf = Math.cos(7 * thisAngle) + Math.cos(3 * thisAngle) + Math.cos(13 * thisAngle);
        cf /= 6;
        cf += 0.75;

        const thisPointInRads = 2.0 * Math.PI * this.mystery / BIG_MYSTERY;

        let x = 250 * cf * Math.cos(11 * (thisPointInRads + (3 * thisAngle)));
        let y = 250 * cf * Math.sin(12 * (thisPointInRads + (4 * thisAngle)));
        let z = 250 * Math.cos(23 * (thisPointInRads + (4 * thisAngle)));

        let rot = thisAngle * 0.501 + 5.01 * this.mystery / BIG_MYSTERY;
        let cr = Math.cos(rot);
        let sr = Math.sin(rot);

        let tmpX1 = x * cr - y * sr;
        let tmpY1 = y * cr + x * sr;

        let tmpX2 = tmpX1 * cr - z * sr;
        let tmpZ2 = z * cr + tmpX1 * sr;

        let tmpY3 = tmpY1 * cr - tmpZ2 * sr;
        let tmpZ3 = tmpZ2 * cr + tmpY1 * sr + 50;

        rot = thisAngle * 2.501 + 85.01 * this.mystery / BIG_MYSTERY;
        cr = Math.cos(rot);
        sr = Math.sin(rot);

        this.pos.x = (tmpX2 * cr - tmpY3 * sr) * 0.02;
        this.pos.y = (tmpY3 * cr + tmpX2 * sr) * 0.02;
        this.pos.z = tmpZ3 * 0.02;
    }
}

// Spark class
class Spark {
    constructor(streamIndex, totalStreams) {
        this.pos = new THREE.Vector3(0, 0, 0);
        this.mystery = (BIG_MYSTERY * (streamIndex + 1)) / totalStreams;
        this.fieldRange = 1.0;
        this.fieldSpeed = 12.0;
    }

    update(time, star) {
        const rotsPerSecond = 2 * Math.PI * this.fieldSpeed / MAX_ANGLES * settings.speed;
        const thisAngle = time * rotsPerSecond;
        const thisPointInRadians = 2 * Math.PI * this.mystery / BIG_MYSTERY;
        
        let cf = (Math.cos(7 * thisAngle) + Math.cos(3 * thisAngle) + Math.cos(13 * thisAngle));
        cf /= 6.0;
        cf += 2.0;
        
        let x = this.fieldRange * 10 * cf * Math.cos(11.0 * (thisPointInRadians + (3.0 * thisAngle)));
        let y = this.fieldRange * 10 * cf * Math.sin(12.0 * (thisPointInRadians + (4.0 * thisAngle)));
        let z = this.fieldRange * 10 * Math.cos(23.0 * (thisPointInRadians + (12.0 * thisAngle)));
        
        let rotation = thisAngle * 0.501 + 5.01 * this.mystery / BIG_MYSTERY;
        let cr = Math.cos(rotation);
        let sr = Math.sin(rotation);
        
        let tmpX1 = x * cr - y * sr;
        let tmpY1 = y * cr + x * sr;
        let tmpZ1 = z;
        
        let tmpX2 = tmpX1 * cr - tmpZ1 * sr;
        let tmpZ2 = tmpZ1 * cr + tmpX1 * sr;
        
        let tmpY3 = tmpY1 * cr - tmpZ2 * sr;
        let tmpZ3 = tmpZ2 * cr + tmpY1 * sr + 50;
        
        rotation = thisAngle * 2.501 + 85.01 * this.mystery / BIG_MYSTERY;
        cr = Math.cos(rotation);
        sr = Math.sin(rotation);
        
        let tmpX4 = tmpX2 * cr - tmpY3 * sr;
        let tmpY4 = tmpY3 * cr + tmpX2 * sr;
        
        this.pos.x = star.pos.x + tmpX4 * 0.02;
        this.pos.y = star.pos.y + tmpY4 * 0.02;
        this.pos.z = star.pos.z + tmpZ3 * 0.02;
    }
}

// Particle Stream using Points
class ParticleStream {
    constructor(color, sparkIndex) {
        this.color = color;
        this.sparkIndex = sparkIndex;
        this.positions = [];
        this.colors = [];
        this.sizes = [];
        this.ages = [];
        
        this.geometry = new THREE.BufferGeometry();
        this.material = new THREE.PointsMaterial({
            size: 0.4,
            map: particleTexture,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            vertexColors: true,
            sizeAttenuation: true
        });
        
        this.points = new THREE.Points(this.geometry, this.material);
        scene.add(this.points);
    }

    addParticle(star, spark) {
        if (this.positions.length / 3 >= settings.maxParticles) {
            // Remove oldest particle
            this.positions.splice(0, 3);
            this.colors.splice(0, 3);
            this.sizes.shift();
            this.ages.shift();
        }

        // Initial velocity toward spark
        const toSpark = new THREE.Vector3().subVectors(spark.pos, star.pos);
        const vel = toSpark.normalize().multiplyScalar(0.15); //originally 0.15
        
        this.positions.push(star.pos.x, star.pos.y, star.pos.z);
        this.colors.push(this.color.r, this.color.g, this.color.b);
        this.sizes.push(1.0);
        this.ages.push({
            age: 0,
            velocity: vel,
            targetPos: spark.pos.clone()
        });
    }

    update(deltaTime, spark) {
        // Update particle physics
        for (let i = 0; i < this.ages.length; i++) {
            const particle = this.ages[i];
            particle.age += deltaTime;
            
            const idx = i * 3;
            const pos = new THREE.Vector3(
                this.positions[idx],
                this.positions[idx + 1],
                this.positions[idx + 2]
            );
            
            // Gentle attraction to spark
            const toSpark = new THREE.Vector3().subVectors(spark.pos, pos);
            const dist = toSpark.length();
            if (dist > 0.1) {
                const force = toSpark.normalize().multiplyScalar(0.02 * deltaTime); //original 0.08
                particle.velocity.add(force);
            }
            
            // Apply drag
            particle.velocity.multiplyScalar(0.995);
            
            // Update position
            pos.add(particle.velocity.clone().multiplyScalar(deltaTime * 60));
            this.positions[idx] = pos.x;
            this.positions[idx + 1] = pos.y;
            this.positions[idx + 2] = pos.z;
            
            // Fade and shrink over time
            const lifeFactor = 1 - Math.min(particle.age / 3.0, 1.0);
            const fade = Math.pow(lifeFactor, 0.5);
            
            this.colors[idx] = this.color.r * fade * 1.5;
            this.colors[idx + 1] = this.color.g * fade * 1.5;
            this.colors[idx + 2] = this.color.b * fade * 1.5;
            
            this.sizes[i] = 1.0 * (0.3 + lifeFactor * 0.7);
        }
        
        // Update geometry
        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
        this.geometry.setAttribute('size', new THREE.Float32BufferAttribute(this.sizes, 1));
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;
    }

    rebuild(newColor) {
        this.color = newColor;
        scene.remove(this.points);
        this.points = new THREE.Points(this.geometry, this.material);
        scene.add(this.points);
    }
}

// Initialize
const star = new Star();
let sparks = [];
let streams = [];

const colorPresets = {
    classic: [
        new THREE.Color(0xff6b9d),
        new THREE.Color(0x4ecdc4),
        new THREE.Color(0xffd93d),
        new THREE.Color(0x95e1d3),
        new THREE.Color(0xc77dff),
        new THREE.Color(0xff9a76)
    ],
    intense: [
        new THREE.Color(0xff0066),
        new THREE.Color(0x00ffff),
        new THREE.Color(0xffff00),
        new THREE.Color(0xff00ff),
        new THREE.Color(0x00ff00),
        new THREE.Color(0xff9900)
    ],
    simple: [
        new THREE.Color(0xb8d4e8),
        new THREE.Color(0xd4b8e8),
        new THREE.Color(0xe8d4b8),
        new THREE.Color(0xb8e8d4),
        new THREE.Color(0xe8b8d4),
        new THREE.Color(0xd4e8b8)
    ],
    chaotic: [
        new THREE.Color(0xff0099),
        new THREE.Color(0x00ff99),
        new THREE.Color(0x9900ff),
        new THREE.Color(0x99ff00),
        new THREE.Color(0x0099ff),
        new THREE.Color(0xff9900)
    ]
};

let currentColors = colorPresets.classic;

function initStreams() {
    // Clear existing
    streams.forEach(s => scene.remove(s.points));
    streams = [];
    sparks = [];
    
    // Create new
    for (let i = 0; i < settings.streamCount; i++) {
        sparks.push(new Spark(i, settings.streamCount));
        streams.push(new ParticleStream(currentColors[i % currentColors.length], i));
    }
}

initStreams();

// Center glow
const glowGeometry = new THREE.SphereGeometry(0.3, 16, 16);
const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
});
const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
scene.add(glowSphere);

// Animation loop
let time = 0;
let emissionTimer = 0;
const EMISSION_RATE = 1 / 60;

function animate() {
    requestAnimationFrame(animate);
    
    const deltaTime = 0.016;
    time += deltaTime;
    emissionTimer += deltaTime;
    
    star.update(time);
    sparks.forEach(spark => spark.update(time, star));
    
    while (emissionTimer >= EMISSION_RATE) {
        streams.forEach((stream, i) => stream.addParticle(star, sparks[i]));
        emissionTimer -= EMISSION_RATE;
    }
    
    streams.forEach((stream, i) => stream.update(deltaTime, sparks[i]));
    
    glowSphere.position.copy(star.pos);
    const pulse = 1 + Math.sin(time * 3) * 0.15;
    glowSphere.scale.set(pulse, pulse, pulse);
    
    camera.position.lerp(new THREE.Vector3(
        Math.sin(time * 0.04) * 5,
        Math.cos(time * 0.03) * 4,
        settings.cameraDistance + Math.cos(time * 0.04) * 2
    ), 0.05);
    camera.lookAt(0, 0, 0);
    
    composer.render();
}

// Wait for DOM to be ready before setting up controls
window.addEventListener('DOMContentLoaded', initControls);

// Start animation immediately
animate();

// Controls setup function
function initControls() {
    const speedInput = document.getElementById('speed');
    const streamsInput = document.getElementById('streams');
    const trailInput = document.getElementById('trail');
    const bloomInput = document.getElementById('bloom');
    const cameraInput = document.getElementById('camera');

    if (!speedInput) return; // Safety check

    speedInput.addEventListener('input', (e) => {
        settings.speed = parseFloat(e.target.value);
        document.getElementById('speed-val').textContent = settings.speed.toFixed(1);
    });

    streamsInput.addEventListener('input', (e) => {
        settings.streamCount = parseInt(e.target.value);
        document.getElementById('count-val').textContent = settings.streamCount;
        initStreams();
    });

    trailInput.addEventListener('input', (e) => {
        settings.maxParticles = parseInt(e.target.value);
        document.getElementById('trail-val').textContent = settings.maxParticles;
    });

    bloomInput.addEventListener('input', (e) => {
        settings.bloomStrength = parseFloat(e.target.value);
        bloomPass.strength = settings.bloomStrength;
        document.getElementById('bloom-val').textContent = settings.bloomStrength.toFixed(1);
    });

    cameraInput.addEventListener('input', (e) => {
        settings.cameraDistance = parseFloat(e.target.value);
        document.getElementById('camera-val').textContent = settings.cameraDistance;
    });
}

// Controls
function toggleControls() {
    const controls = document.getElementById('controls');
    if (controls) {
        controls.style.display = controls.style.display === 'none' ? 'block' : 'none';
    }
}

function applyPreset(preset) {
    if (preset === 'classic') {
        settings.speed = 1.0;
        settings.bloomStrength = 1.0;
        currentColors = colorPresets.intense;
    } else if (preset === 'intense') {
        settings.speed = 1.0;
        settings.bloomStrength = 1.5;
        currentColors = colorPresets.intense;
    } else if (preset === 'simple') {
        settings.speed = 0.5;
        settings.bloomStrength = 1.0;
        currentColors = colorPresets.simple;
    } else if (preset === 'chaotic') {
        settings.speed = 2.5;
        settings.bloomStrength = 2.8;
        currentColors = colorPresets.chaotic;
    }
    
    updateControls();
    bloomPass.strength = settings.bloomStrength;
    streams.forEach((s, i) => s.rebuild(currentColors[i % currentColors.length]));
}

function updateControls() {
    const speedEl = document.getElementById('speed');
    const bloomEl = document.getElementById('bloom');
    if (speedEl && bloomEl) {
        speedEl.value = settings.speed;
        bloomEl.value = settings.bloomStrength;
        document.getElementById('speed-val').textContent = settings.speed.toFixed(1);
        document.getElementById('bloom-val').textContent = settings.bloomStrength.toFixed(1);
    }
}

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});