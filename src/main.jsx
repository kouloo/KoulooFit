import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Dumbbell, RotateCcw, Search, X, Zap } from "lucide-react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import "./styles.css";

const CATEGORY_LABELS = {
  back: "Dos",
  cardio: "Cardio",
  chest: "Pectoraux",
  lower_arms: "Avant-bras",
  "lower arms": "Avant-bras",
  lower_legs: "Mollets",
  "lower legs": "Mollets",
  neck: "Cou",
  shoulders: "Epaules",
  upper_arms: "Bras",
  "upper arms": "Bras",
  upper_legs: "Jambes",
  "upper legs": "Jambes",
  waist: "Abdominaux",
};

const EQUIPMENT_LABELS = {
  "assisted": "Machine assistee",
  "band": "Elastique",
  "barbell": "Barre",
  "body weight": "Poids du corps",
  "bosu ball": "Bosu",
  "cable": "Poulie",
  "dumbbell": "Haltere",
  "elliptical machine": "Velo elliptique",
  "ez barbell": "Barre EZ",
  "hammer": "Marteau",
  "kettlebell": "Kettlebell",
  "leverage machine": "Machine a levier",
  "medicine ball": "Medecine ball",
  "olympic barbell": "Barre olympique",
  "resistance band": "Bande de resistance",
  "roller": "Rouleau",
  "rope": "Corde",
  "skierg machine": "SkiErg",
  "sled machine": "Traineau",
  "smith machine": "Smith machine",
  "stability ball": "Swiss ball",
  "stationary bike": "Velo fixe",
  "stepmill machine": "StepMill",
  "tire": "Pneu",
  "trap bar": "Trap bar",
  "upper body ergometer": "Ergometre haut du corps",
  "weighted": "Charge additionnelle",
  "wheel roller": "Roue abdominale",
};

const TARGET_LABELS = {
  abs: "Abdominaux",
  abductors: "Abducteurs",
  adductors: "Adducteurs",
  biceps: "Biceps",
  brachialis: "Brachial",
  calves: "Mollets",
  cardiovascular_system: "Systeme cardiovasculaire",
  "cardiovascular system": "Systeme cardiovasculaire",
  delts: "Deltoides",
  forearms: "Avant-bras",
  glutes: "Fessiers",
  hamstrings: "Ischio-jambiers",
  lats: "Grand dorsal",
  levator_scapulae: "Elevateur de la scapula",
  "levator scapulae": "Elevateur de la scapula",
  pectorals: "Pectoraux",
  quads: "Quadriceps",
  serratus_anterior: "Denteles anterieurs",
  "serratus anterior": "Denteles anterieurs",
  spine: "Rachis",
  traps: "Trapezes",
  triceps: "Triceps",
  upper_back: "Haut du dos",
  "upper back": "Haut du dos",
};

const MUSCLE_LABELS = {
  ...TARGET_LABELS,
  "lower back": "Bas du dos",
  "hip flexors": "Flechisseurs de hanche",
  "trapezius": "Trapezes",
  "core": "Centre du corps",
  "shoulders": "Epaules",
  "chest": "Pectoraux",
};

