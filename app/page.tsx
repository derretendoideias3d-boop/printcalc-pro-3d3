'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stage, Center, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { 
  Printer, 
  Box, 
  Zap, 
  DollarSign, 
  Clock, 
  ChevronRight, 
  ChevronLeft, 
  FileText, 
  Settings,
  Layers,
  Thermometer,
  Weight,
  Cpu,
  Info,
  Upload,
  Eye,
  ExternalLink,
  Download,
  Trash2,
  History,
  Save,
  RotateCcw,
  User,
  Share2,
  Truck,
  MessageCircle,
  LogOut,
  LogIn,
  UserPlus,
  Edit2,
  Plus,
  Minus,
  ChevronUp,
  ChevronDown,
  Grid
} from 'lucide-react';
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  doc, 
  updateDoc,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';

// --- 3D Viewer Component ---

const Model = ({ url, type }: { url: string, type: string | null }) => {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    if (!url) return;
    
    if (type === 'stl') {
      const loader = new STLLoader();
      loader.load(url, (geo) => {
        geo.computeVertexNormals();
        setGeometry(geo);
      });
    } else if (type === 'gcode') {
      fetch(url).then(r => r.text()).then(text => {
        const lines = text.split('\n');
        const points: THREE.Vector3[] = [];
        let x = 0, y = 0, z = 0;
        
        lines.forEach(line => {
          if (line.startsWith('G0') || line.startsWith('G1')) {
            const mx = line.match(/X([\d.-]+)/);
            const my = line.match(/Y([\d.-]+)/);
            const mz = line.match(/Z([\d.-]+)/);
            if (mx) x = parseFloat(mx[1]);
            if (my) y = parseFloat(my[1]);
            if (mz) z = parseFloat(mz[1]);
            points.push(new THREE.Vector3(x, y, z));
          }
        });
        
        if (points.length > 0) {
          const geo = new THREE.BufferGeometry().setFromPoints(points);
          setGeometry(geo);
        }
      });
    }
  }, [url, type]);

  if (!geometry) return null;

  if (type === 'gcode') {
    return (
      <primitive object={new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: "#3b82f6", opacity: 0.5, transparent: true }))} />
    );
  }

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#3b82f6" roughness={0.3} metalness={0.8} />
    </mesh>
  );
};

const ModelViewer = ({ url, type, imageUrl }: { url: string | null, type: string | null, imageUrl?: string | null }) => {
  if (imageUrl) {
    return (
      <div className="w-full h-64 bg-[#1e2638] rounded-2xl overflow-hidden border border-[#2d374d] relative">
        <Image 
          src={imageUrl} 
          alt="Preview" 
          fill 
          className="object-contain"
          referrerPolicy="no-referrer"
        />
        <div className="absolute bottom-3 right-3 bg-black/40 backdrop-blur-md px-2 py-1 rounded-md text-[8px] font-bold uppercase text-white/60">
          Imagem do Projeto
        </div>
      </div>
    );
  }

  if (!url) return (
    <div className="w-full h-64 bg-[#1e2638] rounded-2xl flex flex-col items-center justify-center border border-dashed border-[#2d374d] text-gray-500">
      <Eye size={32} className="mb-2 opacity-20" />
      <p className="text-xs font-bold uppercase tracking-widest opacity-50">Pré-visualização 3D / Imagem</p>
    </div>
  );

  return (
    <div className="w-full h-64 bg-[#1e2638] rounded-2xl overflow-hidden border border-[#2d374d] relative">
      <Canvas shadows camera={{ position: [0, 0, 150], fov: 50 }}>
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.5}>
            <Center>
              <Model url={url} type={type} />
            </Center>
          </Stage>
        </Suspense>
        <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} />
      </Canvas>
      <div className="absolute bottom-3 right-3 bg-black/40 backdrop-blur-md px-2 py-1 rounded-md text-[8px] font-bold uppercase text-white/60">
        Visualização {type?.toUpperCase()} Ativa
      </div>
    </div>
  );
};

// --- Data Structures ---

const SLICERS = [
  {
    name: "Ultimaker Cura",
    description: "Muito popular e gratuito. Funciona com quase todas as impressoras 3D. Ideal para iniciantes e profissionais.",
    url: "https://ultimaker.com/software/ultimaker-cura",
    protocol: "cura://",
    icon: "C"
  },
  {
    name: "PrusaSlicer",
    description: "Muito usado por usuários avançados. Baseado no antigo Slic3r. Suporta impressoras FDM e também resina.",
    url: "https://www.prusa3d.com/prusaslicer/",
    protocol: "prusaslicer://",
    icon: "P"
  },
  {
    name: "Bambu Studio",
    description: "Fatiador oficial das impressoras Bambu Lab. Otimizado para alta velocidade e AMS (multicolor).",
    url: "https://bambulab.com/en/download/studio",
    protocol: "bambulab://",
    icon: "B"
  },
  {
    name: "Orca Slicer",
    description: "Baseado no Bambu Studio e PrusaSlicer. Muito usado para calibração e impressão multicolor.",
    url: "https://github.com/SoftFever/OrcaSlicer/releases",
    protocol: "orcaslicer://",
    icon: "O"
  },
  {
    name: "Creality Print",
    description: "Fatiador oficial das impressoras Creality. Interface simples para Ender, K1, CR etc.",
    url: "https://www.creality.com/pages/download-software",
    protocol: "crealityprint://",
    icon: "Cr"
  },
  {
    name: "Simplify3D",
    description: "Fatiador profissional pago. Muito controle avançado de impressão.",
    url: "https://www.simplify3d.com/",
    protocol: "simplify3d://",
    icon: "S"
  },
  {
    name: "IdeaMaker",
    description: "Criado pela Raise3D. Interface moderna e fácil de usar.",
    url: "https://www.raise3d.com/ideamaker/",
    protocol: "ideamaker://",
    icon: "I"
  },
  {
    name: "SuperSlicer",
    description: "Versão avançada do PrusaSlicer. Muitas opções de ajuste fino.",
    url: "https://github.com/supermerill/SuperSlicer/releases",
    protocol: "superslicer://",
    icon: "Ss"
  }
];

const FILAMENT_TYPES = {
  "Filamentos básicos": ["PLA", "PLA+", "PLA Silk", "PLA Matte", "PLA High Speed", "PLA Tough"],
  "Filamentos técnicos": ["PETG", "PETG+", "PETG Carbon Fiber", "PETG Glass Fiber"],
  "Filamentos resistentes": ["ABS", "ABS+", "ASA", "HIPS"],
  "Filamentos flexíveis": ["TPU", "TPU 95A", "TPU 85A", "TPE", "TPC"],
  "Filamentos de engenharia": ["Nylon (PA6)", "Nylon (PA12)", "Nylon Carbon Fiber", "Nylon Glass Fiber"],
  "Filamentos reforçados": ["PLA Carbon Fiber", "ABS Carbon Fiber", "PETG Carbon Fiber", "Nylon Carbon Fiber"],
  "Filamentos especiais": ["PVA (solúvel em água)", "BVOH (suporte solúvel)", "HIPS (suporte para ABS)"],
  "Filamentos decorativos": ["Wood (Madeira)", "Metal Fill", "Marble", "Glow in the Dark", "Rainbow", "Glitter"],
  "Filamentos industriais": ["PC (Policarbonato)", "PC-ABS", "PPS", "PEEK", "PEI (Ultem)"]
};

const PRINTER_MODELS: Record<string, string[]> = {
  "Bambu Lab": ["X1 Carbon", "X1", "P1P", "P1S", "A1", "A1 Mini"],
  "Creality": ["Ender 3", "Ender 3 V2", "Ender 3 V3", "Ender 5", "Ender 6", "CR-10", "CR-10 Smart", "K1", "K1 Max"],
  "Anycubic": ["Kobra", "Kobra 2", "Kobra 2 Pro", "Kobra Max", "Vyper"],
  "Prusa Research": ["MK3S+", "MK4", "Mini+", "XL"],
  "Elegoo": ["Neptune 3", "Neptune 4", "Neptune 4 Pro", "Neptune 4 Max"],
  "Artillery": ["Sidewinder X1", "Sidewinder X2", "Sidewinder X3", "Genius"],
  "FlashForge": ["Adventurer 3", "Adventurer 4", "Creator Pro"],
  "Raise3D": ["Pro2", "Pro3", "E2"],
  "Ultimaker": ["S3", "S5", "S7", "2+ Connect"]
};

const BAMBU_PRESETS = [
  { name: "0.08mm Extra Fine", layerHeight: 0.08, wallLoops: 3, topLayers: 6, bottomLayers: 5, infill: 15 },
  { name: "0.12mm Fine", layerHeight: 0.12, wallLoops: 3, topLayers: 5, bottomLayers: 4, infill: 15 },
  { name: "0.16mm Optimal", layerHeight: 0.16, wallLoops: 2, topLayers: 4, bottomLayers: 3, infill: 15 },
  { name: "0.20mm Standard", layerHeight: 0.20, wallLoops: 2, topLayers: 3, bottomLayers: 3, infill: 15 },
  { name: "0.24mm Draft", layerHeight: 0.24, wallLoops: 2, topLayers: 3, bottomLayers: 3, infill: 15 },
  { name: "0.28mm Extra Rough", layerHeight: 0.28, wallLoops: 2, topLayers: 3, bottomLayers: 3, infill: 15 },
];

const PRINTER_BRANDS = Object.keys(PRINTER_MODELS);

const FILAMENT_BRANDS = [
  "Bambu Lab", "eSun", "SUNLU", "Overture", "Hatchbox", "PolyFlow", "Polymaker", "ColorFabb", "Prusament",
  "3D Fila", "Voolt3D", "Cliever", "Filacorp", "UP3D", "GTMax3D", "3DLab", "National 3D", "Tríade3D",
  "Genérico", "Outra"
];

