"use client";

import { useRef, useMemo, useCallback, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Text, Environment } from "@react-three/drei";
import * as THREE from "three";
import { FRANCHISES_2027 } from "@/data/teams/franchises";

type Props = {
  tension: number;
  phase: string;
  accentColor: string;
  currentBid: number;
  highestBidder: string | null;
  isSold: boolean;
  isPassed: boolean;
};

const TEAM_POSITIONS: [number, number, number][] = [
  [-4.2, 0.15, 1.8],
  [-3.0, 0.15, 2.8],
  [-1.5, 0.15, 3.4],
  [0, 0.15, 3.6],
  [1.5, 0.15, 3.4],
  [3.0, 0.15, 2.8],
  [4.2, 0.15, 1.8],
  [-3.6, 0.15, 0.4],
  [3.6, 0.15, 0.4],
  [0, 0.15, 2.2],
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = hex.replace("#", "");
  const v = Number.parseInt(n.length === 3 ? n.split("").map((c) => c + c).join("") : n, 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function CameraController({ tension, isSold }: { tension: number; isSold: boolean }) {
  const { camera } = useThree();
  const basePos = useRef(new THREE.Vector3(0, 4.5, 6.5));
  const shakeOffset = useRef(new THREE.Vector3());
  const soldBurst = useRef(0);

  useEffect(() => {
    if (isSold) soldBurst.current = 1.0;
  }, [isSold]);

  useFrame((_, delta) => {
    const intensity = tension / 100;
    const shakeAmount = intensity * 0.04;
    const time = performance.now() * 0.001;
    shakeOffset.current.set(
      Math.sin(time * 7.3) * shakeAmount,
      Math.sin(time * 5.1) * shakeAmount * 0.5,
      Math.sin(time * 9.7) * shakeAmount * 0.3
    );

    const zoomFactor = isSold ? 0.85 : 1;
    const targetPos = basePos.current.clone().multiplyScalar(zoomFactor).add(shakeOffset.current);

    camera.position.lerp(targetPos, 0.03);
    camera.lookAt(0, 1.2, 1.0);

    if (soldBurst.current > 0) {
      soldBurst.current = Math.max(0, soldBurst.current - delta * 1.5);
    }
  });

  return null;
}

function AuctionFloor() {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-6, 0);
    shape.lineTo(6, 0);
    shape.lineTo(6, 5);
    shape.quadraticCurveTo(0, 5.8, -6, 5);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape, 32);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} position={[0, -0.01, 0.5]} receiveShadow>
        <meshStandardMaterial color="#0a1a1f" roughness={0.85} metalness={0.15} />
      </mesh>
      <mesh position={[0, -0.02, 2]} receiveShadow>
        <ringGeometry args={[5.5, 8, 64, 1, 0, Math.PI]} />
        <meshStandardMaterial color="#061215" roughness={0.9} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>
      {[...Array(24)].map((_, i) => {
        const angle = (i / 24) * Math.PI - Math.PI * 0.5;
        return (
          <mesh key={`line-${i}`} position={[Math.cos(angle) * 5, 0.001, Math.sin(angle) * 3 + 2]}>
            <boxGeometry args={[0.005, 0.001, 3.5]} />
            <meshStandardMaterial color="#1a3a42" transparent opacity={0.25} />
          </mesh>
        );
      })}
    </group>
  );
}

function Stage() {
  return (
    <group position={[0, 0, 0.5]}>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.4, 1.6, 0.5, 32]} />
        <meshStandardMaterial color="#0f2530" roughness={0.7} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.52, 0]} castShadow>
        <cylinderGeometry args={[1.0, 1.0, 0.05, 32]} />
        <meshStandardMaterial color="#1a4050" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[1.65, 1.7, 0.06, 32]} />
        <meshStandardMaterial color="#0d1e25" roughness={0.8} />
      </mesh>
      <Auctioneer />
      <PriceDisplay />
    </group>
  );
}

function Auctioneer() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.15;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.6, 0]}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <capsuleGeometry args={[0.12, 0.3, 8, 16]} />
        <meshStandardMaterial color="#1a2a35" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshStandardMaterial color="#2a3a48" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.75, 0.15]} castShadow>
        <boxGeometry args={[0.5, 0.02, 0.3]} />
        <meshStandardMaterial color="#0d1e25" roughness={0.6} metalness={0.3} />
      </mesh>
    </group>
  );
}

