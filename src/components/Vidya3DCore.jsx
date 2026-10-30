import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Vidya3DCore({ onNodeClick }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    const width = currentMount.clientWidth || 500;
    const height = currentMount.clientHeight || 450;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.z = 18;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    currentMount.appendChild(renderer.domElement);

    // Central Glowing AI Core (Icosahedron + Wireframe)
    const coreGroup = new THREE.Group();

    const coreGeo = new THREE.IcosahedronGeometry(3.5, 2);
    const coreMat = new THREE.MeshPhongMaterial({
      color: 0x6366f1,
      emissive: 0x3b82f6,
      wireframe: true,
      transparent: true,
      opacity: 0.85
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreGroup.add(coreMesh);

    // Inner Glowing Core
    const innerGeo = new THREE.SphereGeometry(2.2, 32, 32);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.6
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    coreGroup.add(innerMesh);

    scene.add(coreGroup);

    // Orbiting Learning Nodes
    const nodeLabels = ['GOAL', 'CONTENT', 'TUTOR', 'PRACTICE', 'ASSESS', 'REVISION'];
    const nodesGroup = new THREE.Group();
    const nodesList = [];

    nodeLabels.forEach((label, idx) => {
      const angle = (idx / nodeLabels.length) * Math.PI * 2;
      const radius = 8;
      
      const nodeGeo = new THREE.SphereGeometry(0.7, 16, 16);
      const nodeMat = new THREE.MeshPhongMaterial({
        color: idx % 2 === 0 ? 0xec4899 : 0x10b981,
        emissive: idx % 2 === 0 ? 0xec4899 : 0x10b981,
        emissiveIntensity: 0.5,
        shininess: 100
      });
      const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
      
      nodeMesh.position.x = Math.cos(angle) * radius;
      nodeMesh.position.y = Math.sin(angle) * radius * 0.4;
      nodeMesh.position.z = Math.sin(angle) * radius;
      nodeMesh.userData = { label, angle, radius };

      nodesGroup.add(nodeMesh);
      nodesList.push(nodeMesh);

      // Connecting lines to central core
      const lineMat = new THREE.LineBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.3 });
      const points = [new THREE.Vector3(0, 0, 0), nodeMesh.position];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeo, lineMat);
      coreGroup.add(line);
    });

    scene.add(nodesGroup);

    // Particle Cloud Background
    const particleGeo = new THREE.BufferGeometry();
    const particleCount = 200;
    const posArray = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 35;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.12,
      color: 0x8b5cf6,
      transparent: true,
      opacity: 0.7
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x06b6d4, 2, 50);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    // Mouse Tracking Parallax
    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (e) => {
      const rect = currentMount.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / width - 0.5) * 2;
      mouseY = -((e.clientY - rect.top) / height - 0.5) * 2;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Animation Loop
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Rotate core
      coreMesh.rotation.x = elapsedTime * 0.2;
      coreMesh.rotation.y = elapsedTime * 0.3;

      // Orbit nodes
      nodesList.forEach((node) => {
        const newAngle = node.userData.angle + elapsedTime * 0.4;
        node.position.x = Math.cos(newAngle) * node.userData.radius;
        node.position.z = Math.sin(newAngle) * node.userData.radius;
        node.position.y = Math.sin(newAngle * 2) * 1.5;
      });

      // Mouse Parallax reaction
      coreGroup.rotation.y += (mouseX * 0.5 - coreGroup.rotation.y) * 0.05;
      coreGroup.rotation.x += (-mouseY * 0.5 - coreGroup.rotation.x) * 0.05;

      particles.rotation.y = elapsedTime * 0.05;

      renderer.render(scene, camera);
    };

    animate();

    // Handle Resize
    const handleResize = () => {
      if (!currentMount) return;
      const w = currentMount.clientWidth;
      const h = currentMount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height: '450px',
        position: 'relative',
        cursor: 'pointer'
      }}
    />
  );
}