// Default densities (g/cm3)
const DEFAULT_DENSITIES: Record<string, number> = {
  "PLA": 1.24,
  "PLA+": 1.24,
  "PLA Silk": 1.24,
  "PLA Matte": 1.24,
  "PLA High Speed": 1.24,
  "PLA Tough": 1.24,
  "PETG": 1.27,
  "PETG+": 1.27,
  "ABS": 1.04,
  "ABS+": 1.04,
  "ASA": 1.07,
  "TPU": 1.21,
  "TPU 95A": 1.21,
  "TPU 85A": 1.21,
  "Nylon": 1.08,
  "Nylon (PA6)": 1.08,
  "Nylon (PA12)": 1.01,
  "PC": 1.20,
  "HIPS": 1.07,
  "PVA": 1.19,
  "Wood": 1.15,
  "Metal Fill": 2.50,
  "Carbon Fiber": 1.30,
  "Marble": 1.25,
  "PEEK": 1.32,
  "PEI": 1.27,
  "PPS": 1.35,
  "PC-ABS": 1.15,
  "BVOH": 1.14,
  "TPE": 1.15,
  "TPC": 1.20,
};

const DEFAULT_PRINTER_DATA: Record<string, { power: number, speed: number }> = {
  "X1 Carbon": { power: 350, speed: 500 },
  "X1": { power: 350, speed: 500 },
  "P1P": { power: 350, speed: 500 },
  "P1S": { power: 350, speed: 500 },
  "A1": { power: 200, speed: 500 },
  "A1 Mini": { power: 150, speed: 500 },
  "Ender 3": { power: 150, speed: 60 },
  "Ender 3 V2": { power: 150, speed: 60 },
  "Ender 3 V3": { power: 250, speed: 250 },
  "K1": { power: 350, speed: 600 },
  "K1 Max": { power: 350, speed: 600 },
  "MK3S+": { power: 200, speed: 80 },
  "MK4": { power: 200, speed: 200 },
  "Mini+": { power: 150, speed: 80 },
  "XL": { power: 400, speed: 200 },
  "Neptune 4": { power: 250, speed: 250 },
  "Neptune 4 Pro": { power: 250, speed: 250 },
  "Neptune 4 Max": { power: 400, speed: 500 },
  "Sidewinder X2": { power: 250, speed: 100 },
  "Sidewinder X3": { power: 350, speed: 500 },
  "Kobra 2": { power: 250, speed: 250 },
  "Kobra 2 Pro": { power: 350, speed: 500 },
  "Adventurer 4": { power: 250, speed: 150 },
};

// --- Components ---

const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-[#161c2d] border border-[#232d42] rounded-2xl p-5 ${className}`}>
    {children}
  </div>
);