function PriceDisplay() {
  const { currentBid, tension } = useSceneProps();
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = 1.8 + Math.sin(state.clock.elapsedTime * 2) * 0.03;
    }
  });

  const formatted = currentBid >= 100 ? `${(currentBid / 100).toFixed(1)} Cr` : `₹${currentBid} L`;

  return (
    <group ref={groupRef} position={[0, 1.8, 0]}>
      <Html center distanceFactor={6} transform occlude={false}>
        <div style={{
          background: "linear-gradient(135deg, rgba(0,20,30,0.95), rgba(10,30,40,0.95))",
          border: `2px solid ${tension > 70 ? "#e27a47" : tension > 40 ? "#69dcce" : "#1a4050"}`,
          borderRadius: "12px",
          padding: "8px 20px",
          color: tension > 70 ? "#e27a47" : "#69dcce",
          fontSize: "28px",
          fontFamily: "'Orbitron', monospace",
          fontWeight: "bold",
          textShadow: `0 0 20px ${tension > 70 ? "rgba(226,122,71,0.6)" : "rgba(105,220,206,0.4)"}`,
          whiteSpace: "nowrap",
          letterSpacing: "2px",
        }}>
          {formatted}
        </div>
      </Html>
    </group>
  );
}

let scenePropsContext: Props = {
  tension: 0,
  phase: "idle",
  accentColor: "#69dcce",
  currentBid: 0,
  highestBidder: null,
  isSold: false,
  isPassed: false,
};

function useSceneProps() {
  return scenePropsContext;
}

function FranchiseTables() {
  const { accentColor, highestBidder } = useSceneProps();
  const userIndex = useMemo(() => {
    const userTeam = FRANCHISES_2027.find((t) => t.color === accentColor);
    return userTeam ? FRANCHISES_2027.indexOf(userTeam) : 0;
  }, [accentColor]);

  return (
    <group>
      {FRANCHISES_2027.map((team, i) => {
        const pos = TEAM_POSITIONS[i] ?? [0, 0.15, 3];
        const isUser = i === userIndex;
        const isActive = highestBidder === team.id;
        return (
          <FranchiseTable
            key={team.id}
            position={pos as [number, number, number]}
            color={team.color}
            isUser={isUser}
            isActive={isActive}
            teamId={team.id}
          />
        );
      })}
    </group>
  );
}

function FranchiseTable({
  position,
  color,
  isUser,
  isActive,
  teamId,
}: {
  position: [number, number, number];
  color: string;
  isUser: boolean;
  isActive: boolean;
  teamId: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const rgb = useMemo(() => hexToRgb(color), [color]);
  const baseEmissive = useMemo(() => new THREE.Color(rgb.r / 255, rgb.g / 255, rgb.b / 255), [rgb]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.elapsedTime;
    if (isUser) {
      const pulse = (Math.sin(time * 3) + 1) / 2;
      groupRef.current.scale.setScalar(1 + pulse * 0.06);
    } else {
      groupRef.current.scale.setScalar(1);
    }
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial;
      const targetIntensity = isActive ? 1.5 : isUser ? 0.6 + Math.sin(time * 2) * 0.2 : 0.15;
      mat.emissiveIntensity += (targetIntensity - mat.emissiveIntensity) * 0.08;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.02, 0.35]} />
        <meshStandardMaterial color="#0d1e25" roughness={0.8} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.08, 0]} castShadow>
        <boxGeometry args={[0.04, 0.08, 0.04]} />
        <meshStandardMaterial color="#1a2a35" roughness={0.9} />
      </mesh>
      <mesh ref={glowRef} position={[0, 0.131, 0]}>
        <boxGeometry args={[0.56, 0.005, 0.31]} />
        <meshStandardMaterial
          color={color}
          emissive={baseEmissive}
          emissiveIntensity={0.15}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>
      {isUser && (
        <Html position={[0, 0.35, 0]} center distanceFactor={8} style={{ pointerEvents: "none" }}>
          <div style={{
            background: "rgba(0,20,30,0.85)",
            border: `1px solid ${color}`,
            borderRadius: "6px",
            padding: "2px 8px",
            color: "#fff",
            fontSize: "9px",
            fontFamily: "monospace",
            whiteSpace: "nowrap",
            letterSpacing: "1px",
          }}>
            YOUR TEAM
          </div>
        </Html>
      )}
      <Html position={[0, 0.25, 0]} center distanceFactor={10} style={{ pointerEvents: "none" }}>
        <div style={{
          color: "rgba(255,255,255,0.5)",
          fontSize: "7px",
          fontFamily: "monospace",
          letterSpacing: "1px",
          whiteSpace: "nowrap",
        }}>
          {teamId}
        </div>
      </Html>
    </group>
  );
}

