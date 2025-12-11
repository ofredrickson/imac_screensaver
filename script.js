// Seed global noise (noisejs)
        if (typeof noise !== 'undefined') {
            noise.seed(Math.random());
        }

        //scene setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);
        
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 0, 10);
        
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.toneMapping = THREE.ReinhardToneMapping;
        document.body.appendChild(renderer.domElement);

        const centerPos = new THREE.Vector3(0, 0, 0);
in
        // Post-processing setup —— BLOOM IMPLEMENTATION ====
        const composer = new THREE.EffectComposer(renderer);
        const renderScene = new THREE.RenderPass(scene, camera);
        composer.addPass(renderScene);

        // UnrealBloomPass parameters: resolution, strength, radius, threshold
        const bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.8,   // strength (higher = more glow)
            1.0,   // radius (spread of glow)
            0.1   // threshold (brightness cutoff)
        );
        composer.addPass(bloomPass);
        // =================================================

        // NEW – Motion trail effect - fade layer ==============
        const fadeGeometry = new THREE.PlaneGeometry(100, 100);
        const fadeMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.15,  // Lower = longer trails
            depthWrite: false
        });
        const fadePlane = new THREE.Mesh(fadeGeometry, fadeMaterial);
        fadePlane.position.z = -5;
        camera.add(fadePlane);
        scene.add(camera);
        // =====================================================

        //ribbon stream class - anchored at center
        class RibbonStream {
            constructor(color, baseAngle, streamId) {
                this.color = color;
                this.baseAngle = baseAngle;
                this.streamId = streamId;
                // this.segmentCount = 120 + Math.floor(Math.random() * 60); //number of particles in the ribbon

                this.segmentCount = 40; // number of segments

                // Random direction vector for star-like spread
                this.direction = new THREE.Vector3(
                    Math.cos(baseAngle),
                    Math.sin(baseAngle),
                    (Math.random() - 0.5) * 0.5
                ).normalize();

                //connected ribbon geometry
                this.geometry = new THREE.BufferGeometry();
                this.positions = new Float32Array(this.segmentCount * 3);
                this.colors = new Float32Array(this.segmentCount * 3);
                // this.positions = new Float32Array(this.segmentCount * 2 * 3); // 2 points per segment
                // this.colors = new Float32Array(this.segmentCount * 2 * 3);


                
                //random motion parameters for semi-erratic movement, flow speed
                this.noiseOffset = Math.random() * 100;
                // this.flowSpeed = 1.5 + Math.random() * 0.3; //1.5 and 0.3

                this.flowSpeed = 2.8 + Math.random() * 0.4;  // Speed of bending animation (0.4)
                this.rotationSpeed = 0.3 + Math.random() * 0.4;  // Speed of rotation
                this.bendAmount = 2.0 + Math.random() * 1.5;  // How much it bends
                
                
                //NEW - IMPLEMENT TUBE GEOMETRY using mesh material
                // Material for the ribbon tube
                this.material = new THREE.MeshBasicMaterial({
                    color: this.color,
                    transparent: true,
                    opacity: 0.8,
                    blending: THREE.AdditiveBlending,
                    side: THREE.DoubleSide,
                    depthWrite: false,
                    vertexColors: true
                });

                this.mesh = null;
                //=====================================================
            }

            // Generate points along the ribbon path
            generatePathPoints(time, centerPos) {
                const flowTime = time * this.flowSpeed;
                const points = [];
                
                // NEW – Add rotation over time - this makes ribbons twist around their axis
                const rotationAngle = time * this.rotationSpeed;
                const rotationMatrix = new THREE.Matrix4().makeRotationZ(rotationAngle * 0.5);
                const rotatedDirection = this.direction.clone().applyMatrix4(rotationMatrix);
                // ===========================================================================

                for (let i = 0; i < this.segmentCount; i++) {
                    const t = i / (this.segmentCount - 1);
                    const distance = t * 5;
                    

                    let x = rotatedDirection.x * distance;
                    let y = rotatedDirection.y * distance;
                    let z = rotatedDirection.z * distance;
                    
                    // Add Perlin noise for smooth, flowing curves
                    if (typeof noise !== 'undefined') {

                        // NEW IMPROVEMENT - These noise values change over time, making ribbons bend continuously
                        const bendX = noise.perlin3(flowTime * 0.5 + t * 2, this.noiseOffset, t * 3);
                        const bendY = noise.perlin3(flowTime * 0.4 + t * 2, this.noiseOffset + 50, t * 3);
                        const bendZ = noise.perlin3(flowTime * 0.45 + t * 2, this.noiseOffset + 100, t * 3);
                        // ===========================================================================
                        
                        // const bendStrength = Math.pow(t, 1.5) * this.bendAmount;
                        const bendStrength = distance * 2.5; //NEW IMPROVEMENT

                        x += bendX * bendStrength;
                        y += bendY * bendStrength;
                        z += bendZ * bendStrength;
                        
                        // NEW - Add secondary wave motion for more fluid movement ====================
                        // const waveX = Math.sin(flowTime * 2 + t * Math.PI * 3) * 0.5 * t;
                        // const waveY = Math.cos(flowTime * 1.8 + t * Math.PI * 2.5) * 0.5 * t;
                        // const waveZ = Math.sin(flowTime * 2.2 + t * Math.PI * 2) * 0.3 * t;

                        //NEW IMPROVEMENTS
                        const wavePhase = flowTime * 1.5;
                        const waveX = Math.sin(wavePhase + t * Math.PI * 2) * distance * 0.8;
                        const waveY = Math.cos(wavePhase * 0.8 + t * Math.PI * 1.5) * distance * 0.8;
                        const waveZ = Math.sin(wavePhase * 1.2 + t * Math.PI * 1.8) * distance * 0.4;

                        x += waveX;
                        y += waveY;
                        z += waveZ;

                        // rotation component
                        const rotationAmount = flowTime * this.rotationSpeed;
                        const rotX = Math.cos(rotationAmount + t * Math.PI) * distance * 0.3;
                        const rotY = Math.sin(rotationAmount + t * Math.PI) * distance * 0.3;

                        x += rotX;
                        y += rotY;

                        // ===========================================================================

                        // NEW IMPROVEMENT – Add tertiary wobble for organic feel
                        const wobbleX = noise.perlin3(flowTime * 1.2, t * 5, this.noiseOffset + 150);
                        const wobbleY = noise.perlin3(flowTime * 1.0, t * 5, this.noiseOffset + 200);
                        const wobbleZ = noise.perlin3(flowTime * 1.1, t * 5, this.noiseOffset + 250);
                        // ===========================================================================

                        // // Secondary wobble noise
                        // const wobbleX = noise.perlin3(flowTime * 0.3, t * 2.5, this.noiseOffset + 150);
                        // const wobbleY = noise.perlin3(flowTime * 0.28, t * 2.5, this.noiseOffset + 200);
                        // const wobbleZ = noise.perlin3(flowTime * 0.32, t * 2.5, this.noiseOffset + 250);
                        
                        const wobbleStrength = Math.pow(t, 2) * 0.8;
                        x += wobbleX * wobbleStrength;
                        y += wobbleY * wobbleStrength;
                        z += wobbleZ * wobbleStrength;
                    }
                    
                    points.push(new THREE.Vector3(
                        centerPos.x + x,
                        centerPos.y + y,
                        centerPos.z + z
                    ));
                }
                
                return points;
            }

            //NEW – IMPLEMENT UPDATE WITH TUBE GEOMETRY
            update(time, centerPos) {
                // Remove old mesh if it exists
                if (this.mesh) {
                    scene.remove(this.mesh);
                    this.mesh.geometry.dispose();
                }
                
                // Generate points and create smooth curve
                const points = this.generatePathPoints(time, centerPos);
                const curve = new THREE.CatmullRomCurve3(points);
                
                // Create tube geometry along the curve
                // TubeGeometry(path, tubularSegments, radius, radialSegments, closed)
                const geometry = new THREE.TubeGeometry(curve, 64, 0.08, 8, false); //64
                
                // Create gradient colors for vertices
                const colors = [];
                const positionAttribute = geometry.attributes.position;
                
                for (let i = 0; i < positionAttribute.count; i++) {
                    // Calculate progress along the tube (0 = center, 1 = tip)
                    const segmentIndex = Math.floor(i / (8 + 1)); // radialSegments + 1
                    const totalSegments = 64; // tubularSegments
                    const t = segmentIndex / totalSegments;
                    
                    // Fade brightness from center to tip with soft falloff
                    const fade = Math.pow(1 - t, 0.4);
                    const brightness = 4.0;
                    
                    colors.push(
                        this.color.r * fade * brightness,
                        this.color.g * fade * brightness,
                        this.color.b * fade * brightness
                    );
                }
                
                geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
                
                // Create mesh and add to scene
                this.mesh = new THREE.Mesh(geometry, this.material);
                scene.add(this.mesh);
            }
            //==================================================================
        }

        //create multiple ribbon streams from the center
        const streamCount = 12;
        const streams = [];
        
        const colors = [
            new THREE.Color(0xff6b9d),  //pink
            new THREE.Color(0x4ecdc4),  //cyan
            new THREE.Color(0xffd93d),  //yellow
            new THREE.Color(0x95e1d3),  //mint
            new THREE.Color(0xc77dff),  //purple
            new THREE.Color(0xff9a76)   //orange
        ];

        // Distribute streams evenly in all directions (star pattern)
        for (let i = 0; i < streamCount; i++) {
            const phi = Math.acos(-1 + (2 * i) / streamCount);
            const theta = Math.sqrt(streamCount * Math.PI) * phi;
            
            streams.push(new RibbonStream(
                colors[i % colors.length],
                theta,
                i
            ));
        }

        //add a glowing center point
        const centerGeometry = new THREE.SphereGeometry(0.12, 16, 16);
        const centerMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
        });
        const centerSphere = new THREE.Mesh(centerGeometry, centerMaterial);
        scene.add(centerSphere);

        // // Add outer glow ring for center
        // const glowGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        // const glowMaterial = new THREE.MeshBasicMaterial({
        //     color: 0xaaaaff,
        //     transparent: true,
        //     opacity: 0.5,
        //     blending: THREE.AdditiveBlending
        // });
        // const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
        // scene.add(glowSphere);

        //handle window resize
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            //NEW —— BLOOM
            composer.setSize(window.innerWidth, window.innerHeight);
        });


        let time = 0;
        
        function animate() {
            requestAnimationFrame(animate);
            
            time += 0.016; //60 fps?
            
            //move the center around smoothly (change speed of the graphic here)
            centerPos.x = Math.sin(time * 0.8) * 2.5;   //horizontal drift 0.5
            centerPos.y = Math.cos(time * 0.6) * 2.0;   //vertical drift 0.3
            centerPos.z = Math.sin(time * 0.5) * 1.5;   //depth drift 0.2

            //update all ribbon streams
            streams.forEach(stream => stream.update(time, centerPos));

            
            //move the sphere to match
            centerSphere.position.copy(centerPos);
            // glowSphere.position.copy(centerPos);


            camera.position.lerp(new THREE.Vector3(
                Math.sin(time * 0.04) * 5,
                Math.cos(time * 0.03) * 3,
                Math.cos(time * 0.04) * 10
            ), 0.05);
            
            camera.lookAt(0, 0, 0);
            
            //pulse the center sphere slightly
            const pulse = 1 + Math.sin(time * 3) * 0.10; //0.15
            centerSphere.scale.set(pulse, pulse, pulse);

            // // Pulse glow independently
            // const glowPulse = 1 + Math.sin(time * 2.5) * 0.2; //0.2
            // glowSphere.scale.set(glowPulse, glowPulse, glowPulse);
            
            // renderer.render(scene, camera);
            //NEW –– BLOOM IMPLEMENTATION
            composer.render();

        }

        animate();
