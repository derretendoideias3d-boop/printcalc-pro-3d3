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
  Minus
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
    icon: "C"
  },
  {
    name: "PrusaSlicer",
    description: "Muito usado por usuários avançados. Baseado no antigo Slic3r. Suporta impressoras FDM e também resina.",
    url: "https://www.prusa3d.com/prusaslicer/",
    icon: "P"
  },
  {
    name: "Bambu Studio",
    description: "Fatiador oficial das impressoras Bambu Lab. Otimizado para alta velocidade e AMS (multicolor).",
    url: "https://bambulab.com/en/download/studio",
    icon: "B"
  },
  {
    name: "Orca Slicer",
    description: "Baseado no Bambu Studio e PrusaSlicer. Muito usado para calibração e impressão multicolor.",
    url: "https://github.com/SoftFever/OrcaSlicer/releases",
    icon: "O"
  },
  {
    name: "Creality Print",
    description: "Fatiador oficial das impressoras Creality. Interface simples para Ender, K1, CR etc.",
    url: "https://www.creality.com/pages/download-software",
    icon: "Cr"
  },
  {
    name: "Simplify3D",
    description: "Fatiador profissional pago. Muito controle avançado de impressão.",
    url: "https://www.simplify3d.com/",
    icon: "S"
  },
  {
    name: "IdeaMaker",
    description: "Criado pela Raise3D. Interface moderna e fácil de usar.",
    url: "https://www.raise3d.com/ideamaker/",
    icon: "I"
  },
  {
    name: "SuperSlicer",
    description: "Versão avançada do PrusaSlicer. Muitas opções de ajuste fino.",
    url: "https://github.com/supermerill/SuperSlicer/releases",
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

const PRINTER_BRANDS = Object.keys(PRINTER_MODELS);

const FILAMENT_BRANDS = [
  "Bambu Lab", "eSun", "SUNLU", "Overture", "Hatchbox", "Polymaker", "ColorFabb", "Prusament",
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
};

const DEFAULT_PRINTER_DATA: Record<string, { power: number, speed: number }> = {
  "X1 Carbon": { power: 350, speed: 500 },
  "X1": { power: 350, speed: 500 },
  "P1P": { power: 350, speed: 500 },
  "P1S": { power: 350, speed: 500 },
  "A1": { power: 150, speed: 500 },
  "A1 Mini": { power: 150, speed: 500 },
  "Ender 3": { power: 150, speed: 60 },
  "Ender 3 V2": { power: 150, speed: 60 },
  "Ender 3 V3": { power: 350, speed: 600 },
  "K1": { power: 350, speed: 600 },
  "K1 Max": { power: 350, speed: 600 },
  "MK3S+": { power: 200, speed: 100 },
  "MK4": { power: 200, speed: 200 },
  "Mini+": { power: 150, speed: 100 },
  "XL": { power: 350, speed: 200 },
  "Neptune 4": { power: 350, speed: 500 },
  "Neptune 4 Pro": { power: 350, speed: 500 },
  "Neptune 4 Max": { power: 400, speed: 500 },
  "Sidewinder X2": { power: 350, speed: 150 },
  "Sidewinder X3": { power: 350, speed: 500 },
  "Kobra 2": { power: 350, speed: 300 },
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
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-[#1e2638] border border-[#2d374d] text-white rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 transition-colors hover:bg-[#1e2638] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
    {suffix && (
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-medium pointer-events-none">
        {suffix}
      </span>
    )}
    {type === "number" && (
      <div className="absolute right-10 top-1/2 -translate-y-1/2 flex flex-col opacity-0 group-hover/label:opacity-100 transition-opacity">
        <button 
          onClick={() => onChange((Number(value) + 1).toString())}
          className="text-gray-600 hover:text-blue-500 p-0.5"
        >
          <ChevronRight size={10} className="-rotate-90" />
        </button>
        <button 
          onClick={() => onChange((Number(value) - 1).toString())}
          className="text-gray-600 hover:text-blue-500 p-0.5"
        >
          <ChevronRight size={10} className="rotate-90" />
        </button>
      </div>
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
    power: 150
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
      { id: Date.now().toString(), name: "Peça 1", weight: 50, time: 2.5, price: 0 }
    ],
    energyPrice: 0.85, // R$/kWh
    failRisk: 10, // %
    laborCost: 0,
    packagingCost: 0,
    shippingCost: 0,
    platformFee: 0,
    markup: 40
  });

  const [savedBudgets, setSavedBudgets] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('printcalc_budgets');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Error loading saved budgets", e);
        }
      }
    }
    return [];
  });
  const [uploadedFile, setUploadedFile] = useState<{ url: string | null, type: string | null }>({ url: null, type: null });

  const results = useMemo(() => {
    const totalWeight = budget.items.reduce((sum, item) => sum + (item.weight || 0), 0);
    const totalTime = budget.items.reduce((sum, item) => sum + (item.time || 0), 0);
    const totalItemsPrice = budget.items.reduce((sum, item) => sum + (item.price || 0), 0);

    const materialCost = (totalWeight / 1000) * filament.pricePerKg;
    const energyCost = (totalTime * printer.power / 1000) * budget.energyPrice;
    const wearCost = totalTime * 0.5; // R$ 0.50 per hour for wear/maintenance
    const failRiskCost = (materialCost + energyCost + wearCost) * (budget.failRisk / 100);
    
    const totalMfgCost = materialCost + energyCost + wearCost + failRiskCost + budget.laborCost + budget.packagingCost;
    
    const markupAmount = totalMfgCost * (budget.markup / 100);
    const calculatedBase = totalMfgCost + markupAmount;
    
    // If manual prices are set, we use them as the base price.
    // Otherwise, we use the calculated cost + markup.
    const basePrice = totalItemsPrice > 0 ? totalItemsPrice : calculatedBase;
    
    // Shipping is added after the base price.
    const subtotalWithShipping = basePrice + budget.shippingCost;
    
    // Platform fee is calculated on the subtotal including shipping.
    const feeAmount = subtotalWithShipping * (budget.platformFee / 100);
    const finalPrice = subtotalWithShipping + feeAmount;

    return {
      totalWeight,
      totalTime,
      totalItemsPrice,
      materialCost,
      energyCost,
      wearCost,
      failRiskCost,
      totalMfgCost,
      markupAmount,
      basePrice,
      feeAmount,
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
      power: 150
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
        { id: Date.now().toString(), name: "Peça 1", weight: 50, time: 2.5, price: 0 }
      ],
      energyPrice: 0.85,
      failRisk: 10,
      laborCost: 0,
      packagingCost: 0,
      shippingCost: 0,
      platformFee: 0,
      markup: 40
    });
    setUploadedFile({ url: null, type: null });
  }

  const nextStep = () => {
    setStep(prev => Math.min(prev + 1, 3));
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
                price: 0
              }
            ]
          }));
        }
      };
      reader.readAsText(file.slice(0, 100000)); // Read first 100KB for comments
      setUploadedFile({ url: null, type: 'gcode' });
    } else {
      setUploadedFile({ url: null, type: 'other' });
    }
  };

  const saveBudget = () => {
    const newBudget = {
      ...budget,
      id: budget.id || Date.now().toString(),
      filament,
      printer,
      results,
      updatedAt: new Date().toISOString()
    };

    let updated;
    if (budget.id) {
      updated = savedBudgets.map(b => b.id === budget.id ? newBudget : b);
    } else {
      updated = [newBudget, ...savedBudgets];
    }

    setSavedBudgets(updated);
    localStorage.setItem('printcalc_budgets', JSON.stringify(updated));
    setBudget(prev => ({ ...prev, id: newBudget.id }));
    alert('Orçamento salvo com sucesso!');
  };

  const deleteBudget = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este orçamento?')) {
      const updated = savedBudgets.filter(b => b.id !== id);
      setSavedBudgets(updated);
      localStorage.setItem('printcalc_budgets', JSON.stringify(updated));
      if (budget.id === id) {
        resetCalculator();
      }
    }
  };

  const loadBudget = (b: any) => {
    setBudget({
      id: b.id,
      clientName: b.clientName || "",
      clientPhone: b.clientPhone || "",
      clientEmail: b.clientEmail || "",
      clientNotes: b.clientNotes || "",
      fileName: b.fileName || "",
      projectImage: b.projectImage || null,
      items: b.items || [
        { id: Date.now().toString(), name: b.fileName || "Peça 1", weight: b.weight || 0, time: b.time || 0, price: 0 }
      ],
      energyPrice: b.energyPrice || 0.85,
      failRisk: b.failRisk || 10,
      laborCost: b.laborCost || 0,
      packagingCost: b.packagingCost || 0,
      shippingCost: b.shippingCost || 0,
      platformFee: b.platformFee || 0,
      markup: b.markup || 40
    });
    if (b.filament) setFilament(b.filament);
    if (b.printer) setPrinter(b.printer);
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        
        const itemRows = budget.items.map((item, index) => [
          index + 1,
          item.name || `Peça ${index + 1}`,
          item.quantity || 1,
          `${item.weight}g`,
          `${item.time}h`,
          `R$ ${(item.price || 0).toFixed(2)}`
        ]);

        autoTable(doc, {
          startY: currentY + 5,
          head: [['#', 'Nome da Peça', 'Qtd', 'Peso', 'Tempo', 'Valor']],
          body: itemRows,
          theme: 'grid',
          headStyles: { fillColor: [100, 100, 100] },
          styles: { fontSize: 8 }
        });

        const lastTable = (doc as any).lastAutoTable;
        currentY = (lastTable && lastTable.finalY) ? lastTable.finalY + 15 : 
                   (lastTable && lastTable.cursor) ? lastTable.cursor.y + 15 : currentY + 40;

        // --- Budget Summary Table ---
        autoTable(doc, {
          startY: currentY,
          head: [['Resumo Financeiro', 'Valor']],
          body: [
            ['Material', `${filament.brand} ${filament.type}`],
            ['Total de Peso', `${results.totalWeight}g`],
            ['Total de Tempo', `${results.totalTime}h`],
            ['Custo de Material', `R$ ${results.materialCost.toFixed(2)}`],
            ['Custo de Energia', `R$ ${results.energyCost.toFixed(2)}`],
            ['Mão de Obra', `R$ ${budget.laborCost.toFixed(2)}`],
            ['Embalagem', `R$ ${budget.packagingCost.toFixed(2)}`],
            ['Frete / Envio', `R$ ${budget.shippingCost.toFixed(2)}`],
            ['Taxas de Plataforma', `R$ ${results.feeAmount.toFixed(2)}`],
            ['PREÇO FINAL', `R$ ${results.finalPrice.toFixed(2)}`],
          ],
          theme: 'striped',
          headStyles: { fillColor: [37, 99, 235] },
          styles: { fontSize: 9, cellPadding: 3 },
          columnStyles: {
            1: { halign: 'right', fontStyle: 'bold' }
          }
        });
        
        if (budget.clientNotes) {
          const lastTableSummary = (doc as any).lastAutoTable;
          const finalY = (lastTableSummary && lastTableSummary.finalY) ? lastTableSummary.finalY + 10 :
                         (lastTableSummary && lastTableSummary.cursor) ? lastTableSummary.cursor.y + 10 : currentY + 20;
          doc.setFontSize(10);
          doc.setTextColor(0, 0, 0);
          doc.text('OBSERVAÇÕES:', 14, finalY);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.text(budget.clientNotes, 14, finalY + 5, { maxWidth: 180 });
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
    const message = `*ORÇAMENTO DE IMPRESSÃO 3D*
------------------------------
*Cliente:* ${budget.clientName || 'N/A'}
${budget.clientPhone ? `*Contato:* ${budget.clientPhone}\n` : ''}*Projeto:* ${budget.fileName || 'N/A'}
*Material:* ${filament.brand} ${filament.type}
*Peso Total:* ${results.totalWeight}g
*Tempo Total:* ${results.totalTime}h
------------------------------
*DETALHAMENTO DE CUSTOS:*
• Material: R$ ${results.materialCost.toFixed(2)}
• Energia: R$ ${results.energyCost.toFixed(2)}
• Desgaste/Manutenção: R$ ${results.wearCost.toFixed(2)}
• Mão de Obra: R$ ${budget.laborCost.toFixed(2)}
• Embalagem: R$ ${budget.packagingCost.toFixed(2)}
${budget.platformFee > 0 ? `• Taxas de Plataforma: R$ ${results.feeAmount.toFixed(2)}\n` : ''}${budget.shippingCost > 0 ? `• Envio/Frete: R$ ${budget.shippingCost.toFixed(2)}\n` : ''}
*Investimento Total:* R$ ${results.finalPrice.toFixed(2)}
${budget.clientNotes ? `\n*Observações:* ${budget.clientNotes}` : ''}

_Gerado por PRINTCALC-PRO_
_Derretendo Ideias 3D_`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const openLocalSlicer = (slicer: any) => {
    // Attempt to open via protocol or just inform
    if (slicer.name.includes('Bambu')) {
      window.open('bambulab://', '_self');
    } else {
      alert(`Para abrir o ${slicer.name}, certifique-se de que ele está instalado no seu computador e use o atalho do sistema.`);
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
              <span className="text-[10px] font-black text-blue-500 uppercase bg-blue-500/10 px-2 py-1 rounded-md">Passo {step}/3</span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3].map(i => (
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
              <div className="flex items-center gap-2 text-gray-400">
                <FileText size={16} />
                <h2 className="text-sm font-bold uppercase tracking-wider font-display">Orçamento e Projeto</h2>
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
                    label="Observações do Cliente" 
                    icon={FileText}
                    tooltip="Notas adicionais sobre o pedido ou cliente."
                  >
                    <textarea 
                      value={budget.clientNotes || ''}
                      onChange={(e) => setBudget(p => ({ ...p, clientNotes: e.target.value }))}
                      placeholder="ex: Cliente solicitou acabamento liso..."
                      className="w-full bg-[#1e2638] border border-[#2d374d] text-white rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 transition-colors min-h-[80px]"
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
                        items: [...p.items, { id: Date.now().toString(), name: `Peça ${p.items.length + 1}`, weight: 0, time: 0, price: 0 }] 
                      }))}
                      className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors"
                    >
                      <Plus size={12} />
                      Adicionar Peça
                    </button>
                  </div>

                  <div className="space-y-3">
                    {budget.items.map((item, index) => (
                      <div key={item.id} className="bg-[#1e2638] border border-[#2d374d] rounded-xl p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-blue-500 uppercase">Item #{index + 1}</span>
                          {budget.items.length > 1 && (
                            <button 
                              onClick={() => setBudget(p => ({ ...p, items: p.items.filter(i => i.id !== item.id) }))}
                              className="text-gray-500 hover:text-red-500 transition-colors"
                            >
                              <Minus size={14} />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-500 uppercase font-bold">Nome da Peça</label>
                            <input 
                              type="text"
                              value={item.name || ''}
                              onChange={(e) => {
                                const newItems = [...budget.items];
                                newItems[index].name = e.target.value;
                                setBudget(p => ({ ...p, items: newItems }));
                              }}
                              className="w-full bg-[#151b2b] border border-[#2d374d] text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                              placeholder="ex: Suporte A"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-500 uppercase font-bold">Peso (g)</label>
                            <input 
                              type="number"
                              value={item.weight ?? 0}
                              onChange={(e) => {
                                const newItems = [...budget.items];
                                newItems[index].weight = parseFloat(e.target.value) || 0;
                                setBudget(p => ({ ...p, items: newItems }));
                              }}
                              className="w-full bg-[#151b2b] border border-[#2d374d] text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-500 uppercase font-bold">Tempo (h)</label>
                            <input 
                              type="number"
                              value={item.time ?? 0}
                              onChange={(e) => {
                                const newItems = [...budget.items];
                                newItems[index].time = parseFloat(e.target.value) || 0;
                                setBudget(p => ({ ...p, items: newItems }));
                              }}
                              className="w-full bg-[#151b2b] border border-[#2d374d] text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-500 uppercase font-bold">Valor (R$)</label>
                            <input 
                              type="number"
                              value={item.price ?? 0}
                              onChange={(e) => {
                                const newItems = [...budget.items];
                                newItems[index].price = parseFloat(e.target.value) || 0;
                                setBudget(p => ({ ...p, items: newItems }));
                              }}
                              className="w-full bg-[#151b2b] border border-[#2d374d] text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                              placeholder="0.00"
                            />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="flex flex-col justify-center border-l-4 border-l-blue-500 hover:bg-[#161c2d] transition-none">
              <p className="text-[10px] uppercase font-black text-gray-500">Custo Total de Fab.</p>
              <p className="text-2xl font-black text-blue-400 font-display">R$ {results.totalMfgCost.toFixed(2)}</p>
            </Card>
            <Card className="flex flex-col justify-center border-l-4 border-l-emerald-500 hover:bg-[#161c2d] transition-none">
              <p className="text-[10px] uppercase font-black text-gray-500">Preço Sugerido</p>
              <p className="text-2xl font-black text-emerald-400 font-display">R$ {results.finalPrice.toFixed(2)}</p>
            </Card>
          </div>

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
            {step < 3 && (
              <button 
                onClick={nextStep}
                className="flex-[2] bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-900/40 transition-all flex items-center justify-center gap-2 uppercase tracking-tighter"
              >
                Próximo Passo
                <ChevronRight size={20} />
              </button>
            )}
          </div>
          
          {step === 3 && (
            <div className="space-y-4">
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
              </div>

                <button 
                  onClick={saveBudget}
                  className="w-full bg-[#1e2638] border border-[#2d374d] hover:border-blue-500 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  {budget.id ? 'Atualizar Orçamento' : 'Salvar Orçamento'}
                </button>
                
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
                                onClick={() => openLocalSlicer(slicer)}
                                className="p-1 hover:text-blue-500 transition-colors"
                                title="Abrir no Computador"
                              >
                                <ExternalLink size={12} />
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

        {/* Saved Budgets Section - Visible in all steps */}
        {savedBudgets.length > 0 && (
          <Card className="bg-[#1e2638]/30 mt-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <RotateCcw size={16} className="text-blue-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Histórico de Orçamentos</h3>
              </div>
              <span className="text-[10px] font-bold text-gray-500 uppercase">{savedBudgets.length} itens</span>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
              {savedBudgets.map((item) => (
                <div key={item.id} className="bg-[#1e2638] p-3 rounded-xl border border-[#2d374d] flex items-center justify-between group hover:border-blue-500/50 transition-all">
                  <div className="flex-1 cursor-pointer" onClick={() => loadBudget(item)}>
                    <p className="text-xs font-bold truncate">{item.clientName || 'Sem Cliente'} - {item.fileName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[9px] text-gray-500 uppercase font-bold">
                        {new Date(item.updatedAt).toLocaleDateString()} • R$ {item.results?.finalPrice?.toFixed(2) || '0.00'}
                      </p>
                      {item.clientPhone && (
                        <span className="text-[9px] text-green-500 font-bold bg-green-500/10 px-1.5 py-0.5 rounded">WhatsApp</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => loadBudget(item)}
                      className="p-2 text-gray-600 hover:text-blue-500 transition-colors"
                      title="Editar Orçamento"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => deleteBudget(item.id)}
                      className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                      title="Excluir Orçamento"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

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