function Lighting({ tension, accentColor, highestBidder, isSold }: Props) {
  const spotRef = useRef<THREE.SpotLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const accentRef1 = useRef<THREE.PointLight>(null);
  const accentRef2 = useRef<THREE.PointLight>(null);
  const soldBurstRef = useRef<THREE.PointLight>(null);

  useEffect(() => {
    if (isSold && soldBurstRef.current) {
      soldBurstRef.current.intensity = 20;
    }
  }, [isSold]);

  useFrame((state) => {
    const intensity = tension / 100;
    const time = state.clock.elapsedTime;

    if (spotRef.current) {
      spotRef.current.intensity = 4 + intensity * 6;
      const warmth = intensity * 0.3;
      spotRef.current.color.setHSL(0.08 - warmth * 0.08, 0.6 + warmth * 0.3, 0.8 + warmth * 0.1);
    }

    if (ambientRef.current) {
      ambientRef.current.intensity = 0.15 + intensity * 0.1;
    }

    if (accentRef1.current) {
      accentRef1.current.intensity = 1.5 + Math.sin(time * 0.7) * 0.3;
      accentRef1.current.color.lerpColors(
        new THREE.Color(0.41, 0.86, 0.81),
        new THREE.Color(0.89, 0.48, 0.28),
        intensity
      );
    }

    if (accentRef2.current) {
      accentRef2.current.intensity = 1.2 + Math.sin(time * 0.5 + 1) * 0.2;
      accentRef2.current.color.lerpColors(
        new THREE.Color(0.41, 0.86, 0.81),
        new THREE.Color(0.89, 0.48, 0.28),
        intensity * 0.7
      );
    }

    if (soldBurstRef.current) {
      soldBurstRef.current.intensity *= 0.92;
      if (soldBurstRef.current.intensity < 0.1) soldBurstRef.current.intensity = 0;
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.15} color="#1a3a45" />
      <spotLight
        ref={spotRef}
        position={[0, 8, 0.5]}
        angle={0.4}
        penumbra={0.6}
        intensity={4}
        color="#ffe8d0"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight ref={accentRef1} position={[-5, 3, 2]} intensity={1.5} color="#69dcce" distance={12} decay={2} />
      <pointLight ref={accentRef2} position={[5, 3, 2]} intensity={1.2} color="#69dcce" distance={12} decay={2} />
      <pointLight ref={soldBurstRef} position={[0, 5, 1]} intensity={0} color="#ffe8d0" distance={15} decay={1.5} />
      <pointLight position={[0, 2, -1]} intensity={0.5} color="#1a3a45" distance={8} decay={2} />
    </>
  );
}

function ScreenBehindAuctioneer() {
  const { phase, currentBid, highestBidder, accentColor } = useSceneProps();
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.3 + Math.sin(state.clock.elapsedTime * 1.5) * 0.1;
    }
  });

  return (
    <group position={[0, 2.2, -1.2]}>
      <mesh ref={meshRef} castShadow>
        <boxGeometry args={[3.5, 2.0, 0.08]} />
        <meshStandardMaterial
          color="#0a1520"
          emissive="#0d2535"
          emissiveIntensity={0.3}
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <planeGeometry args={[3.3, 1.8]} />
        <meshStandardMaterial
          color="#0a1520"
          emissive={accentColor}
          emissiveIntensity={0.08}
          roughness={0.9}
        />
      </mesh>
      <Html position={[0, 0, 0.1]} center distanceFactor={5} style={{ pointerEvents: "none" }}>
        <div style={{
          width: "280px",
          height: "140px",
          background: "linear-gradient(180deg, rgba(5,15,25,0.95), rgba(10,25,35,0.95))",
          border: "1px solid rgba(105,220,206,0.2)",
          borderRadius: "8px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "12px",
          fontFamily: "monospace",
          color: "#69dcce",
        }}>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "4px", letterSpacing: "2px" }}>
            IPL AUCTION 2027
          </div>
          <div style={{ fontSize: "9px", color: "rgba(105,220,206,0.6)", marginBottom: "8px", letterSpacing: "1px" }}>
            {phase.toUpperCase().replace(/_/g, " ")}
          </div>
          {highestBidder && (
            <div style={{ fontSize: "10px", color: "#e27a47", letterSpacing: "1px" }}>
              HIGHEST: {highestBidder}
            </div>
          )}
          <div style={{ fontSize: "20px", color: "#69dcce", fontWeight: "bold", marginTop: "4px" }}>
            ₹{currentBid} L
          </div>
        </div>
      </Html>
      <mesh position={[0, -1.1, 0.06]}>
        <boxGeometry args={[3.5, 0.06, 0.08]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.4} roughness={0.3} metalness={0.5} />
      </mesh>
    </group>
  );
}