const InputGroup = ({ label, icon: Icon, tooltip, children }: { label: string, icon?: any, tooltip?: string, children: React.ReactNode }) => (
  <div className="space-y-1.5 group/label">
    <label className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1.5 relative">
      {Icon && <Icon size={12} className="text-blue-500" />}
      {label}
      {tooltip && (
        <div className="relative group/tooltip">
          <Info size={10} className="text-gray-600 cursor-help hover:text-blue-400 transition-colors" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[#1e2638] border border-[#2d374d] rounded-lg text-[9px] font-medium text-gray-300 opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
            {tooltip}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#2d374d]" />
          </div>
        </div>
      )}
    </label>
    {children}
  </div>
);

const Select = ({ value, onChange, options, placeholder }: { value: string, onChange: (v: string) => void, options: string[] | {label: string, value: string}[], placeholder?: string }) => (
  <select 
    value={value} 
    onChange={(e) => onChange(e.target.value)}
    className="w-full bg-[#1e2638] border border-[#2d374d] text-white rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer hover:bg-[#1e2638]"
  >
    {placeholder && <option value="">{placeholder}</option>}
    {options.map((opt) => {
      const val = typeof opt === 'string' ? opt : opt.value;
      const label = typeof opt === 'string' ? opt : opt.label;
      return <option key={val} value={val}>{label}</option>;
    })}
  </select>
);

const Input = ({ type = "text", value, onChange, placeholder, suffix }: { type?: string, value: string | number, onChange: (v: string) => void, placeholder?: string, suffix?: string }) => (
  <div className="relative">
    <input 
      type={type}
      value={value === 0 ? '0' : (value || '')}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-[#1e2638] border border-[#2d374d] text-white rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 transition-colors hover:bg-[#1e2638] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
    {suffix && (
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-medium pointer-events-none">
        {suffix}
      </span>
    )}
  </div>
);

export default function Calculator() {
  const [step, setStep] = useState(1);
  
  // --- Auth State ---
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- State ---
  const [filament, setFilament] = useState({
    type: "PLA",
    brand: "Genérico",
    pricePerKg: 120,
    diameter: 1.75,
    density: 1.24, // g/cm³
    temp: 200,
    bedTemp: 60
  });

  const [printer, setPrinter] = useState({
    brand: "Creality",
    model: "Ender 3 V3",
    speed: 250,
    power: 150,
    colors: ""
  });

  const [printSettings, setPrintSettings] = useState({
    layerHeight: 0.2,
    wallLoops: 2,
    topLayers: 3,
    bottomLayers: 3,
    infillDensity: 15,
    infillPattern: "Giroide",
    support: false,
    brim: false,
    nozzleTemp: 220,
    bedTemp: 60
  });

  const [budget, setBudget] = useState({
    id: null as string | null,
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    clientNotes: "",
    fileName: "",
    projectImage: null as string | null,
    items: [
      { id: Date.now().toString(), name: "Peça 1", weight: 0, time: 0, quantity: 1, price: 0, color: "", manualUnitPrice: 0, manualTotalPrice: 0 }
    ],
    energyPrice: 0.85, // R$/kWh
    failRisk: 10, // %
    laborCost: 0,
    packagingCost: 0,
    shippingCost: 0,
    platformFee: 0,
    markup: 40,
    manualMode: false,
    manualFinalPrice: 0
  });

  const [uploadedFile, setUploadedFile] = useState<{ url: string | null, type: string | null }>({ url: null, type: null });

  const downloadConfig = () => {
    const data = JSON.stringify(printSettings, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config_${filament.type}_${printSettings.layerHeight}mm.json`;
    a.click();
  };

  const openSlicer = (protocol: string) => {
    window.location.href = protocol;
  };

  const saveConfig = () => {
    localStorage.setItem('print_config_saved', JSON.stringify(printSettings));
    alert('Configuração salva com sucesso!');
  };

  const loadConfig = () => {
    const saved = localStorage.getItem('print_config_saved');
    if (saved) {
      setPrintSettings(JSON.parse(saved));
      alert('Configuração carregada!');
    } else {
      alert('Nenhuma configuração salva encontrada.');
    }
  };

  const results = useMemo(() => {
    // Helper to calculate price for a single item (unit) including markup
    const calculateItemUnitPrice = (weight: number, time: number) => {
      const mat = (weight / 1000) * filament.pricePerKg;
      const nrg = (time * printer.power / 1000) * budget.energyPrice;
      const wear = time * 0.5; // R$ 0.50 per hour for wear
      const risk = (mat + nrg + wear) * (budget.failRisk / 100);
      const mfg = mat + nrg + wear + risk;
      return mfg * (1 + budget.markup / 100);
    };

    const itemResults = budget.items.map(item => {
      const calculatedUnitPrice = calculateItemUnitPrice(item.weight || 0, item.time || 0);
      const unitPrice = item.manualUnitPrice && item.manualUnitPrice > 0 ? item.manualUnitPrice : calculatedUnitPrice;
      
      const calculatedTotalPrice = unitPrice * (item.quantity || 1);
      const totalPrice = item.manualTotalPrice && item.manualTotalPrice > 0 ? item.manualTotalPrice : calculatedTotalPrice;
      
      return { ...item, unitPrice, totalPrice };
    });

    const totalWeight = budget.items.reduce((sum, item) => sum + ((item.weight || 0) * (item.quantity || 1)), 0);
    const totalTime = budget.items.reduce((sum, item) => sum + ((item.time || 0) * (item.quantity || 1)), 0);
    
    // Total price of all items (manufacturing + markup)
    const totalItemsPrice = itemResults.reduce((sum, item) => sum + item.totalPrice, 0);

    const materialCost = (totalWeight / 1000) * filament.pricePerKg;
    const energyCost = (totalTime * printer.power / 1000) * budget.energyPrice;
    const wearCost = totalTime * 0.5;
    const failRiskCost = (materialCost + energyCost + wearCost) * (budget.failRisk / 100);
    
    const totalMfgCost = materialCost + energyCost + wearCost + failRiskCost + budget.laborCost + budget.packagingCost;
    
    // Fixed costs also get markup
    const fixedCosts = budget.laborCost + budget.packagingCost;
    const fixedCostsWithMarkup = fixedCosts * (1 + budget.markup / 100);
    
    const basePrice = totalItemsPrice + fixedCostsWithMarkup;
    
    const subtotalWithShipping = basePrice + budget.shippingCost;
    const feeAmount = subtotalWithShipping * (budget.platformFee / 100);
    const calculatedFinalPrice = subtotalWithShipping + feeAmount;
    const finalPrice = budget.manualMode ? budget.manualFinalPrice : calculatedFinalPrice;

    return {
      itemResults,
      totalWeight,
      totalTime,
      totalItemsPrice,
      materialCost,
      energyCost,
      wearCost,
      failRiskCost,
      totalMfgCost,
      basePrice,
      feeAmount,
      calculatedFinalPrice,
      finalPrice
    };
  }, [budget, filament, printer]);

  function resetCalculator() {
    setStep(1);
    setFilament({
      type: "PLA",
      brand: "Genérico",
      pricePerKg: 120,
      diameter: 1.75,
      density: 1.24,
      temp: 200,
      bedTemp: 60
    });
    setPrinter({
      brand: "Creality",
      model: "Ender 3 V3",
      speed: 250,
      power: 150,
      colors: ""
    });
    setPrintSettings({
      layerHeight: 0.2,
      wallLoops: 2,
      topLayers: 3,
      bottomLayers: 3,
      infillDensity: 15,
      infillPattern: "Giroide",
      support: false,
      brim: false,
      nozzleTemp: 220,
      bedTemp: 60
    });
    setBudget({
      id: null,
      clientName: "",
      clientPhone: "",
      clientEmail: "",
      clientNotes: "",
      fileName: "",
      projectImage: null,
      items: [
        { id: Date.now().toString(), name: "Peça 1", weight: 0, time: 0, quantity: 1, price: 0, color: "", manualUnitPrice: 0, manualTotalPrice: 0 }
      ],
      energyPrice: 0.85,
      failRisk: 10,
      laborCost: 0,
      packagingCost: 0,
      shippingCost: 0,
      platformFee: 0,
      markup: 40,
      manualMode: false,
      manualFinalPrice: 0
    });
    setUploadedFile({ url: null, type: null });
  }

  const nextStep = () => {
    setStep(prev => Math.min(prev + 1, 4));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBudget(prev => ({ ...prev, fileName: file.name }));

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        setBudget(prev => ({ ...prev, projectImage: url }));
        setUploadedFile({ url, type: 'image' });
      };
      reader.readAsDataURL(file);
    } else if (file.name.toLowerCase().endsWith('.stl')) {
      const url = URL.createObjectURL(file);
      setUploadedFile({ url, type: 'stl' });
    } else if (file.name.toLowerCase().endsWith('.gcode')) {
      const reader = new FileReader();
      const url = URL.createObjectURL(file);
      reader.onload = (event) => {
        const content = event.target?.result as string;
        
        // Simple G-code parsing for weight and time
        // Common patterns:
        // ; filament used [g] = 12.34
        // ; estimated printing time (normal mode) = 1h 23m 45s
        
        let extractedWeight = 0;
        let extractedTime = 0;

        // Weight extraction
        const weightMatch = content.match(/filament used \[g\]\s*=\s*([\d.]+)/i) || 
                           content.match(/filament used\s*:\s*([\d.]+)\s*g/i);
        if (weightMatch) extractedWeight = parseFloat(weightMatch[1]);

        // Time extraction (simplified)
        const timeMatch = content.match(/estimated printing time\s*\(normal mode\)\s*=\s*(.*)/i) ||
                         content.match(/time\s*:\s*(.*)/i);
        if (timeMatch) {
          const timeStr = timeMatch[1];
          const hMatch = timeStr.match(/(\d+)h/);
          const mMatch = timeStr.match(/(\d+)m/);
          const sMatch = timeStr.match(/(\d+)s/);
          
          const hours = hMatch ? parseInt(hMatch[1]) : 0;
          const minutes = mMatch ? parseInt(mMatch[1]) : 0;
          const seconds = sMatch ? parseInt(sMatch[1]) : 0;
          
          extractedTime = hours + (minutes / 60) + (seconds / 3600);
        }

        if (extractedWeight > 0 || extractedTime > 0) {
          setBudget(prev => ({
            ...prev,
            items: [
              { 
                id: Date.now().toString(), 
                name: file.name.replace('.gcode', ''), 
                weight: extractedWeight || prev.items[0].weight, 
                time: extractedTime || prev.items[0].time,
                quantity: 1,
                price: 0,
                color: "",
                manualUnitPrice: 0,
                manualTotalPrice: 0
              }
            ]
          }));
        }
      };
      reader.readAsText(file.slice(0, 100000)); // Read first 100KB for comments
      setUploadedFile({ url, type: 'gcode' });
    } else {
      setUploadedFile({ url: null, type: 'other' });
    }
  };

  const generatePDF = async () => {
    try {
      // Standard imports for jspdf often fail in SSR/Bundled environments
      // Using a more robust dynamic import pattern
      const jsPDFModule = await import('jspdf');
      const jsPDFConstructor = jsPDFModule.jsPDF || jsPDFModule.default;
      
      if (!jsPDFConstructor) {
        throw new Error("Não foi possível carregar a biblioteca PDF.");
      }

      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new (jsPDFConstructor as any)();
      
      // --- Logo Header ---
      doc.setFillColor(37, 99, 235);
      doc.roundedRect(14, 15, 15, 15, 3, 3, 'F');
      
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.8);
      doc.rect(17.5, 21, 8, 5);
      doc.line(19, 21, 19, 18);
      doc.line(24, 21, 24, 18);
      doc.line(19, 18, 24, 18);
      doc.line(19.5, 24, 23.5, 24);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(0, 0, 0);
      doc.text('PRINTCALC', 35, 24);
      
      doc.setTextColor(37, 99, 235);
      doc.text('PRO', 85, 24);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('INTELIGÊNCIA EM CUSTOS 3D', 35, 29);
      doc.text('DERRETENDO IDEIAS 3D', 35, 33);

      // --- Document Info ---
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.text(`CLIENTE: ${(budget.clientName || 'N/A').toUpperCase()}`, 14, 45);
      if (budget.clientPhone) doc.text(`CONTATO: ${budget.clientPhone}`, 14, 50);
      if (budget.clientEmail) doc.text(`E-MAIL: ${budget.clientEmail}`, 14, 55);
      doc.text(`PROJETO: ${(budget.fileName || 'N/A').toUpperCase()}`, 14, 60);
      doc.text(`DATA: ${new Date().toLocaleDateString()}`, 14, 65);

      let currentY = 75;

      // --- Project Image ---
      if (budget.projectImage) {
        try {
          const img = new window.Image();
          img.src = budget.projectImage;
          
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            setTimeout(() => reject(new Error("Timeout loading image")), 3000);
          });
          
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          const base64 = canvas.toDataURL('image/jpeg', 0.7);
          
          const maxWidth = 80;
          const maxHeight = 60;
          let width = img.width;
          let height = img.height;
          
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;

          doc.addImage(base64, 'JPEG', 14, 75, width, height);
          
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text('Referência Visual da Peça', 14, 75 + height + 5);
          
          currentY = 75 + height + 15;
        } catch (e) {
          console.error("Erro ao processar imagem para o PDF", e);
          currentY = 75;
        }
      }

      // --- Items Table ---
      if (typeof autoTable === 'function') {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('PEÇAS DO PROJETO', 14, currentY);
        
        const itemRows = results.itemResults.map((item, index) => [
          index + 1,
          item.name || `Peça ${index + 1}`,
          item.color || '-',
          item.quantity || 1,
          `${item.weight}g`,
          `${item.time}h`,
          `R$ ${item.totalPrice.toFixed(2)}`
        ]);

        autoTable(doc, {
          startY: currentY + 5,
          head: [['#', 'Nome da Peça', 'Cor', 'Qtd', 'Peso', 'Tempo', 'Valor']],
          body: itemRows,
          theme: 'grid',
          headStyles: { fillColor: [100, 100, 100] },
          styles: { fontSize: 8 }
        });

        const lastTable = (doc as any).lastAutoTable;
        currentY = (lastTable && lastTable.finalY) ? lastTable.finalY + 15 : 
                   (lastTable && lastTable.cursor) ? lastTable.cursor.y + 15 : currentY + 40;

        // --- Print Settings Table ---
        autoTable(doc, {
          startY: currentY,
          head: [['Configuração de Impressão', 'Valor']],
          body: [
            ['Altura da Camada', `${printSettings.layerHeight}mm`],
            ['Paredes (Wall Loops)', `${printSettings.wallLoops}`],
            ['Preenchimento (Infill)', `${printSettings.infillDensity}% (${printSettings.infillPattern})`],
            ['Camadas Topo/Base', `${printSettings.topLayers} / ${printSettings.bottomLayers}`],
            ['Suportes', printSettings.support ? 'Sim' : 'Não'],
            ['Brim (Borda)', printSettings.brim ? 'Sim' : 'Não'],
          ],
          theme: 'grid',
          headStyles: { fillColor: [80, 80, 80] },
          styles: { fontSize: 8 },
          margin: { right: 105 } // Half width
        });

        // --- Budget Summary Table ---
        autoTable(doc, {
          startY: currentY,
          head: [['Resumo Financeiro', 'Valor']],
          body: [
            ['Custo de Material', `R$ ${results.materialCost.toFixed(2)}`],
            ['Mão de Obra', `R$ ${budget.laborCost.toFixed(2)}`],
            ['Embalagem e Logística', `R$ ${budget.packagingCost.toFixed(2)}`],
            ['VALOR TOTAL', `R$ ${results.finalPrice.toFixed(2)}`],
          ],
          theme: 'striped',
          headStyles: { fillColor: [37, 99, 235], halign: 'center' },
          styles: { fontSize: 8, cellPadding: 2 },
          columnStyles: {
            1: { halign: 'right', fontStyle: 'bold', textColor: [37, 99, 235] }
          },
          margin: { left: 105 } // Other half
        });

        const lastTableSummary = (doc as any).lastAutoTable;
        currentY = (lastTableSummary && lastTableSummary.finalY) ? lastTableSummary.finalY + 15 : currentY + 50;
        
        if (budget.clientNotes) {
          const lastTableSummary = (doc as any).lastAutoTable;
          const finalY = (lastTableSummary && lastTableSummary.finalY) ? lastTableSummary.finalY + 15 :
                         (lastTableSummary && lastTableSummary.cursor) ? lastTableSummary.cursor.y + 15 : currentY + 20;
          
          doc.setFillColor(245, 245, 245);
          doc.rect(14, finalY, 182, 30, 'F');
          
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(37, 99, 235);
          doc.text('OBSERVAÇÕES E NOTAS:', 18, finalY + 8);
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(50, 50, 50);
          doc.text(budget.clientNotes, 18, finalY + 15, { maxWidth: 174, lineHeightFactor: 1.5 });
        }
      } else {
        doc.setFontSize(12);
        doc.text('DETALHES DO ORÇAMENTO:', 14, currentY);
        doc.setFontSize(10);
        doc.text(`Material: ${filament.brand} ${filament.type}`, 14, currentY + 10);
        doc.text(`Preço Final: R$ ${results.finalPrice.toFixed(2)}`, 14, currentY + 20);
      }

      return doc;
    } catch (error) {
      console.error("Erro crítico ao gerar PDF:", error);
      throw error;
    }
  };

  const downloadPDF = async () => {
    try {
      const doc = await generatePDF();
      doc.save(`Orcamento_${budget.clientName || 'Cliente'}_${budget.fileName || 'Projeto'}.pdf`);
    } catch (error) {
      alert("Não foi possível gerar o PDF. Verifique se o seu navegador permite downloads.");
    }
  };

  const sharePDF = async () => {
    try {
      const doc = await generatePDF();
      const pdfBlob = doc.output('blob');
      const file = new File([pdfBlob], `Orcamento_${budget.clientName || 'Cliente'}.pdf`, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Orçamento de Impressão 3D',
          text: `Olá ${budget.clientName}, segue o orçamento para o seu projeto.`
        });
      } else {
        // Fallback to download
        doc.save(`Orcamento_${budget.clientName || 'Cliente'}.pdf`);
        alert('O seu navegador não suporta compartilhamento direto de arquivos. O PDF foi baixado para que você possa enviar manualmente.');
      }
    } catch (error) {
      console.error('Erro ao compartilhar PDF:', error);
      alert('Ocorreu um erro ao gerar ou compartilhar o PDF.');
    }
  };

  const sendWhatsApp = () => {
    const itemsList = budget.items.map(item => 
      `• ${item.name} (${item.quantity}x)${item.color ? ` [Cor: ${item.color}]` : ''}: ${item.weight}g / ${item.time}h`
    ).join('\n');

    const message = `*ORÇAMENTO DE IMPRESSÃO 3D*
------------------------------
*Cliente:* ${budget.clientName || 'N/A'}
${budget.clientPhone ? `*Contato:* ${budget.clientPhone}\n` : ''}*Projeto:* ${budget.fileName || 'N/A'}
*Material:* ${filament.brand} ${filament.type}
${printer.colors ? `*Cores Disponíveis:* ${printer.colors}\n` : ''}
*CONFIGURAÇÃO:*
• Camada: ${printSettings.layerHeight}mm
• Infill: ${printSettings.infillDensity}% (${printSettings.infillPattern})
• Suportes: ${printSettings.support ? 'Sim' : 'Não'}

*PEÇAS:*
${itemsList}

*RESUMO:*
*Peso Total:* ${results.totalWeight}g
*Tempo Total:* ${results.totalTime}h
------------------------------
*INVESTIMENTO:*
*Valor Total: R$ ${results.finalPrice.toFixed(2)}*
${budget.manualMode ? '_(Preço definido manualmente)_\n' : ''}
${budget.clientNotes ? `\n*Observações:* ${budget.clientNotes}` : ''}

_Gerado por PRINTCALC-PRO_
_Derretendo Ideias 3D_`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const copySettingsToClipboard = () => {
    const text = `CONFIGURAÇÕES DE IMPRESSÃO - PRINTCALC PRO
-------------------------------------------
Material: ${filament.brand} ${filament.type}
Temp. Bico: ${printSettings.nozzleTemp}°C
Temp. Mesa: ${printSettings.bedTemp}°C
Altura da Camada: ${printSettings.layerHeight}mm
Paredes: ${printSettings.wallLoops}
Preenchimento: ${printSettings.infillDensity}% (${printSettings.infillPattern})
Suportes: ${printSettings.support ? 'Habilitado' : 'Desabilitado'}
Brim: ${printSettings.brim ? 'Habilitado' : 'Desabilitado'}
-------------------------------------------`;
    navigator.clipboard.writeText(text);
    alert("Configurações copiadas! Agora você pode colar no seu fatiador ou usar como referência.");
  };

  const openLocalSlicer = (slicer: any) => {
    if (slicer.protocol) {
      // Use location.href for protocol triggering
      window.location.href = slicer.protocol;
      
      // Provide feedback since we can't detect success
      const toast = document.createElement('div');
      toast.className = "fixed bottom-10 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full font-bold shadow-2xl z-[100] animate-bounce";
      toast.innerText = `Tentando abrir ${slicer.name}...`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);

      // Offer to copy settings
      setTimeout(() => {
        if (confirm(`O ${slicer.name} foi solicitado. Se ele não abrir, verifique se está instalado. Deseja copiar as configurações de impressão para a área de transferência?`)) {
          copySettingsToClipboard();
        }
      }, 1000);
    } else {
      alert(`Para abrir o ${slicer.name}, certifique-se de que ele está instalado no seu computador.`);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0d121f] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Login system removed for now as requested
  /*
  if (!user) {
    return (
      ...
    );
  }
  */

  return (
    <main className="min-h-screen bg-[#0d121f] text-white p-4 md:p-8 flex justify-center items-start font-sans">
      <div className="w-full max-w-2xl space-y-8">
        
        {/* Header */}
        <header className="flex justify-between items-center bg-[#0d121f] py-4">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-[24px] shadow-lg shadow-blue-900/40 flex items-center justify-center w-16 h-16">
              <Printer size={32} className="text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-3xl font-black uppercase tracking-tighter font-display leading-none flex items-center gap-1.5">
                <span className="text-white">PRINTCALC</span>
                <span className="text-blue-500">PRO</span>
              </h1>
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">
                INTELIGÊNCIA EM CUSTOS 3D
              </p>
              <p className="text-xs font-black uppercase tracking-widest bg-gradient-to-r from-red-600 via-orange-500 to-orange-400 bg-clip-text text-transparent mt-1">
                Derretendo Ideias 3D
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <button 
                onClick={resetCalculator}
                className="p-2 bg-[#1e2638] hover:bg-blue-500/20 text-gray-400 hover:text-blue-500 rounded-xl transition-all"
                title="Resetar Calculadora"
              >
                <RotateCcw size={18} />
              </button>
              <span className="text-[10px] font-black text-blue-500 uppercase bg-blue-500/10 px-2 py-1 rounded-md">Passo {step}/4</span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`h-1 w-8 rounded-full transition-all duration-300 ${step >= i ? 'bg-blue-500' : 'bg-[#232d42]'}`} />
              ))}
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2 text-gray-400">
                <Layers size={16} />
                <h2 className="text-sm font-bold uppercase tracking-wider font-display">Configuração do Filamento</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup 
                  label="Tipo de Filamento" 
                  icon={Box}
                  tooltip="Selecione a composição química do material (ex: PLA para facilidade, PETG para resistência)."
                >
                  <select 
                    value={filament.type} 
                    onChange={(e) => {
                      const type = e.target.value;
                      // Find base type for density (e.g., "PLA Silk" -> "PLA")
                      const baseType = Object.keys(DEFAULT_DENSITIES).find(k => type.includes(k)) || "PLA";
                      setFilament(prev => ({ 
                        ...prev, 
                        type,
                        density: DEFAULT_DENSITIES[baseType] || prev.density
                      }));
                    }}
                    className="w-full bg-[#1e2638] border border-[#2d374d] text-white rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    {Object.entries(FILAMENT_TYPES).map(([category, types]) => (
                      <optgroup key={category} label={category}>
                        {types.map(t => <option key={t} value={t}>{t}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </InputGroup>

                <InputGroup 
                  label="Marca do Filamento" 
                  icon={Settings}
                  tooltip="A marca do filamento influencia na qualidade e no preço de custo por kg."
                >
                  <Select 
                    value={filament.brand} 
                    onChange={(v) => setFilament(p => ({ ...p, brand: v }))}
                    options={FILAMENT_BRANDS}
                  />
                </InputGroup>

                <InputGroup 
                  label="Preço por kg" 
                  icon={DollarSign}
                  tooltip="Quanto você pagou no rolo de 1kg deste material."
                >
                  <Input 
                    type="number" 
                    value={filament.pricePerKg} 
                    onChange={(v) => setFilament(p => ({ ...p, pricePerKg: parseFloat(v) || 0 }))} 
                    suffix="R$"
                  />
                </InputGroup>

                <div className="grid grid-cols-2 gap-4">
                  <InputGroup 
                    label="Temp. Mesa / Placa" 
                    icon={Thermometer}
                    tooltip="Temperatura da mesa de impressão ou placa pai texturizada para este material."
                  >
                    <Input 
                      type="number" 
                      value={filament.bedTemp} 
                      onChange={(v) => setFilament(p => ({ ...p, bedTemp: parseFloat(v) || 0 }))} 
                      suffix="°C"
                    />
                  </InputGroup>
                  <InputGroup 
                    label="Diâmetro do Filamento" 
                    icon={Settings}
                    tooltip="Diâmetro do filamento (padrão é 1.75mm)."
                  >
                    <Input 
                      type="number" 
                      value={filament.diameter} 
                      onChange={(v) => setFilament(p => ({ ...p, diameter: parseFloat(v) || 0 }))} 
                      suffix="mm"
                    />
                  </InputGroup>
                  <InputGroup 
                    label="Temp. Bico" 
                    icon={Thermometer}
                    tooltip="Temperatura de extrusão recomendada para este filamento."
                  >
                    <Input 
                      type="number" 
                      value={filament.temp} 
                      onChange={(v) => setFilament(p => ({ ...p, temp: parseFloat(v) || 0 }))} 
                      suffix="°C"
                    />
                  </InputGroup>
                  <InputGroup 
                    label="Densidade" 
                    icon={Weight}
                    tooltip="Densidade do material em g/cm³ (ex: PLA ~1.24, ABS ~1.04)."
                  >
                    <Input 
                      type="number" 
                      value={filament.density} 
                      onChange={(v) => setFilament(p => ({ ...p, density: parseFloat(v) || 0 }))} 
                      suffix="g/cm³"
                    />
                  </InputGroup>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2 text-gray-400">
                <Printer size={16} />
                <h2 className="text-sm font-bold uppercase tracking-wider font-display">Configuração da Impressora</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup 
                  label="Marca da Impressora" 
                  icon={Settings}
                  tooltip="Fabricante da sua impressora 3D."
                >
                  <Select 
                    value={printer.brand} 
                    onChange={(v) => setPrinter(p => ({ ...p, brand: v, model: PRINTER_MODELS[v as keyof typeof PRINTER_MODELS]?.[0] || "" }))}
                    options={PRINTER_BRANDS}
                  />
                </InputGroup>

                <InputGroup 
                  label="Modelo da Impressora" 
                  icon={Cpu}
                  tooltip="O modelo específico da impressora para determinar consumo e performance."
                >
                  <Select 
                    value={printer.model} 
                    onChange={(v) => {
                      const data = DEFAULT_PRINTER_DATA[v];
                      setPrinter(p => ({ 
                        ...p, 
                        model: v,
                        power: data?.power || p.power,
                        speed: data?.speed || p.speed
                      }));
                    }}
                    options={PRINTER_MODELS[printer.brand as keyof typeof PRINTER_MODELS] || []}
                  />
                </InputGroup>

                <InputGroup 
                  label="Velocidade Média" 
                  icon={Zap}
                  tooltip="Velocidade média de impressão que você costuma usar (ex: 60mm/s ou 250mm/s)."
                >
                  <Input 
                    type="number" 
                    value={printer.speed} 
                    onChange={(v) => setPrinter(p => ({ ...p, speed: parseFloat(v) || 0 }))} 
                    suffix="mm/s"
                  />
                </InputGroup>

                <InputGroup 
                  label="Consumo de Energia" 
                  icon={Zap}
                  tooltip="Consumo médio em Watts da impressora durante o funcionamento."
                >
                  <Input 
                    type="number" 
                    value={printer.power} 
                    onChange={(v) => setPrinter(p => ({ ...p, power: parseFloat(v) || 0 }))} 
                    suffix="Watts"
                  />
                </InputGroup>

                <InputGroup 
                  label="Paleta de Cores Disponíveis" 
                  icon={Edit2}
                  tooltip="Liste as cores que você tem disponíveis para este filamento/impressora."
                >
                  <Input 
                    value={printer.colors} 
                    onChange={(v) => setPrinter(p => ({ ...p, colors: v }))} 
                    placeholder="ex: Preto, Branco, Vermelho, Azul..."
                  />
                </InputGroup>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between gap-2 text-gray-400">
                <div className="flex items-center gap-2">
                  <Settings size={16} />
                  <h2 className="text-sm font-bold uppercase tracking-wider font-display">Configuração de Impressão (Bambu Style)</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={downloadConfig}
                    className="p-2 bg-[#1e2638] border border-[#2d374d] hover:border-blue-500 rounded-lg text-gray-400 hover:text-blue-500 transition-all"
                    title="Baixar Configuração"
                  >
                    <Download size={14} />
                  </button>
                  <button 
                    onClick={() => openSlicer('bambulab://')}
                    className="p-2 bg-[#1e2638] border border-[#2d374d] hover:border-blue-500 rounded-lg text-gray-400 hover:text-blue-500 transition-all"
                    title="Abrir no Bambu Studio"
                  >
                    <ExternalLink size={14} />
                  </button>
                  <button 
                    onClick={loadConfig}
                    className="p-2 bg-[#1e2638] border border-[#2d374d] hover:border-blue-500 rounded-lg text-gray-400 hover:text-blue-500 transition-all"
                    title="Abrir Configuração Salva"
                  >
                    <FileText size={14} />
                  </button>
                  <button 
                    onClick={saveConfig}
                    className="p-2 bg-[#1e2638] border border-[#2d374d] hover:border-blue-500 rounded-lg text-gray-400 hover:text-blue-500 transition-all"
                    title="Salvar Configuração"
                  >
                    <Save size={14} />
                  </button>
                </div>
              </div>

              <div className="bg-[#1e2638]/30 rounded-2xl border border-[#2d374d]/50 overflow-hidden">
                <div className="flex bg-[#1e2638] border-b border-[#2d374d] overflow-x-auto no-scrollbar">
                  <div className="px-4 py-2 text-[10px] font-bold text-blue-500 border-b-2 border-blue-500 uppercase tracking-wider whitespace-nowrap">Global</div>
                  {BAMBU_PRESETS.map(preset => (
                    <button 
                      key={preset.name}
                      onClick={() => setPrintSettings(p => ({
                        ...p,
                        layerHeight: preset.layerHeight,
                        wallLoops: preset.wallLoops,
                        topLayers: preset.topLayers,
                        bottomLayers: preset.bottomLayers,
                        infillDensity: preset.infill
                      }))}
                      className="px-4 py-2 text-[9px] font-bold text-gray-500 hover:text-white uppercase tracking-wider whitespace-nowrap transition-colors"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
                
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <p className="text-[10px] uppercase font-black text-gray-500">Qualidade e Camadas</p>
                    <InputGroup label="Altura da Camada" icon={Layers} tooltip="Espessura de cada camada. Menor = mais detalhe, maior = mais rápido.">
                      <Input type="number" value={printSettings.layerHeight} onChange={(v) => setPrintSettings(p => ({ ...p, layerHeight: parseFloat(v) || 0 }))} suffix="mm" />
                    </InputGroup>
                    <InputGroup label="Paredes (Wall Loops)" icon={Box} tooltip="Número de perímetros externos. Mais paredes = mais resistência.">
                      <Input type="number" value={printSettings.wallLoops} onChange={(v) => setPrintSettings(p => ({ ...p, wallLoops: parseInt(v) || 0 }))} suffix="voltas" />
                    </InputGroup>
                    <div className="grid grid-cols-2 gap-4">
                      <InputGroup label="Camadas Topo" icon={ChevronUp} tooltip="Camadas sólidas no topo.">
                        <Input type="number" value={printSettings.topLayers} onChange={(v) => setPrintSettings(p => ({ ...p, topLayers: parseInt(v) || 0 }))} />
                      </InputGroup>
                      <InputGroup label="Camadas Base" icon={ChevronDown} tooltip="Camadas sólidas na base.">
                        <Input type="number" value={printSettings.bottomLayers} onChange={(v) => setPrintSettings(p => ({ ...p, bottomLayers: parseInt(v) || 0 }))} />
                      </InputGroup>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <InputGroup label="Temp. Bico" icon={Thermometer} tooltip="Temperatura de extrusão.">
                        <Input type="number" value={printSettings.nozzleTemp} onChange={(v) => setPrintSettings(p => ({ ...p, nozzleTemp: parseInt(v) || 0 }))} suffix="°C" />
                      </InputGroup>
                      <InputGroup label="Temp. Mesa" icon={Thermometer} tooltip="Temperatura da mesa aquecida.">
                        <Input type="number" value={printSettings.bedTemp} onChange={(v) => setPrintSettings(p => ({ ...p, bedTemp: parseInt(v) || 0 }))} suffix="°C" />
                      </InputGroup>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] uppercase font-black text-gray-500">Preenchimento e Suporte</p>
                    <InputGroup label="Densidade de Infill" icon={Grid} tooltip="Porcentagem de preenchimento interno.">
                      <Input type="number" value={printSettings.infillDensity} onChange={(v) => setPrintSettings(p => ({ ...p, infillDensity: parseInt(v) || 0 }))} suffix="%" />
                    </InputGroup>
                    <InputGroup label="Padrão de Infill" icon={Grid} tooltip="Geometria do preenchimento interno.">
                      <select 
                        value={printSettings.infillPattern} 
                        onChange={(e) => setPrintSettings(p => ({ ...p, infillPattern: e.target.value }))}
                        className="w-full bg-[#1e2638] border border-[#2d374d] text-white rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500"
                      >
                        <option value="Giroide">Giroide</option>
                        <option value="Grade">Grade</option>
                        <option value="Cúbico">Cúbico</option>
                        <option value="Linha">Linha</option>
                        <option value="Colmeia">Colmeia</option>
                      </select>
                    </InputGroup>
                    <div className="flex items-center justify-between p-3 bg-[#1e2638] rounded-xl border border-[#2d374d]">
                      <div className="flex items-center gap-2">
                        <Info size={14} className="text-blue-500" />
                        <span className="text-xs font-bold uppercase">Gerar Suportes</span>
                      </div>
                      <button 
                        onClick={() => setPrintSettings(p => ({ ...p, support: !p.support }))}
                        className={`w-10 h-5 rounded-full transition-all relative ${printSettings.support ? 'bg-blue-600' : 'bg-gray-700'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${printSettings.support ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-[#1e2638] rounded-xl border border-[#2d374d]">
                      <div className="flex items-center gap-2">
                        <Info size={14} className="text-blue-500" />
                        <span className="text-xs font-bold uppercase">Habilitar Brim (Borda)</span>
                      </div>
                      <button 
                        onClick={() => setPrintSettings(p => ({ ...p, brim: !p.brim }))}
                        className={`w-10 h-5 rounded-full transition-all relative ${printSettings.brim ? 'bg-blue-600' : 'bg-gray-700'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${printSettings.brim ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2 text-gray-400">
                <FileText size={16} />
                <h2 className="text-sm font-bold uppercase tracking-wider font-display">Orçamento e Projeto</h2>
              </div>

              {/* Resumo Rápido */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-[#1e2638] border border-[#2d374d] p-4 rounded-2xl text-center">
                  <p className="text-[8px] text-gray-500 uppercase font-black mb-1">Custo Total</p>
                  <p className="text-lg font-black text-emerald-500">R$ {results.finalPrice.toFixed(2)}</p>
                </div>
                <div className="bg-[#1e2638] border border-[#2d374d] p-4 rounded-2xl text-center">
                  <p className="text-[8px] text-gray-500 uppercase font-black mb-1">Peso Total</p>
                  <p className="text-lg font-black text-blue-500">{results.totalWeight}g</p>
                </div>
                <div className="bg-[#1e2638] border border-[#2d374d] p-4 rounded-2xl text-center">
                  <p className="text-[8px] text-gray-500 uppercase font-black mb-1">Tempo Total</p>
                  <p className="text-lg font-black text-orange-500">{results.totalTime}h</p>
                </div>
                <div className="bg-[#1e2638] border border-[#2d374d] p-4 rounded-2xl text-center">
                  <p className="text-[8px] text-gray-500 uppercase font-black mb-1">Margem</p>
                  <p className="text-lg font-black text-indigo-500">{budget.markup}%</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-4">
                  <ModelViewer url={uploadedFile.url} type={uploadedFile.type} imageUrl={budget.projectImage} />
                  
                {/* Dados do Cliente */}
                <div className="space-y-4">
                  <p className="text-[10px] uppercase font-black text-gray-500 flex items-center gap-2">
                    <User size={12} />
                    Dados do Cliente
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <InputGroup 
                      label="Nome do Cliente" 
                      icon={User}
                      tooltip="Nome da pessoa ou empresa que solicitou o orçamento."
                    >
                      <Input 
                        value={budget.clientName || ''} 
                        onChange={(v) => setBudget(p => ({ ...p, clientName: v }))} 
                        placeholder="ex: João Silva"
                      />
                    </InputGroup>

                    <InputGroup 
                      label="Telefone / WhatsApp" 
                      icon={Zap}
                      tooltip="Contato do cliente."
                    >
                      <Input 
                        value={budget.clientPhone || ''} 
                        onChange={(v) => setBudget(p => ({ ...p, clientPhone: v }))} 
                        placeholder="ex: (11) 99999-9999"
                      />
                    </InputGroup>

                    <InputGroup 
                      label="E-mail do Cliente" 
                      icon={User}
                      tooltip="E-mail para contato."
                    >
                      <Input 
                        value={budget.clientEmail || ''} 
                        onChange={(v) => setBudget(p => ({ ...p, clientEmail: v }))} 
                        placeholder="ex: cliente@email.com"
                      />
                    </InputGroup>
                  </div>
                </div>

                {/* Dados do Projeto */}
                <div className="space-y-4">
                  <p className="text-[10px] uppercase font-black text-gray-500 flex items-center gap-2">
                    <FileText size={12} />
                    Dados do Projeto
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputGroup 
                      label="Nome do Projeto" 
                      icon={FileText}
                      tooltip="Nome descritivo da peça que será impressa."
                    >
                      <Input 
                        value={budget.fileName || ''} 
                        onChange={(v) => setBudget(p => ({ ...p, fileName: v }))} 
                        placeholder="ex: Capacete Homem de Ferro"
                      />
                    </InputGroup>

                    <InputGroup 
                      label="Material Selecionado" 
                      icon={Box}
                      tooltip="Material configurado no Passo 1."
                    >
                      <div className="w-full bg-[#1e2638]/50 border border-[#2d374d] text-gray-400 rounded-xl p-3 text-sm">
                        {filament.brand} {filament.type}
                      </div>
                    </InputGroup>

                    <InputGroup 
                      label="Upload de Arquivo (STL/G-code)" 
                      icon={Upload}
                      tooltip="Suba o arquivo 3D para extrair dados ou uma imagem para referência visual."
                    >
                      <div className="relative">
                        <input 
                          type="file" 
                          accept=".stl,.gcode,.3mf,.jpg,.jpeg,.png,.webp" 
                          onChange={handleFileUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="w-full bg-[#1e2638] border border-[#2d374d] text-white rounded-xl p-3 text-sm flex items-center justify-center gap-2 hover:border-blue-500 transition-colors">
                          <Upload size={16} className="text-blue-500" />
                          <span className="truncate">{budget.fileName || 'Selecionar arquivo...'}</span>
                        </div>
                      </div>
                    </InputGroup>

                    <div className="space-y-3">
                      <p className="text-[10px] uppercase font-black text-gray-500 flex items-center gap-2">
                        <ExternalLink size={12} />
                        Repositórios de Modelos 3D
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <a 
                          href="https://makerworld.com" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 bg-[#1e2638] border border-[#2d374d] hover:border-blue-500 p-3 rounded-xl transition-all text-xs font-bold"
                        >
                          Maker World
                          <ExternalLink size={12} className="text-blue-500" />
                        </a>
                        <a 
                          href="https://www.crealitycloud.com" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 bg-[#1e2638] border border-[#2d374d] hover:border-blue-500 p-3 rounded-xl transition-all text-xs font-bold"
                        >
                          Creality Cloud
                          <ExternalLink size={12} className="text-blue-500" />
                        </a>
                      </div>
                    </div>
                  </div>

                  <InputGroup 
                    label="Observações e Requisitos do Cliente" 
                    icon={FileText}
                    tooltip="Notas adicionais sobre o pedido, acabamento, prazos ou requisitos especiais do cliente."
                  >
                    <textarea 
                      value={budget.clientNotes || ''}
                      onChange={(e) => setBudget(p => ({ ...p, clientNotes: e.target.value }))}
                      placeholder="ex: Cliente solicitou acabamento liso, cor específica, ou prazo de entrega urgente..."
                      className="w-full bg-[#1e2638] border border-[#2d374d] text-white rounded-xl p-4 text-sm focus:outline-none focus:border-blue-500 transition-colors min-h-[120px] resize-none"
                    />
                  </InputGroup>
                </div>
                </div>

                <div className="md:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase font-black text-gray-500 flex items-center gap-2">
                      <Box size={12} />
                      Peças a serem fabricadas
                    </p>
                    <button 
                      onClick={() => setBudget(p => ({ 
                        ...p, 
                        items: [...p.items, { id: Date.now().toString(), name: `Peça ${p.items.length + 1}`, weight: 0, time: 0, quantity: 1, price: 0, color: "", manualUnitPrice: 0, manualTotalPrice: 0 }] 
                      }))}
                      className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors"
                    >
                      <Plus size={12} />
                      Adicionar Peça
                    </button>
                  </div>

                  <div className="space-y-2">
                    {budget.items.map((item, index) => (
                      <div key={item.id} className="bg-[#161c2d] border border-[#232d42] rounded-2xl p-4 hover:border-blue-500/30 transition-all group">
                        <div className="flex flex-col lg:flex-row gap-4">
                          {/* Info Principal */}
                          <div className="flex-1 min-w-0 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-blue-500/10 rounded-lg flex items-center justify-center text-[10px] font-black text-blue-500">
                                  {index + 1}
                                </div>
                                <input 
                                  type="text"
                                  value={item.name || ''}
                                  onChange={(e) => {
                                    const newItems = [...budget.items];
                                    newItems[index].name = e.target.value;
                                    setBudget(p => ({ ...p, items: newItems }));
                                  }}
                                  className="bg-transparent border-none text-sm font-black text-white focus:outline-none focus:ring-0 p-0 w-full placeholder:text-gray-700"
                                  placeholder="Nome da Peça..."
                                />
                              </div>
                              {budget.items.length > 1 && (
                                <button 
                                  onClick={() => setBudget(p => ({ ...p, items: p.items.filter(i => i.id !== item.id) }))}
                                  className="p-1.5 text-gray-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="space-y-1">
                                <label className="text-[8px] text-gray-600 uppercase font-black tracking-widest">Quantidade</label>
                                <div className="flex items-center bg-[#1e2638] rounded-xl border border-[#2d374d] px-2">
                                  <button 
                                    onClick={() => {
                                      const newItems = [...budget.items];
                                      const newQty = Math.max(1, (newItems[index].quantity || 1) - 1);
                                      newItems[index].quantity = newQty;
                                      if (newItems[index].manualUnitPrice) {
                                        newItems[index].manualTotalPrice = newItems[index].manualUnitPrice * newQty;
                                      }
                                      setBudget(p => ({ ...p, items: newItems }));
                                    }}
                                    className="p-1 text-gray-500 hover:text-white"
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <input 
                                    type="number"
                                    value={item.quantity ?? 1}
                                    onChange={(e) => {
                                      const newItems = [...budget.items];
                                      const newQty = parseInt(e.target.value) || 1;
                                      newItems[index].quantity = newQty;
                                      if (newItems[index].manualUnitPrice) {
                                        newItems[index].manualTotalPrice = newItems[index].manualUnitPrice * newQty;
                                      }
                                      setBudget(p => ({ ...p, items: newItems }));
                                    }}
                                    className="w-full bg-transparent border-none text-center text-xs font-bold text-white focus:outline-none focus:ring-0 p-1"
                                  />
                                  <button 
                                    onClick={() => {
                                      const newItems = [...budget.items];
                                      const newQty = (newItems[index].quantity || 1) + 1;
                                      newItems[index].quantity = newQty;
                                      if (newItems[index].manualUnitPrice) {
                                        newItems[index].manualTotalPrice = newItems[index].manualUnitPrice * newQty;
                                      }
                                      setBudget(p => ({ ...p, items: newItems }));
                                    }}
                                    className="p-1 text-gray-500 hover:text-white"
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[8px] text-gray-600 uppercase font-black tracking-widest">Peso (g)</label>
                                <div className="relative">
                                  <input 
                                    type="number"
                                    value={item.weight === 0 ? '' : (item.weight || '')}
                                    onChange={(e) => {
                                      const newItems = [...budget.items];
                                      newItems[index].weight = parseFloat(e.target.value) || 0;
                                      setBudget(p => ({ ...p, items: newItems }));
                                    }}
                                    className="w-full bg-[#1e2638] border border-[#2d374d] text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-blue-500"
                                    placeholder="0"
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-gray-600 font-bold">G</span>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[8px] text-gray-600 uppercase font-black tracking-widest">Tempo (h)</label>
                                <div className="relative">
                                  <input 
                                    type="number"
                                    value={item.time === 0 ? '' : (item.time || '')}
                                    onChange={(e) => {
                                      const newItems = [...budget.items];
                                      newItems[index].time = parseFloat(e.target.value) || 0;
                                      setBudget(p => ({ ...p, items: newItems }));
                                    }}
                                    className="w-full bg-[#1e2638] border border-[#2d374d] text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-blue-500"
                                    placeholder="0"
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-gray-600 font-bold">H</span>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[8px] text-gray-600 uppercase font-black tracking-widest">Cor</label>
                                <input 
                                  type="text"
                                  value={item.color || ''}
                                  onChange={(e) => {
                                    const newItems = [...budget.items];
                                    newItems[index].color = e.target.value;
                                    setBudget(p => ({ ...p, items: newItems }));
                                  }}
                                  className="w-full bg-[#1e2638] border border-[#2d374d] text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-blue-500"
                                  placeholder="ex: Preto"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Preços Manuais */}
                          <div className="lg:w-48 flex flex-col gap-2 pt-2 lg:pt-0 lg:border-l lg:border-[#2d374d]/30 lg:pl-4">
                            <div className="space-y-1">
                              <label className="text-[8px] text-blue-500 uppercase font-black tracking-widest">Valor Unitário</label>
                              <div className="relative">
                                <input 
                                  type="number"
                                  value={item.manualUnitPrice || ''}
                                  onChange={(e) => {
                                    const newItems = [...budget.items];
                                    const val = parseFloat(e.target.value) || 0;
                                    newItems[index].manualUnitPrice = val;
                                    newItems[index].manualTotalPrice = val * (newItems[index].quantity || 1);
                                    setBudget(p => ({ ...p, items: newItems }));
                                  }}
                                  className="w-full bg-blue-500/5 border border-blue-500/20 text-blue-400 rounded-xl px-3 py-2 text-xs font-black focus:outline-none focus:border-blue-500 placeholder:text-blue-500/20"
                                  placeholder={results.itemResults[index].unitPrice.toFixed(2)}
                                />
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] text-blue-500/50 font-bold">R$</span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] text-emerald-500 uppercase font-black tracking-widest">Valor Total</label>
                              <div className="relative">
                                <input 
                                  type="number"
                                  value={item.manualTotalPrice || ''}
                                  onChange={(e) => {
                                    const newItems = [...budget.items];
                                    newItems[index].manualTotalPrice = parseFloat(e.target.value) || 0;
                                    setBudget(p => ({ ...p, items: newItems }));
                                  }}
                                  className="w-full bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 rounded-xl px-3 py-2 text-xs font-black focus:outline-none focus:border-emerald-500 placeholder:text-emerald-500/20"
                                  placeholder={results.itemResults[index].totalPrice.toFixed(2)}
                                />
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] text-emerald-500/50 font-bold">R$</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-4 bg-blue-600/10 border border-blue-500/20 rounded-xl p-3">
                    <div className="text-center">
                      <p className="text-[8px] text-blue-400 uppercase font-bold">Peso Total</p>
                      <p className="text-sm font-black text-white">{results.totalWeight}g</p>
                    </div>
                    <div className="text-center border-l border-blue-500/20">
                      <p className="text-[8px] text-blue-400 uppercase font-bold">Tempo Total</p>
                      <p className="text-sm font-black text-white">{results.totalTime}h</p>
                    </div>
                    <div className="text-center border-l border-blue-500/20">
                      <p className="text-[8px] text-blue-400 uppercase font-bold">Valor Total</p>
                      <p className="text-sm font-black text-white">R$ {results.totalItemsPrice.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* Custos Adicionais */}
                <div className="md:col-span-2 space-y-6 pt-4 border-t border-[#2d374d]/50">
                  <p className="text-[10px] uppercase font-black text-gray-400 flex items-center gap-2">
                    <DollarSign size={12} className="text-blue-500" />
                    Custos Adicionais e Configurações
                  </p>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Grupo 1: Custos de Produção */}
                    <div className="space-y-4 bg-[#1e2638]/30 p-4 rounded-2xl border border-[#2d374d]/30">
                      <p className="text-[9px] uppercase font-bold text-blue-400/80 tracking-widest flex items-center gap-2">
                        <Box size={10} />
                        Custos de Operação e Logística
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputGroup 
                          label="Energia (kWh)" 
                          icon={Zap}
                          tooltip="Valor do kWh cobrado pela sua concessionária."
                        >
                          <Input 
                            type="number" 
                            value={budget.energyPrice} 
                            onChange={(v) => setBudget(p => ({ ...p, energyPrice: parseFloat(v) || 0 }))} 
                            suffix="R$"
                          />
                        </InputGroup>

                        <InputGroup 
                          label="Mão de Obra" 
                          icon={User}
                          tooltip="Valor fixo pelo seu tempo de trabalho."
                        >
                          <Input 
                            type="number" 
                            value={budget.laborCost} 
                            onChange={(v) => setBudget(p => ({ ...p, laborCost: parseFloat(v) || 0 }))} 
                            suffix="R$"
                          />
                        </InputGroup>

                        <InputGroup 
                          label="Embalagem" 
                          icon={Box}
                          tooltip="Gastos com caixa, fita e etiquetas."
                        >
                          <Input 
                            type="number" 
                            value={budget.packagingCost} 
                            onChange={(v) => setBudget(p => ({ ...p, packagingCost: parseFloat(v) || 0 }))} 
                            suffix="R$"
                          />
                        </InputGroup>

                        <InputGroup 
                          label="Frete / Envio" 
                          icon={Truck}
                          tooltip="Valor do frete se cobrado separadamente."
                        >
                          <Input 
                            type="number" 
                            value={budget.shippingCost} 
                            onChange={(v) => setBudget(p => ({ ...p, shippingCost: parseFloat(v) || 0 }))} 
                            suffix="R$"
                          />
                        </InputGroup>
                      </div>
                    </div>

                    {/* Grupo 2: Taxas e Margens */}
                    <div className="space-y-4 bg-[#1e2638]/30 p-4 rounded-2xl border border-[#2d374d]/30">
                      <p className="text-[9px] uppercase font-bold text-emerald-400/80 tracking-widest flex items-center gap-2">
                        <DollarSign size={10} />
                        Taxas, Riscos e Lucro
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputGroup 
                          label="Taxa Plataforma" 
                          icon={DollarSign}
                          tooltip="Porcentagem cobrada por marketplaces."
                        >
                          <Input 
                            type="number" 
                            value={budget.platformFee} 
                            onChange={(v) => setBudget(p => ({ ...p, platformFee: parseFloat(v) || 0 }))} 
                            suffix="%"
                          />
                        </InputGroup>

                        <InputGroup 
                          label="Risco de Falha" 
                          icon={Info}
                          tooltip="Margem para cobrir erros de impressão."
                        >
                          <Input 
                            type="number" 
                            value={budget.failRisk} 
                            onChange={(v) => setBudget(p => ({ ...p, failRisk: parseFloat(v) || 0 }))} 
                            suffix="%"
                          />
                        </InputGroup>

                        <div className="col-span-full space-y-3 pt-2">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] uppercase font-black text-gray-500">Markup (Margem de Lucro)</p>
                              <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {budget.markup}%
                              </span>
                            </div>
                            <div className="w-20">
                              <Input 
                                type="number"
                                value={budget.markup}
                                onChange={(v) => setBudget(p => ({ ...p, markup: parseInt(v) || 0 }))}
                                suffix="%"
                              />
                            </div>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="500" 
                            value={budget.markup} 
                            onChange={(e) => setBudget(p => ({ ...p, markup: parseInt(e.target.value) }))}
                            className="w-full h-1.5 bg-[#2d374d] rounded-lg appearance-none cursor-pointer accent-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <p className="text-[10px] uppercase font-black text-gray-500 flex items-center gap-2">
              <DollarSign size={12} />
              Resumo Financeiro
            </p>
            <button 
              onClick={() => setBudget(p => ({ ...p, manualMode: !p.manualMode, manualFinalPrice: p.manualMode ? 0 : results.finalPrice }))}
              className={`text-[10px] font-bold px-3 py-1 rounded-lg transition-all flex items-center gap-2 ${budget.manualMode ? 'bg-orange-500 text-white' : 'bg-[#1e2638] text-gray-400'}`}
            >
              {budget.manualMode ? <Settings size={12} /> : <Zap size={12} />}
              {budget.manualMode ? 'Modo Manual Ativo' : 'Ativar Modo Manual'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="flex flex-col justify-center border-l-4 border-l-blue-500 hover:bg-[#161c2d] transition-none">
              <p className="text-[10px] uppercase font-black text-gray-500">Custo Real de Fab.</p>
              <p className="text-2xl font-black text-blue-400 font-display">R$ {results.totalMfgCost.toFixed(2)}</p>
            </Card>
            <Card className={`flex flex-col justify-center border-l-4 transition-all ${budget.manualMode ? 'border-l-orange-500 bg-orange-500/5' : 'border-l-emerald-500 hover:bg-[#161c2d]'}`}>
              <p className="text-[10px] uppercase font-black text-gray-500">{budget.manualMode ? 'Preço Manual Definido' : 'Preço Sugerido (Auto)'}</p>
              {budget.manualMode ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-black text-orange-400 font-display">R$</span>
                  <input 
                    type="number"
                    value={budget.manualFinalPrice}
                    onChange={(e) => setBudget(p => ({ ...p, manualFinalPrice: parseFloat(e.target.value) || 0 }))}
                    className="bg-transparent border-b border-orange-500/50 text-2xl font-black text-orange-400 font-display focus:outline-none w-full"
                  />
                </div>
              ) : (
                <p className="text-2xl font-black text-emerald-400 font-display">R$ {results.finalPrice.toFixed(2)}</p>
              )}
            </Card>
          </div>

          {budget.manualMode && (
            <p className="text-[9px] text-orange-500/70 font-bold uppercase text-center italic">
              * No modo manual, o valor total é definido por você, ignorando a soma automática de custos e margens.
            </p>
          )}

          <Card className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <div className="text-center p-2 rounded-xl bg-[#1e2638]">
                <p className="text-[8px] uppercase font-bold text-gray-500">Peso Total</p>
                <p className="text-xs font-bold">{results.totalWeight}g</p>
              </div>
              <div className="text-center p-2 rounded-xl bg-[#1e2638]">
                <p className="text-[8px] uppercase font-bold text-gray-500">Tempo Total</p>
                <p className="text-xs font-bold">{results.totalTime}h</p>
              </div>
              <div className="text-center p-2 rounded-xl bg-[#1e2638]">
                <p className="text-[8px] uppercase font-bold text-gray-500">Valor Manual</p>
                <p className="text-xs font-bold">R$ {results.totalItemsPrice.toFixed(2)}</p>
              </div>
              <div className="text-center p-2 rounded-xl bg-[#1e2638]">
                <p className="text-[8px] uppercase font-bold text-gray-500">Material</p>
                <p className="text-xs font-bold">R$ {results.materialCost.toFixed(2)}</p>
              </div>
              <div className="text-center p-2 rounded-xl bg-[#1e2638]">
                <p className="text-[8px] uppercase font-bold text-gray-500">Energia</p>
                <p className="text-xs font-bold">R$ {results.energyCost.toFixed(2)}</p>
              </div>
              <div className="text-center p-2 rounded-xl bg-[#1e2638]">
                <p className="text-[8px] uppercase font-bold text-gray-500">Desgaste</p>
                <p className="text-xs font-bold">R$ {results.wearCost.toFixed(2)}</p>
              </div>
            </div>
          </Card>
        </section>

        {/* Navigation */}
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            {step > 1 && (
              <button 
                onClick={prevStep}
                className="flex-1 bg-[#1e2638] hover:bg-[#2d374d] text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 border border-[#2d374d]"
              >
                <ChevronLeft size={20} />
                Voltar
              </button>
            )}
            {step < 4 && (
              <button 
                onClick={nextStep}
                className="flex-[2] bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-900/40 transition-all flex items-center justify-center gap-2 uppercase tracking-tighter"
              >
                Próximo Passo
                <ChevronRight size={20} />
              </button>
            )}
          </div>
          
          {step === 4 && (
            <div className="space-y-6">
              {/* Bambu Studio Special Integration */}
              <div className="bg-gradient-to-br from-[#00aeef]/10 to-transparent border border-[#00aeef]/30 rounded-2xl p-4 relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform">
                  <Printer size={100} className="text-[#00aeef]" />
                </div>
                <div className="flex items-start gap-4 relative z-10">
                  <div className="w-12 h-12 bg-[#00aeef] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#00aeef]/20">
                    <span className="font-black text-xl">B</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-black uppercase tracking-tight text-white">Integração Bambu Studio</h3>
                    <p className="text-[10px] text-gray-400 font-medium mb-3">Abra o fatiador e envie as configurações automaticamente.</p>
                    
                    <div className="flex flex-wrap gap-2">
                      <button 
                        onClick={() => openLocalSlicer(SLICERS.find(s => s.name === "Bambu Studio"))}
                        className="bg-[#00aeef] hover:bg-[#009cd6] text-white text-[10px] font-black uppercase px-4 py-2 rounded-lg transition-all flex items-center gap-2"
                      >
                        <ExternalLink size={12} /> Abrir Fatiador
                      </button>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText("C:\\Program Files\\Bambu Studio");
                          alert("Caminho copiado: C:\\Program Files\\Bambu Studio");
                        }}
                        className="bg-white/5 hover:bg-white/10 text-gray-300 text-[10px] font-black uppercase px-4 py-2 rounded-lg transition-all flex items-center gap-2 border border-white/10"
                      >
                        <Save size={12} /> Copiar Caminho
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[9px] text-gray-500 font-bold uppercase">Protocolo bambulab:// pronto</span>
                </div>
              </div>

              {/* Slicers Integration */}
              <div className="space-y-3">
                <p className="text-[10px] uppercase font-black text-gray-500 flex items-center gap-2">
                  <Printer size={12} />
                  Outros Fatiadores Instalados
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SLICERS.filter(s => s.name !== "Bambu Studio").slice(0, 4).map(slicer => (
                    <button 
                      key={slicer.name}
                      onClick={() => openLocalSlicer(slicer)}
                      className="bg-[#1e2638] border border-[#2d374d] hover:border-blue-500 p-3 rounded-xl transition-all flex flex-col items-center gap-2 group"
                    >
                      <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500 font-black group-hover:bg-blue-500 group-hover:text-white transition-all">
                        {slicer.icon}
                      </div>
                      <span className="text-[9px] font-bold uppercase text-gray-400 group-hover:text-white">{slicer.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={sendWhatsApp}
                  className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-black py-4 rounded-2xl shadow-lg shadow-green-900/20 transition-all flex items-center justify-center gap-2 uppercase tracking-tighter"
                >
                  <MessageCircle size={20} />
                  WhatsApp
                </button>
                <button 
                  onClick={sharePDF}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 uppercase tracking-tighter"
                >
                  <Share2 size={20} />
                  Compartilhar PDF
                </button>
                <button 
                  onClick={downloadPDF}
                  className="w-full bg-[#1e2638] border border-[#2d374d] hover:border-blue-500 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 uppercase tracking-tighter"
                >
                  <Download size={20} />
                  Baixar PDF
                </button>
              </div>
                
                <div className="space-y-6">
                  {/* Download Links */}
                  <div className="space-y-3">
                    <p className="text-[10px] uppercase font-black text-gray-500 flex items-center gap-2">
                      <Download size={12} />
                      Download & Abrir Fatiadores
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {SLICERS.map((slicer) => (
                        <div 
                          key={slicer.name}
                          className="bg-[#1e2638] border border-[#2d374d] hover:border-blue-500 p-3 rounded-xl transition-all group relative"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold flex items-center gap-2">
                              <div className="w-5 h-5 bg-white/5 rounded flex items-center justify-center text-[8px] font-black text-blue-400">
                                {slicer.icon}
                              </div>
                              {slicer.name}
                            </span>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  openLocalSlicer(slicer);
                                }}
                                className="p-1 hover:text-blue-500 transition-colors flex items-center gap-1"
                                title="Abrir no Computador"
                              >
                                <ExternalLink size={12} />
                                <span className="text-[8px] font-bold uppercase">Abrir</span>
                              </button>
                              <button 
                                onClick={copySettingsToClipboard}
                                className="p-1 hover:text-emerald-500 transition-colors flex items-center gap-1"
                                title="Copiar Configurações"
                              >
                                <Save size={12} />
                                <span className="text-[8px] font-bold uppercase">Configs</span>
                              </button>
                              <a 
                                href={slicer.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 hover:text-blue-500 transition-colors"
                                title="Download"
                              >
                                <Download size={12} />
                              </a>
                            </div>
                          </div>
                          <p className="text-[9px] text-gray-500 leading-tight line-clamp-2">
                            {slicer.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Model Repositories */}
                  <div className="space-y-3">
                    <p className="text-[10px] uppercase font-black text-gray-500 flex items-center gap-2">
                      <Box size={12} />
                      Repositórios de Modelos 3D
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <a 
                        href="https://makerworld.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="bg-[#1e2638] border border-[#2d374d] hover:border-blue-500 p-3 rounded-xl transition-all flex items-center justify-between group"
                      >
                        <span className="text-xs font-bold">Maker World</span>
                        <ExternalLink size={12} className="text-gray-600 group-hover:text-blue-500" />
                      </a>
                      <a 
                        href="https://www.crealitycloud.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="bg-[#1e2638] border border-[#2d374d] hover:border-blue-500 p-3 rounded-xl transition-all flex items-center justify-between group"
                      >
                        <span className="text-xs font-bold">Creality Cloud</span>
                        <ExternalLink size={12} className="text-gray-600 group-hover:text-blue-500" />
                      </a>
                    </div>
                  </div>

                  <p className="text-[9px] text-gray-500 italic text-center pt-2 border-t border-[#2d374d]/30">
                    Sincronize tempos e gastos reais diretamente do seu fatiador ou impressora.
                  </p>
                </div>
              </div>
          )}
        </div>

        <footer className="text-center pt-8 space-y-2">
          <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
            PRINTCALC-PRO • INTELIGÊNCIA EM CUSTOS 3D
          </p>
          <p className="text-xs font-black uppercase tracking-widest bg-gradient-to-r from-red-600 via-orange-500 to-orange-400 bg-clip-text text-transparent">
            Derretendo Ideias 3D
          </p>
        </footer>
      </div>
    </main>
  );
}