const BODY_ZONES = [
  {
    id: "chest",
    label: "Pectoraux",
    hint: "Pectoraux, presses et mouvements de poussee",
    categories: ["chest"],
    targets: ["pectorals", "serratus anterior"],
    color: "#00e5ff",
  },
  {
    id: "back",
    label: "Dos",
    hint: "Dos, dorsaux, trapezes et rachis",
    categories: ["back"],
    targets: ["lats", "traps", "upper back", "spine"],
    color: "#7c3cff",
  },
  {
    id: "shoulders",
    label: "Epaules",
    hint: "Deltoides et stabilisation de l'epaule",
    categories: ["shoulders"],
    targets: ["delts", "traps"],
    color: "#32ffaa",
  },
  {
    id: "arms",
    label: "Bras",
    hint: "Biceps, triceps, avant-bras",
    categories: ["upper arms", "lower arms"],
    targets: ["biceps", "triceps", "forearms", "brachialis"],
    color: "#ffb020",
  },
  {
    id: "waist",
    label: "Abdominaux",
    hint: "Gainage, abdominaux et centre du corps",
    categories: ["waist"],
    targets: ["abs"],
    color: "#ff2f7d",
  },
  {
    id: "legs",
    label: "Jambes",
    hint: "Quadriceps, ischios, fessiers, adducteurs",
    categories: ["upper legs"],
    targets: ["quads", "hamstrings", "glutes", "adductors", "abductors"],
    color: "#00a7ff",
  },
  {
    id: "calves",
    label: "Mollets",
    hint: "Mollets et bas des jambes",
    categories: ["lower legs"],
    targets: ["calves"],
    color: "#8dfcff",
  },
  {
    id: "neck",
    label: "Cou",
    hint: "Cou et elevation scapulaire",
    categories: ["neck"],
    targets: ["levator scapulae"],
    color: "#d7ff62",
  },
  {
    id: "cardio",
    label: "Cardio",
    hint: "Systeme cardiovasculaire",
    categories: ["cardio"],
    targets: ["cardiovascular system"],
    color: "#ff6a3d",
  },
];

const BODY_ZONE_BY_ID = Object.fromEntries(BODY_ZONES.map((zone) => [zone.id, zone]));

function normalizeKey(value) {
  return String(value || "").toLowerCase().replaceAll("_", " ").trim();
}