function ConfettiSystem({ active }: { active: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const COUNT = 300;
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: COUNT }, (_, i) => ({
      x: (Math.random() - 0.5) * 8,
      y: Math.random() * 6 + 2,
      z: (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * 0.02,
      vy: -Math.random() * 0.02 - 0.005,
      vz: (Math.random() - 0.5) * 0.02,
      rotX: Math.random() * Math.PI * 2,
      rotY: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.1,
      scale: 0.03 + Math.random() * 0.04,
      color: new THREE.Color().setHSL(Math.random() * 0.15 + 0.05, 0.8, 0.6),
    }));
  }, []);

  const startTime = useRef(0);

  useEffect(() => {
    if (active) startTime.current = performance.now();
  }, [active]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh || !active) return;
    const elapsed = (performance.now() - startTime.current) / 1000;
    if (elapsed > 4) return;

    particles.forEach((p, i) => {
      const gravity = -0.0003;
      p.vy += gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;
      p.rotX += p.rotSpeed;
      p.rotY += p.rotSpeed * 0.7;

      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rotX, p.rotY, 0);
      dummy.scale.setScalar(p.scale * (1 + Math.sin(elapsed * 5 + i) * 0.3));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, p.color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]}>
      <boxGeometry args={[1, 1, 0.2]} />
      <meshStandardMaterial roughness={0.5} metalness={0.3} />
    </instancedMesh>
  );
}

function TensionAmbient({ tension }: { tension: number }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!ref.current) return;
    const intensity = tension / 100;
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.02 + intensity * 0.06;
  });

  return (
    <mesh ref={ref} position={[0, 3, 1]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[8, 32]} />
      <meshBasicMaterial
        color={tension > 60 ? "#e27a47" : "#69dcce"}
        transparent
        opacity={0.04}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function FloorReflection() {
  return (
    <mesh position={[0, -0.03, 1.5]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[14, 10]} />
      <meshStandardMaterial
        color="#081518"
        roughness={0.6}
        metalness={0.4}
        transparent
        opacity={0.4}
      />
    </mesh>
  );
}

function ArenaWalls() {
  const wallData = useMemo(() => [
    { pos: [-6, 2, 1] as [number, number, number], rot: [0, Math.PI / 2, 0] as [number, number, number], size: [6, 4, 0.1] as [number, number, number] },
    { pos: [6, 2, 1] as [number, number, number], rot: [0, -Math.PI / 2, 0] as [number, number, number], size: [6, 4, 0.1] as [number, number, number] },
    { pos: [0, 2, -2.5] as [number, number, number], rot: [0, 0, 0] as [number, number, number], size: [12, 4, 0.1] as [number, number, number] },
  ], []);

  return (
    <group>
      {wallData.map((w, i) => (
        <mesh key={i} position={w.pos} rotation={w.rot} receiveShadow>
          <boxGeometry args={w.size} />
          <meshStandardMaterial color="#0a1518" roughness={0.95} metalness={0.05} />
        </mesh>
      ))}
      <mesh position={[0, 4, 1]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 8]} />
        <meshStandardMaterial color="#060e12" roughness={0.98} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function SeatingArea() {
  const seats = useMemo(() => {
    const result: { pos: [number, number, number]; color: string }[] = [];
    for (let row = 0; row < 3; row++) {
      const radius = 6.5 + row * 0.8;
      const count = 16 + row * 4;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI - Math.PI * 0.5;
        result.push({
          pos: [
            Math.cos(angle) * radius,
            0.4 + row * 0.35,
            Math.sin(angle) * radius * 0.6 + 1.5,
          ],
          color: `hsl(${190 + (i % 5) * 8}, ${20 + (i % 3) * 5}%, ${8 + (row % 2) * 3}%)`,
        });
      }
    }
    return result;
  }, []);

  return (
    <group>
      {seats.map((seat, i) => (
        <mesh key={i} position={seat.pos}>
          <boxGeometry args={[0.15, 0.12, 0.12]} />
          <meshStandardMaterial color={seat.color} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

const SceneContent = (props: Props) => {
  scenePropsContext = props;

  return (
    <>
      <CameraController tension={props.tension} isSold={props.isSold} />
      <Lighting {...props} />
      <AuctionFloor />
      <FloorReflection />
      <Stage />
      <ScreenBehindAuctioneer />
      <FranchiseTables />
      <SeatingArea />
      <ArenaWalls />
      <TensionAmbient tension={props.tension} />
      <ConfettiSystem active={props.isSold} />
      <fog attach="fog" args={["#050c0f", 8, 18]} />
    </>
  );
};

export function Scene3D({ tension, phase, accentColor, currentBid, highestBidder, isSold, isPassed }: Props) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 4.5, 6.5], fov: 50, near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
    >
      <SceneContent
        tension={tension}
        phase={phase}
        accentColor={accentColor}
        currentBid={currentBid}
        highestBidder={highestBidder}
        isSold={isSold}
        isPassed={isPassed}
      />
    </Canvas>
  );
}
