import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function LearningGalaxy3D({ onSelectTopic }) {
  const mountRef = useRef(null);
  const [activeTopic, setActiveTopic] = useState(null);

  const sampleTopics = [
    { id: 1, name: 'Electrostatics & Capacitance', subject: 'Physics', mastery: 54, status: 'weak', x: -4, y: 2, z: 1, color: 0xef4444, rec: 'Revise dielectric energy equations & complete 8 numericals' },
    { id: 2, name: 'Differential & Integral Calculus', subject: 'Mathematics', mastery: 88, status: 'mastered', x: 5, y: 3, z: -2, color: 0x10b981, rec: 'Mastery high! Try advanced JEE calculus challenge test' },
    { id: 3, name: 'Chemical Bonding & Structure', subject: 'Chemistry', mastery: 76, status: 'strong', x: 2, y: -4, z: 3, color: 0x06b6d4, rec: 'Review VSEPR molecular geometry flashcards' },
    { id: 4, name: 'Current Electricity & Magnetism', subject: 'Physics', mastery: 65, status: 'learning', x: -5, y: -3, z: -1, color: 0xa855f7, rec: 'Practice Kirchhoff circuit law problem set' },
    { id: 5, name: 'Genetics & Pedigree Analysis', subject: 'Biology', mastery: 92, status: 'mastered', x: 6, y: -2, z: 4, color: 0x10b981, rec: 'Maintain streak with 5-minute active recall quiz' }
  ];

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    const width = currentMount.clientWidth || 600;
    const height = currentMount.clientHeight || 450;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.z = 16;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    currentMount.appendChild(renderer.domElement);

    const galaxyGroup = new THREE.Group();
    const meshList = [];

    // Create 3D Nodes for each topic
    sampleTopics.forEach((top) => {
      const geo = new THREE.SphereGeometry(1.2, 32, 32);
      const mat = new THREE.MeshPhongMaterial({
        color: top.color,
        emissive: top.color,
        emissiveIntensity: 0.6,
        shininess: 100
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(top.x, top.y, top.z);
      mesh.userData = top;
      galaxyGroup.add(mesh);
      meshList.push(mesh);

      // Create glowing ring around weak nodes
      if (top.status === 'weak') {
        const ringGeo = new THREE.RingGeometry(1.6, 1.8, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(top.x, top.y, top.z);
        galaxyGroup.add(ring);
      }
    });

    // Prerequisite Connector Lines
    const lineMat = new THREE.LineDashedMaterial({ color: 0x6366f1, dashSize: 0.5, gapSize: 0.2 });
    for (let i = 0; i < sampleTopics.length - 1; i++) {
      const p1 = new THREE.Vector3(sampleTopics[i].x, sampleTopics[i].y, sampleTopics[i].z);
      const p2 = new THREE.Vector3(sampleTopics[i+1].x, sampleTopics[i+1].y, sampleTopics[i+1].z);
      const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const line = new THREE.Line(lineGeo, lineMat);
      galaxyGroup.add(line);
    }

    scene.add(galaxyGroup);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x3b82f6, 1.5);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // Raycaster for 3D Node Clicks
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleCanvasClick = (event) => {
      const rect = currentMount.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(meshList);

      if (intersects.length > 0) {
        const clickedData = intersects[0].object.userData;
        setActiveTopic(clickedData);
        if (onSelectTopic) onSelectTopic(clickedData);
      }
    };

    currentMount.addEventListener('click', handleCanvasClick);

    // Animation Loop
    let animationId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      galaxyGroup.rotation.y = elapsed * 0.15;
      meshList.forEach((m, idx) => {
        m.position.y += Math.sin(elapsed * 2 + idx) * 0.005;
      });

      renderer.render(scene, camera);
    };

    animate();

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
      cancelAnimationFrame(animationId);
      if (currentMount) currentMount.removeEventListener('click', handleCanvasClick);
      window.removeEventListener('resize', handleResize);
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '420px', background: 'var(--bg-secondary)', borderRadius: '18px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 16, left: 20, zIndex: 10, pointerEvents: 'none' }}>
        <h4 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fa-solid fa-sparkles" style={{ color: 'var(--accent-purple)' }}></i> 3D Learning Galaxy
        </h4>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Interactive Topic Mastery Graph — Click any 3D node to inspect</p>
      </div>

      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* Node Inspector Modal */}
      {activeTopic && (
        <div style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          left: 20,
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--accent-primary)',
          borderRadius: 14,
          padding: 16,
          zIndex: 20,
          boxShadow: 'var(--shadow-lg)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: activeTopic.status === 'weak' ? '#ef4444' : '#10b981' }}>
              {activeTopic.name} ({activeTopic.subject})
            </span>
            <button className="icon-btn" onClick={() => setActiveTopic(null)} style={{ width: 26, height: 26 }}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div style={{ fontSize: 13, marginBottom: 10 }}>
            <strong>Mastery Level:</strong> {activeTopic.mastery}% • Status: <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{activeTopic.status}</span>
          </div>
          <div style={{ background: 'var(--bg-tertiary)', padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
            🤖 <strong>Vidya AI Recommendation:</strong> {activeTopic.rec}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={() => alert(`Starting Smart Revision for ${activeTopic.name}`)}>
              🚀 Start Topic Revision
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => alert(`Generating 10 practice questions for ${activeTopic.name}`)}>
              🧪 Practice Questions
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