function labelFor(value, map) {
  const key = normalizeKey(value);
  return map[key] || key.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function uniqueSorted(items, selector) {
  return [...new Set(items.map(selector).filter(Boolean))].sort((a, b) =>
    labelFor(a, {}).localeCompare(labelFor(b, {}), "fr"),
  );
}

function assetPath(path) {
  if (!path) return "";
  return path.startsWith("/") ? path : `/${path}`;
}

function getFrenchSteps(exercise, translations) {
  const translated = translations[exercise.id];
  if (translated?.steps?.length) return translated.steps;
  if (translated?.description) return [translated.description];
  if (exercise.instruction_steps?.fr?.length) return exercise.instruction_steps.fr;
  if (exercise.description_fr) return [exercise.description_fr];
  return [
    "Description francaise en attente de traduction.",
    "La fiche conserve les medias, les filtres et les donnees JSON d'origine.",
  ];
}

function App() {
  const [exercises, setExercises] = useState([]);
  const [translations, setTranslations] = useState({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ bodyZone: "", equipment: "" });
  const [selected, setSelected] = useState(null);
  const [visibleCount, setVisibleCount] = useState(72);

  useEffect(() => {
    fetch("/data/exercises.json")
      .then((response) => {
        if (!response.ok) throw new Error("Impossible de charger les exercices.");
        return response.json();
      })
      .then(setExercises)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/data/exercise-translations.fr.json")
      .then((response) => (response.ok ? response.json() : {}))
      .then(setTranslations)
      .catch(() => setTranslations({}));
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      if (import.meta.env.PROD) {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
        return;
      }

      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys
            .filter((key) => key.startsWith("kouloofit-"))
            .forEach((key) => caches.delete(key));
        });
      }
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selected]);

  const facets = useMemo(
    () => ({
      equipment: uniqueSorted(exercises, (item) => item.equipment),
    }),
    [exercises],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const bodyZone = BODY_ZONE_BY_ID[filters.bodyZone];
    return exercises.filter((item) => {
      const matchesSearch =
        !needle ||
        [item.name, item.category, item.equipment, item.target, item.muscle_group]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      const matchesBody =
        !bodyZone ||
        bodyZone.categories.includes(normalizeKey(item.category)) ||
        bodyZone.targets.includes(normalizeKey(item.target));
      return (
        matchesSearch &&
        matchesBody &&
        (!filters.equipment || item.equipment === filters.equipment)
      );
    });
  }, [exercises, filters, query]);

  useEffect(() => {
    setVisibleCount(72);
  }, [filters, query]);

  const visibleExercises = filtered.slice(0, visibleCount);
  const hasFilters = query || filters.bodyZone || filters.equipment;

  function toggleFilter(type, value) {
    setFilters((current) => ({ ...current, [type]: current[type] === value ? "" : value }));
  }

  function resetFilters() {
    setQuery("");
    setFilters({ bodyZone: "", equipment: "" });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">
            <Zap size={20} />
          </div>
          <div>
            <h1>KoulooFit</h1>
          </div>
        </div>

        <div className="search-box">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un exercice"
            aria-label="Rechercher un exercice"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Effacer la recherche">
              <X size={15} />
            </button>
          )}
        </div>

        <BodyPicker3D
          activeZoneId={filters.bodyZone}
          onSelect={(zoneId) => toggleFilter("bodyZone", zoneId)}
        />
        <FilterGroup
          icon={<Dumbbell size={16} />}
          title="Equipement"
          values={facets.equipment}
          active={filters.equipment}
          labels={EQUIPMENT_LABELS}
          onSelect={(value) => toggleFilter("equipment", value)}
        />

        <button className="reset-button" type="button" onClick={resetFilters} disabled={!hasFilters}>
          <RotateCcw size={15} />
          Reinitialiser
        </button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h2>{filtered.length.toLocaleString("fr-FR")} exercices</h2>
          </div>
        </header>

        {loading ? (
          <div className="empty-state">Chargement des exercices...</div>
        ) : visibleExercises.length === 0 ? (
          <div className="empty-state">Aucun exercice ne correspond aux filtres.</div>
        ) : (
          <>
            <section className="exercise-grid" aria-label="Liste des exercices">
              {visibleExercises.map((exercise) => (
                <button
                  type="button"
                  className="exercise-card"
                  key={exercise.id}
                  onClick={() => setSelected(exercise)}
                >
                  <img src={assetPath(exercise.image)} alt="" loading="lazy" />
                  <div className="card-body">
                    <h3>{exercise.name}</h3>
                    <p>{labelFor(exercise.category, CATEGORY_LABELS)}</p>
                    <div className="card-tags">
                      <span>{labelFor(exercise.equipment, EQUIPMENT_LABELS)}</span>
                      <span>{labelFor(exercise.target, TARGET_LABELS)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </section>
            {visibleCount < filtered.length && (
              <button
                className="load-more"
                type="button"
                onClick={() => setVisibleCount((count) => count + 72)}
              >
                Afficher plus
              </button>
            )}
          </>
        )}
      </main>

      {selected && (
        <ExerciseModal
          exercise={selected}
          translations={translations}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function BodyPicker3D({ activeZoneId, onSelect }) {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const partsRef = useRef([]);
  const hoveredRef = useRef(null);
  const activeRef = useRef(activeZoneId);
  const onSelectRef = useRef(onSelect);
  const activeZone = BODY_ZONE_BY_ID[activeZoneId];

  useEffect(() => {
    activeRef.current = activeZoneId;
    updateBodyMaterials(partsRef.current, hoveredRef.current, activeRef.current);
  }, [activeZoneId]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, -0.12, 10.6);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x8fb6ff, 1.35));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(4, 5, 5);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x00e5ff, 18, 12);
    rimLight.position.set(-3, 2.4, 3.8);
    scene.add(rimLight);

    const body = new THREE.Group();
    scene.add(body);
    partsRef.current = createBodyParts(body);
    loadHumanObj(body);
    let userRotationY = 0;
    let userRotationX = 0;
    let dragging = false;
    let suppressClick = false;
    let lastPointer = { x: 0, y: 0 };
    let startPointer = { x: 0, y: 0 };

    const grid = new THREE.GridHelper(5, 10, 0x00e5ff, 0x1e3552);
    grid.position.y = -2.75;
    grid.material.transparent = true;
    grid.material.opacity = 0.22;
    scene.add(grid);

    const haloGeometry = new THREE.TorusGeometry(1.58, 0.012, 8, 96);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.28,
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    halo.position.y = -2.68;
    halo.rotation.x = Math.PI / 2;
    scene.add(halo);

    function resize() {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    function pick(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      const intersections = raycasterRef.current.intersectObjects(partsRef.current, false);
      return intersections[0]?.object || null;
    }

    function handlePointerMove(event) {
      if (dragging) {
        const deltaX = event.clientX - lastPointer.x;
        const deltaY = event.clientY - lastPointer.y;
        userRotationY += deltaX * 0.012;
        userRotationX = THREE.MathUtils.clamp(userRotationX + deltaY * 0.006, -0.42, 0.42);
        lastPointer = { x: event.clientX, y: event.clientY };
        suppressClick =
          suppressClick ||
          Math.abs(event.clientX - startPointer.x) > 4 ||
          Math.abs(event.clientY - startPointer.y) > 4;
      }

      const picked = pick(event);
      hoveredRef.current = picked?.userData.zoneId || null;
      renderer.domElement.style.cursor = dragging ? "grabbing" : picked ? "grab" : "default";
      updateBodyMaterials(partsRef.current, hoveredRef.current, activeRef.current);
    }

    function handlePointerLeave() {
      dragging = false;
      hoveredRef.current = null;
      renderer.domElement.style.cursor = "default";
      updateBodyMaterials(partsRef.current, hoveredRef.current, activeRef.current);
    }

    function handlePointerDown(event) {
      dragging = true;
      suppressClick = false;
      lastPointer = { x: event.clientX, y: event.clientY };
      startPointer = { x: event.clientX, y: event.clientY };
      renderer.domElement.setPointerCapture?.(event.pointerId);
      renderer.domElement.style.cursor = "grabbing";
    }

    function handlePointerUp(event) {
      dragging = false;
      renderer.domElement.releasePointerCapture?.(event.pointerId);
      const picked = pick(event);
      renderer.domElement.style.cursor = picked ? "grab" : "default";
    }

    function handleClick(event) {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      const picked = pick(event);
      if (!picked) return;
      const zoneId = picked.userData.zoneId;
      onSelectRef.current(zoneId);
    }

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointercancel", handlePointerUp);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
    renderer.domElement.addEventListener("click", handleClick);

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    let frame = 0;
    function animate() {
      frame = requestAnimationFrame(animate);
      body.rotation.x = userRotationX;
      body.rotation.y = userRotationY + Math.sin(performance.now() * 0.00045) * 0.08;
      halo.rotation.z += 0.008;
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointercancel", handlePointerUp);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      renderer.domElement.removeEventListener("click", handleClick);
      mount.removeChild(renderer.domElement);
      partsRef.current.forEach((part) => {
        part.geometry.dispose();
        part.material.dispose();
      });
      haloGeometry.dispose();
      haloMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <section className="body-picker" aria-label="Filtrer avec le corps 3D">
      <div className="body-canvas-wrap" ref={mountRef} />
      <div className="body-zone-panel">
        <p>{activeZone ? activeZone.label : "Tout le corps"}</p>
        <span>{activeZone ? activeZone.hint : "Clique sur une zone du modele pour filtrer."}</span>
      </div>
    </section>
  );
}

function createBodyParts(group) {
  const parts = [];
  const hitboxYOffset = 0.28;
  const armSpreadAngle = THREE.MathUtils.degToRad(20);
  const legSpreadAngle = THREE.MathUtils.degToRad(5);

  function addPart(zoneId, geometry, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
    const zone = BODY_ZONE_BY_ID[zoneId];
    const material = new THREE.MeshStandardMaterial({
      color: zone.color,
      emissive: zone.color,
      emissiveIntensity: 0.12,
      roughness: 0.42,
      metalness: 0.18,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0], position[1] + hitboxYOffset, position[2]);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    mesh.userData.zoneId = zoneId;
    mesh.renderOrder = 2;
    group.add(mesh);
    parts.push(mesh);
    return mesh;
  }

  addPart("neck", new THREE.SphereGeometry(0.22, 32, 18), [0, 1.98, 0], [0.96, 0.9, 0.86]);
  addPart("neck", new THREE.CapsuleGeometry(0.15, 0.38, 8, 24), [0, 1.56, 0]);
  addPart("chest", new THREE.CapsuleGeometry(0.56, 0.72, 18, 36), [0, 0.64, 0], [0.98, 1, 0.52]);
  addPart("back", new THREE.CapsuleGeometry(0.62, 1.0, 18, 36), [0, 0.7, -0.22], [1, 1, 0.38]);
  addPart("waist", new THREE.CapsuleGeometry(0.43, 0.72, 16, 32), [0, -0.2, 0], [0.96, 1, 0.5]);
  addPart("shoulders", new THREE.CapsuleGeometry(0.16, 0.76, 10, 24), [-0.52, 1.34, 0], [1, 1, 0.9], [0, 0, Math.PI / 2]);
  addPart("shoulders", new THREE.CapsuleGeometry(0.16, 0.76, 10, 24), [0.52, 1.34, 0], [1, 1, 0.9], [0, 0, Math.PI / 2]);
  addPart("arms", new THREE.CapsuleGeometry(0.15, 0.9, 10, 24), [-0.9, 0.62, 0], [1, 1, 0.9], [0, 0, -0.14 - armSpreadAngle]);
  addPart("arms", new THREE.CapsuleGeometry(0.15, 0.9, 10, 24), [0.9, 0.62, 0], [1, 1, 0.9], [0, 0, 0.14 + armSpreadAngle]);
  addPart("arms", new THREE.CapsuleGeometry(0.13, 0.84, 10, 24), [-0.98, -0.24, 0], [1, 1, 0.9], [0, 0, 0.08 - armSpreadAngle]);
  addPart("arms", new THREE.CapsuleGeometry(0.13, 0.84, 10, 24), [0.98, -0.24, 0], [1, 1, 0.9], [0, 0, -0.08 + armSpreadAngle]);
  addPart("legs", new THREE.CapsuleGeometry(0.21, 1.14, 12, 28), [-0.3, -1.12, 0.02], [0.9, 1, 0.78], [0, 0, 0.04 + legSpreadAngle]);
  addPart("legs", new THREE.CapsuleGeometry(0.21, 1.14, 12, 28), [0.3, -1.12, 0.02], [0.9, 1, 0.78], [0, 0, -0.04 - legSpreadAngle]);
  addPart("calves", new THREE.CapsuleGeometry(0.15, 0.9, 10, 24), [-0.39, -2.24, 0.01], [0.86, 1, 0.74], [0, 0, 0.02 + legSpreadAngle * 0.35]);
  addPart("calves", new THREE.CapsuleGeometry(0.15, 0.9, 10, 24), [0.39, -2.24, 0.01], [0.86, 1, 0.74], [0, 0, -0.02 - legSpreadAngle * 0.35]);
  addPart("cardio", new THREE.SphereGeometry(0.14, 24, 16), [0.18, 1.12, 0.36], [0.95, 1.1, 0.72]);

  updateBodyMaterials(parts, null, null);
  return parts;
}

function updateBodyMaterials(parts, hoveredZoneId, activeZoneId) {
  parts.forEach((part) => {
    const zone = BODY_ZONE_BY_ID[part.userData.zoneId];
    const isActive = activeZoneId === zone.id;
    const isHovered = hoveredZoneId === zone.id;
    part.material.color.set(zone.color);
    part.material.emissive.set(zone.color);
    part.material.emissiveIntensity = isActive ? 0.62 : isHovered ? 0.42 : 0.08;
    part.material.opacity =
      zone.id === "cardio" ? 0 : isActive ? 0.28 : isHovered ? 0.22 : 0;
    part.scale.multiplyScalar(1);
  });
}

function loadHumanObj(group) {
  const loader = new OBJLoader();
  loader.load(
    "/models/Man.obj",
    (object) => {
      object.name = "KoulooFitManObj";
      object.traverse((child) => {
        if (!child.isMesh) return;
        child.geometry.computeVertexNormals();
        child.material = new THREE.MeshStandardMaterial({
          color: 0xdde8f2,
          emissive: 0x0a2530,
          emissiveIntensity: 0.1,
          roughness: 0.36,
          metalness: 0.12,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide,
        });
        child.renderOrder = 1;
      });

      const initialBox = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      initialBox.getSize(size);
      const scale = size.y > 0 ? 5.55 / size.y : 1;
      object.scale.setScalar(scale);

      const box = new THREE.Box3().setFromObject(object);
      const center = new THREE.Vector3();
      box.getCenter(center);
      object.position.sub(center);
      object.rotation.y = 0;
      object.renderOrder = 1;
      group.add(object);
    },
    undefined,
    () => {
      partsFallbackVisible(group);
    },
  );
}

function partsFallbackVisible(group) {
  group.traverse((child) => {
    if (!child.isMesh || !child.userData.zoneId) return;
    child.material.opacity = 0.28;
  });
}

function FilterGroup({ icon, title, values, active, labels, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? values : values.slice(0, 12);
  return (
    <section className="filter-group">
      <div className="filter-title">
        {icon}
        <span>{title}</span>
      </div>
      <div className="chips">
        {shown.map((value) => (
          <button
            type="button"
            className={`chip ${active === value ? "active" : ""}`}
            key={value}
            onClick={() => onSelect(value)}
          >
            {labelFor(value, labels)}
          </button>
        ))}
        {values.length > 12 && (
          <button type="button" className="chip ghost" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "Voir moins" : `+${values.length - 12}`}
          </button>
        )}
      </div>
    </section>
  );
}

function ExerciseModal({ exercise, translations, onClose }) {
  const secondaryMuscles = (exercise.secondary_muscles || [])
    .filter((muscle) => normalizeKey(muscle) !== normalizeKey(exercise.target));
  const steps = getFrenchSteps(exercise, translations);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={onClose}>
      <article className="modal-panel" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title" id="modal-title">
            {exercise.name}
          </h2>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        <div className="modal-media">
          <img className="modal-gif" src={assetPath(exercise.image)} alt={exercise.name} />
        </div>

        <div className="modal-meta">
          <MetaChip label="Categorie" value={labelFor(exercise.body_part || exercise.category, CATEGORY_LABELS)} />
          <MetaChip label="Equipement" value={labelFor(exercise.equipment, EQUIPMENT_LABELS)} />
          <MetaChip label="Cible" value={labelFor(exercise.target, TARGET_LABELS)} />
        </div>

        <div className="modal-muscles">
          <span className="modal-section-label">Muscles</span>
          <div className="muscles-grid">
            <MuscleGroup title="Principal" muscles={[exercise.target].filter(Boolean)} primary />
            <MuscleGroup title="Secondaires" muscles={secondaryMuscles} />
          </div>
        </div>

        <div className="modal-instructions">
          <span className="modal-section-label">Description</span>
          <ol className="instructions-list">
            {steps.map((step, index) => (
              <li key={`${exercise.id}-${index}`}>{step}</li>
            ))}
          </ol>
        </div>
      </article>
    </div>
  );
}

function MetaChip({ label, value }) {
  return (
    <div className="meta-chip">
      <span className="meta-chip-label">{label}</span>
      <span className="meta-chip-value">{value}</span>
    </div>
  );
}

function MuscleGroup({ title, muscles, primary = false }) {
  return (
    <div className="muscles-group">
      <span className="muscles-group-label">{title}</span>
      <div className="muscle-tags">
        {muscles.length ? (
          muscles.map((muscle) => (
            <span className={`muscle-tag ${primary ? "primary" : ""}`} key={muscle}>
              {labelFor(muscle, MUSCLE_LABELS)}
            </span>
          ))
        ) : (
          <span className="muscle-tag muted">Non precise</span>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
