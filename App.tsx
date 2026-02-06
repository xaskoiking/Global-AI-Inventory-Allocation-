
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Building2, HeartHandshake, Truck, Zap, Navigation,
  MapPin, Clock, Plus, Activity,
  ShoppingCart, Loader2, DollarSign, X, Camera,
  ShieldCheck, ExternalLink, Route,
  Sparkles, ScanLine, MapPinned,
  Globe, MousePointer2, MoveRight, Check,
  Link, Map, ShieldAlert, Thermometer, BadgeCheck,
  Wallet, Percent, ArrowRight, Info, Layers, Search
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { FoodType, LocationData, LogisticsPlan, Driver } from './types';
import { gaiaAI } from './services/geminiService';

const createMarkerIcon = (color: string, available: number, committed: number = 0, selected: boolean = false, isPairing: boolean = false) => new L.DivIcon({
  className: 'custom-marker',
  html: `
    <div class="relative flex items-center justify-center">
      <div style="background: ${color}; width: ${selected ? '32px' : '22px'}; height: ${selected ? '32px' : '22px'}; border: 4px solid ${selected ? '#000' : '#fff'}; border-radius: 50%; box-shadow: ${selected ? '0 0 0 4px rgba(0,0,0,0.1)' : '0 4px 12px rgba(0,0,0,0.1)'}; transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);"></div>
      ${selected ? `<div class="absolute -top-1 -right-1 bg-black text-white p-0.5 rounded-full"><Check size={8} /></div>` : ''}
      <div class="absolute -top-6 left-6 flex flex-col gap-0.5 pointer-events-none">
        <div class="bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-sm whitespace-nowrap">
          <span class="text-[9px] font-black text-slate-900">${available} avl</span>
        </div>
        ${committed > 0 ? `
        <div class="bg-blue-500 border border-blue-600 px-2 py-0.5 rounded-md shadow-sm whitespace-nowrap">
          <span class="text-[9px] font-black text-white">${committed} commit</span>
        </div>
        ` : ''}
      </div>
    </div>
  `,
  iconSize: selected ? [32, 32] : [22, 22],
  iconAnchor: selected ? [16, 16] : [11, 11]
});

const DEFAULT_CENTER: [number, number] = [20.0, 0.0];

const INITIAL_NODES: LocationData[] = [
  { id: 'R1', name: 'Neighborhood Bistro', lat: 33.7709, lng: -84.3837, type: 'surplus', establishmentType: 'Restaurant', foodType: FoodType.HOT_MEALS, quantity: 25, urgency: 'critical', managedBy: 'Kitchen Mgr' },
  { id: 'S1', name: 'Community Support Center', lat: 33.7667, lng: -84.3942, type: 'demand', establishmentType: 'Shelter', foodType: FoodType.HOT_MEALS, quantity: 40, urgency: 'high', managedBy: 'Coordinator' },
];

const INITIAL_DRIVERS: Driver[] = [
  { id: 'D1', name: 'Alex Johnson', provider: 'UberDirect', trustScore: 98, certifications: ['FHC-2024'], history: [] },
  { id: 'D2', name: 'Sarah Miller', provider: 'DoorDashDrive', trustScore: 92, certifications: ['FHC-2023'], history: [] },
];

const RecenterMap = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center]);
  return null;
};

const App: React.FC = () => {
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [locations, setLocations] = useState<LocationData[]>(() => {
    const saved = localStorage.getItem('ecofeed_locations');
    return saved ? JSON.parse(saved) : INITIAL_NODES;
  });
  const [plans, setPlans] = useState<LogisticsPlan[]>([]);
  const [drivers] = useState<Driver[]>(INITIAL_DRIVERS);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formType, setFormType] = useState<'surplus' | 'demand'>('surplus');
  const [pendingLoc, setPendingLoc] = useState<{ lat: number, lng: number, name: string } | null>(null);
  const [nearbyResults, setNearbyResults] = useState<any[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);

  const [isPairingMode, setIsPairingMode] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [aiMetadata, setAiMetadata] = useState<any>(null);

  const [activeInspectionPlanId, setActiveInspectionPlanId] = useState<string | null>(null);
  const [tempInput, setTempInput] = useState<string>('');
  const [certInput, setCertInput] = useState<string>('');
  const [sealInput, setSealInput] = useState<boolean>(false);

  const [costPayerInput, setCostPayerInput] = useState<'Sender' | 'Receiver' | 'Split'>('Split');
  const [senderShareInput, setSenderShareInput] = useState<number>(50);

  const [sidebarWidth, setSidebarWidth] = useState(360);
  const [bottomHeight, setBottomHeight] = useState(240);
  const [isBottomCollapsed, setIsBottomCollapsed] = useState(false);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingBottom, setIsResizingBottom] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const startResizingSidebar = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
  }, []);

  const startResizingBottom = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingBottom(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizingSidebar(false);
    setIsResizingBottom(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizingSidebar) {
      const newWidth = e.clientX;
      if (newWidth > 250 && newWidth < 600) {
        setSidebarWidth(newWidth);
      }
    }
    if (isResizingBottom) {
      const newHeight = window.innerHeight - e.clientY;
      if (newHeight > 60 && newHeight < window.innerHeight - 200) {
        setBottomHeight(newHeight);
      }
    }
  }, [isResizingSidebar, isResizingBottom]);

  const [citySearch, setCitySearch] = useState('');
  const [isSearchingCity, setIsSearchingCity] = useState(false);

  useEffect(() => {
    if (isResizingSidebar || isResizingBottom) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
      document.body.style.cursor = isResizingSidebar ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingSidebar, isResizingBottom, resize, stopResizing]);

  // Handle map resizing when panels move
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 10);
    return () => clearTimeout(timer);
  }, [sidebarWidth, bottomHeight, isBottomCollapsed]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setMapCenter([pos.coords.latitude, pos.coords.longitude]),
        () => setMapCenter([33.7490, -84.3880])
      );
    }
  }, []);

  const committedByLocation = useMemo(() => {
    const map: Record<string, number> = {};
    plans.forEach(plan => {
      map[plan.sourceId] = (map[plan.sourceId] || 0) + plan.quantityMoved;
      map[plan.destinationId] = (map[plan.destinationId] || 0) + plan.quantityMoved;
    });
    return map;
  }, [plans]);

  const runDispatch = useCallback(async () => {
    const surplus = locations.filter(l => l.type === 'surplus' && l.quantity > 0);
    const demand = locations.filter(l => l.type === 'demand' && l.quantity > 0);
    if (surplus.length === 0 || demand.length === 0) return alert("Nodes required.");

    setLoading(true);
    try {
      const result = await gaiaAI.dispatchRescue(surplus, demand);
      setPlans(prev => [...prev, ...result.map(p => ({
        ...p,
        driverId: drivers[Math.floor(Math.random() * drivers.length)].id,
        senderCostShare: p.costPayer === 'Split' ? 50 : (p.costPayer === 'Sender' ? 100 : 0)
      }))]);
    } catch (err) {
      console.error("[GaiaAI] Dispatch Error:", err);
      alert("AI Dispatch failed. Check console for details. Re-run or pair manually.");
    } finally {
      setLoading(false);
    }
  }, [locations, drivers]);

  const handleCitySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!citySearch.trim()) return;
    setIsSearchingCity(true);
    try {
      const result = await gaiaAI.geocode(citySearch);
      if (result) {
        setMapCenter([result.lat, result.lng]);
        setCitySearch(result.name);
      } else {
        alert("Location not found.");
      }
    } catch (err) {
      console.error("City search error:", err);
    } finally {
      setIsSearchingCity(false);
    }
  };

  const handleManualPair = async () => {
    if (!selectedSourceId || !selectedDestinationId) return;
    const src = locations.find(l => l.id === selectedSourceId);
    const dst = locations.find(l => l.id === selectedDestinationId);
    if (!src || !dst) return;

    setLoading(true);
    try {
      const plan = await gaiaAI.generateManualPlan(src, dst);
      setPlans(prev => [...prev, {
        ...plan,
        driverId: drivers[Math.floor(Math.random() * drivers.length)].id,
        senderCostShare: plan.costPayer === 'Split' ? 50 : (plan.costPayer === 'Sender' ? 100 : 0)
      }]);
      setIsPairingMode(false);
      setSelectedSourceId(null);
      setSelectedDestinationId(null);
    } catch (err) {
      console.error("[GaiaAI] Manual Pair Error:", err);
      alert("Manual route finalization failed. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkerClick = (loc: LocationData) => {
    if (!isPairingMode) return;
    if (loc.type === 'surplus') {
      setSelectedSourceId(loc.id === selectedSourceId ? null : loc.id);
    } else {
      setSelectedDestinationId(loc.id === selectedDestinationId ? null : loc.id);
    }
  };

  const openAddModal = (type: 'surplus' | 'demand') => {
    setFormType(type);
    setPreviewImage(null);
    setAiMetadata(null);
    setIsModalOpen(true);
  };

  const discoverNodes = async () => {
    if (!pendingLoc) return;
    setIsDiscovering(true);
    try {
      const results = await gaiaAI.discoverNearbyNodes(pendingLoc.lat, pendingLoc.lng);
      setNearbyResults(results);
    } finally {
      setIsDiscovering(false);
    }
  };

  const registerHub = (hub: any) => {
    const newNode: LocationData = {
      id: 'H' + Date.now(),
      name: hub.name,
      lat: hub.lat,
      lng: hub.lng,
      type: 'demand',
      foodType: FoodType.CANNED, // Default for NGOs
      quantity: 100, // Initial capacity expectation
      urgency: 'medium',
      managedBy: 'GAIA Discovery Protocol'
    };
    setLocations(prev => [...prev, newNode]);
    setNearbyResults(prev => prev.filter(h => h.name !== hub.name));
  };

  const MapEvents = () => {
    useMapEvents({
      async click(e) {
        if (isPairingMode) return;
        setPendingLoc({ lat: e.latlng.lat, lng: e.latlng.lng, name: 'Resolving...' });
        const res = await gaiaAI.reverseGeocode(e.latlng.lat, e.latlng.lng);
        setPendingLoc({ ...e.latlng, name: res.name });
      }
    });
    return null;
  };

  const openInspection = (plan: LogisticsPlan) => {
    setActiveInspectionPlanId(plan.id);
    setTempInput('');
    setCertInput('');
    setSealInput(plan.inspectionDetails.sealed);
    setCostPayerInput(plan.costPayer);
    setSenderShareInput(plan.senderCostShare ?? (plan.costPayer === 'Split' ? 50 : (plan.costPayer === 'Sender' ? 100 : 0)));
  };

  const saveInspection = (isFailure: boolean = false) => {
    if (!activeInspectionPlanId) return;
    setPlans(prev => prev.map(p => {
      if (p.id === activeInspectionPlanId) {
        const details = { tempChecked: tempInput !== '', sealed: sealInput, specialistCertified: certInput !== '' };
        const status = isFailure ? 'Failed' : (details.tempChecked && details.sealed && details.specialistCertified ? 'Passed' : 'Pending');
        return {
          ...p,
          inspectionDetails: details,
          inspectionStatus: status,
          costPayer: costPayerInput,
          senderCostShare: costPayerInput === 'Split' ? senderShareInput : (costPayerInput === 'Sender' ? 100 : 0)
        };
      }
      return p;
    }));
    setActiveInspectionPlanId(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const result = reader.result as string;
      setPreviewImage(result);
      setIsAnalyzing(true);
      try {
        const base64 = result.split(',')[1];
        const mimeType = file.type || 'image/jpeg';
        const analysis = await gaiaAI.analyzeFoodImage(base64, mimeType);
        setAiMetadata(analysis);
      } catch (err) {
        console.error("[GaiaAI] Image analysis failed:", err);
        alert("AI Inventory analysis failed. You can still enter details manually.");
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const completeHandshake = (plan: LogisticsPlan) => {
    if (plan.inspectionStatus !== 'Passed') {
      alert("Please complete food safety and funding verification first.");
      return;
    }
    setPlans(prev => prev.filter(p => p.id !== plan.id));
    setLocations(prev => prev.map(loc => {
      if (loc.id === plan.sourceId || loc.id === plan.destinationId) {
        return { ...loc, quantity: Math.max(0, loc.quantity - plan.quantityMoved) };
      }
      return loc;
    }));
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans overflow-hidden">
      <header className="h-20 bg-white border-b px-8 flex justify-between items-center z-[2000] shadow-sm">
        <div className="flex items-center gap-5 group cursor-help relative">
          <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-500/30 transition-transform group-hover:scale-110 group-hover:rotate-12"><Zap size={22} fill="currentColor" /></div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black uppercase leading-none tracking-tighter">Gaia <span className="text-blue-600">3.0</span></h1>
              <div className="h-4 w-[1px] bg-slate-200"></div>
              <div className="flex gap-1">
                {['G', 'A', 'I', 'A'].map((letter, i) => (
                  <span key={i} className="text-[10px] font-black w-4 h-4 rounded-md bg-slate-900 text-white flex items-center justify-center">{letter}</span>
                ))}
              </div>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
              <span className="text-slate-900">Global AI Inventory Allocation</span>
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
              Smart-Grid System
            </p>
          </div>

          <div className="absolute top-full left-0 mt-3 w-80 bg-slate-900 text-white p-6 rounded-3xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[3000] border border-white/10">
            <div className="flex items-center gap-2 mb-4 text-blue-400">
              <Sparkles size={14} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Operational Definition</span>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="text-blue-400 font-black">G</span>
                <p className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">Global Reach Integration</p>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-400 font-black">A</span>
                <p className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">AI Reasoning Protocol</p>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-400 font-black">I</span>
                <p className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">Inventory Recovery Logic</p>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-400 font-black">A</span>
                <p className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">Allocation Efficiency</p>
              </li>
            </ul>
            <p className="mt-4 pt-4 border-t border-white/10 text-[10px] text-slate-400 leading-relaxed italic">
              GAIA treats food surplus like a utility, routing it safely to global demand hubs via the intelligent supply-grid.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <form onSubmit={handleCitySearch} className="relative group mr-4">
            <input
              type="text"
              value={citySearch}
              onChange={(e) => setCitySearch(e.target.value)}
              placeholder="Search global cities..."
              className="bg-slate-50 border-2 border-slate-100 px-5 py-3 rounded-2xl font-black text-[11px] uppercase tracking-wider outline-none focus:border-blue-500/40 focus:bg-white transition-all w-64 shadow-inner"
            />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-600 transition-colors">
              {isSearchingCity ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </button>
          </form>
          <button onClick={() => setIsPairingMode(!isPairingMode)} className={`px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 transition-all ${isPairingMode ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/30' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            <MousePointer2 size={14} /> {isPairingMode ? 'Exit Manual Mode' : 'Manual Pair'}
          </button>
          <button onClick={runDispatch} disabled={loading} className="px-7 py-3.5 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 bg-blue-600 text-white shadow-xl shadow-blue-500/40 hover:bg-blue-700 disabled:bg-slate-300 transition-all active:scale-95">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
            {loading ? 'Solving...' : 'Execute AI Dispatch'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside style={{ width: `${sidebarWidth}px` }} className="bg-white border-r flex flex-col z-10 overflow-y-auto custom-scrollbar relative flex-shrink-0">
          <div
            onMouseDown={startResizingSidebar}
            className="absolute right-0 top-0 w-1.5 h-full cursor-col-resize hover:bg-blue-400/30 transition-colors z-[100] group"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 bg-slate-200 rounded-full group-hover:bg-blue-400"></div>
          </div>
          {isPairingMode ? (
            <div className="p-6 bg-orange-50/70 border-b border-orange-100 space-y-4 animate-in fade-in slide-in-from-left duration-300">
              <div className="flex items-center gap-2 text-orange-600 mb-2">
                <MousePointer2 size={16} />
                <h2 className="text-[11px] font-black uppercase tracking-widest">Interactive Pairing</h2>
              </div>
              <div className="space-y-3">
                <div className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${selectedSourceId ? 'bg-blue-600 border-blue-700 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 border-dashed'}`}>
                  <span className="text-[10px] font-black uppercase truncate max-w-[220px]">1. {selectedSourceId ? locations.find(l => l.id === selectedSourceId)?.name : 'Tap a Surplus Node'}</span>
                  {selectedSourceId && <Check size={14} />}
                </div>
                <div className="flex justify-center py-0"><ArrowRight size={16} className="text-slate-300 rotate-90" /></div>
                <div className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${selectedDestinationId ? 'bg-emerald-600 border-emerald-700 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 border-dashed'}`}>
                  <span className="text-[10px] font-black uppercase truncate max-w-[220px]">2. {selectedDestinationId ? locations.find(l => l.id === selectedDestinationId)?.name : 'Tap a Demand Node'}</span>
                  {selectedDestinationId && <Check size={14} />}
                </div>
              </div>
              <button
                onClick={handleManualPair}
                disabled={!selectedSourceId || !selectedDestinationId || loading}
                className={`w-full py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${selectedSourceId && selectedDestinationId ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Link size={14} />}
                Finalize Route
              </button>
            </div>
          ) : (
            <div className="p-6 border-b bg-slate-50/30 space-y-4">
              {pendingLoc ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-top duration-300">
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => openAddModal('surplus')} className="p-5 bg-blue-600 text-white rounded-[24px] flex flex-col items-center gap-2 shadow-lg shadow-blue-500/20 hover:scale-105 transition-transform">
                      <Plus size={20} /><span className="text-[10px] font-black uppercase">Sender</span>
                    </button>
                    <button onClick={() => openAddModal('demand')} className="p-5 bg-emerald-600 text-white rounded-[24px] flex flex-col items-center gap-2 shadow-lg shadow-emerald-500/20 hover:scale-105 transition-transform">
                      <ShoppingCart size={20} /><span className="text-[10px] font-black uppercase">Receiver</span>
                    </button>
                  </div>
                  <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-slate-100 rounded-lg"><MapPin size={12} className="text-slate-600" /></div>
                      <p className="text-[10px] font-black text-slate-900 uppercase truncate">{pendingLoc.name}</p>
                    </div>
                    <button onClick={discoverNodes} disabled={isDiscovering} className="w-full py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-indigo-100 transition-colors">
                      {isDiscovering ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />} Discover Local Hubs
                    </button>
                    {nearbyResults.length > 0 && (
                      <div className="space-y-3 pt-2">
                        {nearbyResults.map((c, i) => (
                          <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 group hover:bg-white hover:shadow-md transition-all">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-slate-900 uppercase truncate pr-2">{c.name}</span>
                              <a href={c.website} target="_blank" className="text-slate-400 hover:text-blue-600 transition-colors">
                                <ExternalLink size={12} />
                              </a>
                            </div>
                            <p className="text-[9px] font-bold text-slate-500 leading-relaxed line-clamp-2">{c.description}</p>
                            <button
                              onClick={() => registerHub(c)}
                              className="w-full py-2 bg-white border border-slate-200 text-blue-600 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"
                            >
                              <Plus size={10} /> Register to Grid
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-10 border-2 border-dashed border-slate-200 rounded-[32px] text-center text-slate-400 flex flex-col items-center">
                  <div className="p-4 bg-slate-50 rounded-full mb-3"><MapPinned size={28} className="opacity-40" /></div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-tight">Interact with the map<br />to deploy supply nodes</p>
                </div>
              )}
            </div>
          )}

          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Activity size={14} className="text-blue-600" /> Network Hubs
              </h3>
              <span className="bg-slate-100 text-slate-500 text-[9px] font-black px-2 py-0.5 rounded-full">{locations.length} ACTIVE</span>
            </div>
            <div className="space-y-3">
              {locations.filter(l => l.quantity > 0).map(loc => (
                <div key={loc.id} onClick={() => handleMarkerClick(loc)} className={`p-4 rounded-[24px] border-2 flex items-center gap-4 transition-all cursor-pointer ${isPairingMode && (selectedSourceId === loc.id || selectedDestinationId === loc.id) ? 'scale-[1.03] border-slate-900 shadow-xl z-20 bg-white' : (loc.type === 'surplus' ? 'bg-blue-50/40 border-transparent hover:border-blue-200 hover:bg-blue-50/60' : 'bg-emerald-50/40 border-transparent hover:border-emerald-200 hover:bg-emerald-50/60')}`}>
                  <div className={`p-3 rounded-2xl shadow-sm ${loc.type === 'surplus' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'}`}><Building2 size={18} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-black truncate uppercase text-slate-900 tracking-tight">{loc.name}</p>
                      {isPairingMode && (selectedSourceId === loc.id || selectedDestinationId === loc.id) && <div className="bg-slate-900 text-white p-1 rounded-full"><Check size={10} /></div>}
                    </div>
                    {loc.dishName && <p className="text-[10px] font-black text-blue-600 uppercase tracking-tighter mb-1">📦 {loc.dishName}</p>}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${loc.type === 'surplus' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{loc.foodType}</span>
                      <span className="text-[10px] font-bold text-slate-500">{loc.quantity} portions</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 relative flex flex-col bg-slate-50">
          <div className="flex-1 z-0 relative">
            <MapContainer center={mapCenter} zoom={13} zoomControl={false} className="h-full w-full">
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png" />
              <MapEvents />
              <RecenterMap center={mapCenter} />
              {plans.map(plan => (
                plan.routeGeometry && (
                  <Polyline
                    key={plan.id}
                    positions={plan.routeGeometry}
                    pathOptions={{ color: '#3b82f6', weight: 6, opacity: 0.8, lineJoin: 'round', dashArray: '1, 12' }}
                  />
                )
              ))}
              {locations.filter(l => l.quantity > 0).map(loc => (
                <Marker
                  key={loc.id}
                  position={[loc.lat, loc.lng]}
                  icon={createMarkerIcon(
                    loc.type === 'surplus' ? '#3b82f6' : '#10b981',
                    loc.quantity,
                    committedByLocation[loc.id] || 0,
                    selectedSourceId === loc.id || selectedDestinationId === loc.id,
                    isPairingMode
                  )}
                  eventHandlers={{ click: () => handleMarkerClick(loc) }}
                />
              ))}
            </MapContainer>

            <div className="absolute top-6 left-6 z-[1000] flex flex-col gap-2">
              <div className="bg-white/80 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-white/50 flex flex-col gap-1">
                <button className="p-2.5 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl transition-colors"><Navigation size={20} /></button>
                <button className="p-2.5 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl transition-colors"><MapPin size={20} /></button>
              </div>
            </div>
          </div>

          <div
            style={{ height: isBottomCollapsed ? '60px' : `${bottomHeight}px` }}
            className="bg-white border-t border-slate-100 z-10 flex flex-col shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] overflow-hidden transition-[height] duration-200 relative flex-shrink-0"
          >
            {!isBottomCollapsed && (
              <div
                onMouseDown={startResizingBottom}
                className="absolute top-0 left-0 w-full h-1.5 cursor-row-resize hover:bg-blue-400/30 transition-colors z-[100] group"
              >
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-0.5 bg-slate-200 rounded-full group-hover:bg-blue-400"></div>
              </div>
            )}
            <div className="px-10 py-5 border-b border-slate-50 flex items-center justify-between bg-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><Route size={18} /></div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] leading-none">Live Dispatch Grid</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Universal Food Supply Chain Matrix</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                  <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">{plans.length} ROUTES ACTIVE</span>
                </div>
                <button
                  onClick={() => setPlans([])}
                  className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[9px] font-black uppercase hover:bg-red-100 transition-colors"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setIsBottomCollapsed(!isBottomCollapsed)}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-all"
                >
                  {isBottomCollapsed ? <Layers size={18} /> : <X size={18} />}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto p-8 flex gap-6 custom-scrollbar bg-slate-50/50">
              {plans.length > 0 ? plans.map(plan => {
                const src = locations.find(l => l.id === plan.sourceId);
                const dst = locations.find(l => l.id === plan.destinationId);
                const isVerified = plan.inspectionStatus === 'Passed';

                return (
                  <div key={plan.id} className={`min-w-[520px] bg-white border rounded-[40px] p-8 flex flex-col gap-6 shadow-sm hover:shadow-xl hover:translate-y-[-4px] transition-all duration-300 group ${isVerified ? 'border-emerald-100 bg-emerald-50/10' : 'border-slate-100'}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className={`p-4 rounded-3xl transition-colors shadow-sm ${isVerified ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'}`}>
                          <Truck size={22} />
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1.5">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                              <Navigation size={10} />
                              <span className="text-[9px] font-black uppercase tracking-wider">{plan.routeDistance}</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg">
                              <Zap size={10} fill="currentColor" />
                              <span className="text-[9px] font-black uppercase tracking-wider">{plan.quantityMoved} PORTIONS</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-slate-900">
                            <span className="text-sm font-black uppercase tracking-tight truncate max-w-[140px]">{src?.name}</span>
                            <ArrowRight size={14} className="text-slate-300 flex-shrink-0" />
                            <span className="text-sm font-black uppercase tracking-tight truncate max-w-[140px]">{dst?.name}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Funding Plan</span>
                        <div className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-xl border flex items-center gap-2 shadow-sm ${plan.costPayer === 'Split' ? 'bg-orange-50 border-orange-100 text-orange-600' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                          <Wallet size={12} />
                          {plan.costPayer === 'Split' ? `SPLIT ${plan.senderCostShare}%` : plan.costPayer}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50/80 p-5 rounded-[28px] border border-slate-100 relative group-hover:bg-white transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Sparkles size={12} className="text-blue-500" />
                          <p className="text-[9px] font-black text-slate-900 uppercase tracking-widest">AI Logistics Assessment</p>
                        </div>
                        <span className="text-[8px] font-bold text-slate-400 bg-slate-200/50 px-2 py-0.5 rounded-full">Gemini 3 Pro</span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-600 leading-relaxed italic border-l-3 border-blue-500/30 pl-4 py-1">
                        "{plan.aiReasoning}"
                      </p>
                    </div>

                    <div className="flex gap-4 mt-auto">
                      <button
                        onClick={() => openInspection(plan)}
                        className={`flex-1 py-4 rounded-[22px] border-2 font-black uppercase text-[10px] tracking-wider transition-all flex items-center justify-center gap-2 ${isVerified ? 'border-emerald-500 text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'border-slate-100 text-slate-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50'}`}
                      >
                        {isVerified ? <ShieldCheck size={14} /> : <ScanLine size={14} />}
                        {isVerified ? 'SAFETY VERIFIED' : 'SAFETY & FUNDING'}
                      </button>
                      {!isVerified && (
                        <button
                          onClick={() => setPlans(prev => prev.filter(p => p.id !== plan.id))}
                          className="px-4 py-4 rounded-[22px] border-2 border-red-50 text-red-400 hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-center"
                          title="Reject Route"
                        >
                          <X size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => completeHandshake(plan)}
                        disabled={!isVerified}
                        className={`flex-1 py-4 rounded-[22px] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg ${isVerified ? 'bg-slate-900 text-white hover:bg-black hover:scale-[1.02] shadow-slate-900/20 active:scale-95' : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'}`}
                      >
                        <HeartHandshake size={16} /> Final Handshake
                      </button>
                    </div>
                  </div>
                );
              }) : (
                <div className="flex-1 flex flex-col items-center justify-center border-3 border-dashed border-slate-100 rounded-[50px] text-slate-300 gap-5 mx-2">
                  <div className="p-6 bg-slate-50 rounded-full animate-bounce duration-[3000ms]"><Truck size={40} className="opacity-20" /></div>
                  <div className="text-center">
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Waiting for Dispatch Command</p>
                    <p className="text-[10px] font-bold text-slate-300 uppercase mt-2">Tap "Execute AI Dispatch" to solve the local supply grid</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[48px] shadow-2xl p-12 relative overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-300">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600"></div>
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 transition-colors p-2 bg-slate-50 rounded-full hover:bg-slate-100"><X size={24} /></button>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8">
              <div className="flex items-center gap-6">
                <div className={`p-6 rounded-[32px] shadow-xl ${formType === 'surplus' ? 'bg-blue-600 text-white shadow-blue-500/30' : 'bg-emerald-600 text-white shadow-emerald-500/30'}`}>
                  {formType === 'surplus' ? <Building2 size={36} /> : <ShoppingCart size={36} />}
                </div>
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tight leading-none text-slate-900">Add {formType}</h2>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-2 flex items-center gap-2"><MapPin size={12} /> Network Node Registration</p>
                </div>
              </div>

              {formType === 'surplus' && (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[40px] p-8 text-center relative group">
                  {previewImage ? (
                    <div className="relative aspect-video rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in duration-300">
                      <img src={previewImage} className="w-full h-full object-cover" />
                      <button onClick={() => { setPreviewImage(null); setAiMetadata(null); }} className="absolute top-6 right-6 p-3 bg-white/90 backdrop-blur-md rounded-full text-slate-900 shadow-xl hover:bg-white active:scale-90 transition-all"><X size={18} /></button>
                      {isAnalyzing && <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-3"><Loader2 className="animate-spin" size={32} /> <span className="text-[11px] font-black uppercase tracking-widest">AI Inventory Analysis</span></div>}
                    </div>
                  ) : (
                    <div onClick={() => fileInputRef.current?.click()} className="py-14 flex flex-col items-center cursor-pointer hover:bg-white hover:border-blue-200 rounded-[32px] transition-all group">
                      <div className="p-6 bg-white text-blue-600 rounded-full mb-4 shadow-sm group-hover:scale-110 transition-transform"><Camera size={32} /></div>
                      <p className="text-[11px] font-black uppercase text-slate-500 tracking-widest">Scan Excess Food for Manifest</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-2">Gemini AI will estimate quantities & shelf life</p>
                      <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                    </div>
                  )}
                  {aiMetadata && (
                    <div className="mt-6 space-y-4 animate-in slide-in-from-bottom duration-300">
                      <div className="bg-white p-6 rounded-3xl border border-slate-100 text-left shadow-sm">
                        <p className="text-[9px] font-black uppercase text-slate-400 mb-2 flex items-center gap-1"><Sparkles size={10} className="text-blue-500" /> Food Item / Dish (AI Identification)</p>
                        <input
                          name="dishName"
                          defaultValue={aiMetadata.dishName}
                          placeholder="e.g. Vegetarian Chana Masala"
                          className="w-full text-lg font-black text-slate-900 uppercase bg-transparent outline-none border-b-2 border-slate-50 focus:border-blue-500 py-1 transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-3xl border border-slate-100 text-left shadow-sm">
                          <p className="text-[9px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1"><Clock size={10} /> Shelf Life (AI)</p>
                          <input
                            name="shelfLife"
                            defaultValue={aiMetadata.shelfLife}
                            className="w-full text-xs font-black text-slate-900 uppercase bg-transparent outline-none focus:text-blue-600"
                          />
                        </div>
                        <div className="bg-white p-4 rounded-3xl border border-slate-100 text-left shadow-sm">
                          <p className="text-[9px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1"><Zap size={10} className="text-emerald-500" /> CO2 Impact (AI)</p>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-black text-emerald-600">-</span>
                            <input
                              name="co2Impact"
                              type="number"
                              defaultValue={aiMetadata.co2Impact}
                              className="w-full text-xs font-black text-emerald-600 bg-transparent outline-none focus:text-blue-600"
                            />
                            <span className="text-[10px] font-bold text-slate-400 self-end mb-0.5">KG</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-600/5 p-5 rounded-[28px] border border-blue-100/50 flex items-start gap-4">
                        <div className="p-2 bg-blue-600/10 rounded-xl mt-0.5"><Sparkles size={16} className="text-blue-600 flex-shrink-0" /></div>
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-700">Vision-Language Protocol (Gemini 3 Flash)</p>
                          <p className="text-[10px] font-medium text-slate-600 leading-relaxed text-left">
                            The identification uses a **Contrastive Vision-Language Pre-training (CVLP)** architecture. It maps pixel data to semantic embeddings to identify precise dishes, calculates volume based on spatial reasoning for portion estimation, and correlates ingredients against carbon emission databases for real-time impact scoring.
                          </p>
                          <div className="flex gap-2">
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md text-[8px] font-black uppercase">Multimodal Reasoning</span>
                            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md text-[8px] font-black uppercase">Carbon Traceability</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const nameInput = (form.elements.namedItem('name') as HTMLInputElement).value;
                const foodInput = (form.elements.namedItem('foodType') as HTMLSelectElement).value;
                const qtyInput = Number((form.elements.namedItem('quantity') as HTMLInputElement).value);

                const newNode: LocationData = {
                  id: (formType === 'surplus' ? 'R' : 'S') + Date.now(),
                  name: nameInput || 'New Partner Hub',
                  lat: pendingLoc!.lat,
                  lng: pendingLoc!.lng,
                  type: formType,
                  foodType: foodInput as FoodType,
                  quantity: qtyInput,
                  urgency: 'medium',
                  managedBy: 'Gaia Hub Dispatch',
                  shelfLife: (form.elements.namedItem('shelfLife') as HTMLInputElement)?.value,
                  co2Impact: Number((form.elements.namedItem('co2Impact') as HTMLInputElement)?.value),
                  dishName: (form.elements.namedItem('dishName') as HTMLInputElement)?.value
                };
                setLocations(prev => [...prev, newNode]);
                setIsModalOpen(false);
                setPendingLoc(null);
              }} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-5 block">Hub Name / Facility</label>
                  <input name="name" required placeholder="e.g. Buckhead Community Table" className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl font-black text-slate-900 outline-none focus:border-blue-500/40 focus:bg-white transition-all shadow-inner" />
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-5 block">Food Category</label>
                    <select name="foodType" className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl font-black text-slate-900 outline-none appearance-none focus:border-blue-500/40 focus:bg-white transition-all shadow-inner">
                      {Object.values(FoodType).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-5 block">Servings Count</label>
                    <input name="quantity" type="number" defaultValue={10} className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl font-black text-slate-900 outline-none focus:border-blue-500/40 focus:bg-white transition-all shadow-inner" />
                  </div>
                </div>
                <button type="submit" disabled={!pendingLoc} className={`w-full py-6 rounded-3xl font-black uppercase text-sm tracking-[0.2em] text-white shadow-2xl transition-all mt-6 active:scale-95 ${!pendingLoc ? 'bg-slate-300' : (formType === 'surplus' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30')}`}>
                  Publish Hub Node
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeInspectionPlanId && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-[56px] p-14 relative overflow-hidden flex flex-col max-h-[92vh] shadow-2xl animate-in zoom-in duration-300">
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-6 space-y-12">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-blue-600 text-white rounded-3xl shadow-lg shadow-blue-500/30"><ShieldAlert size={28} /></div>
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tight leading-none text-slate-900">Safety & Strategic Funding</h2>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-2">Compliance and cost distribution for this route</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-14">
                <div className="space-y-8">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <span className="bg-slate-900 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full">1</span>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-900">Safety Verification</h3>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-4 flex items-center gap-2"><Thermometer size={12} className="text-blue-500" /> Temperature Snapshot (°F)</label>
                      <input type="number" step="0.1" value={tempInput} onChange={e => setTempInput(e.target.value)} placeholder="e.g. 145.5" className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl font-black text-slate-900 outline-none focus:border-blue-500/30 shadow-inner" />
                    </div>
                    <button onClick={() => setSealInput(!sealInput)} className={`w-full py-6 rounded-3xl border-2 font-black uppercase text-[11px] tracking-wider transition-all flex items-center justify-center gap-3 ${sealInput ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/30' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50 shadow-sm'}`}>
                      {sealInput ? <ShieldCheck size={20} /> : <ScanLine size={20} />}
                      {sealInput ? 'Physical Seal Verified' : 'Verify Security Seal'}
                    </button>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-4 flex items-center gap-2"><BadgeCheck size={12} className="text-blue-500" /> Inspector ID / Hash</label>
                      <input value={certInput} onChange={e => setCertInput(e.target.value)} placeholder="e.g. 10293-847" className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl font-black text-slate-900 outline-none focus:border-blue-500/30 shadow-inner" />
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <span className="bg-slate-900 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full">2</span>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-900">Cost Distribution</h3>
                  </div>
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-3">
                      {[
                        { id: 'Sender', label: 'Sender Full Coverage', icon: <Building2 size={16} /> },
                        { id: 'Receiver', label: 'Receiver Full Coverage', icon: <ShoppingCart size={16} /> },
                        { id: 'Split', label: 'Custom Cost Sharing', icon: <Percent size={16} /> }
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setCostPayerInput(opt.id as any)}
                          className={`flex items-center gap-4 p-5 rounded-3xl border-2 font-black uppercase text-[10px] tracking-wider transition-all shadow-sm ${costPayerInput === opt.id ? 'bg-slate-900 border-slate-900 text-white shadow-xl translate-x-2' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                        >
                          <div className={`p-2 rounded-xl ${costPayerInput === opt.id ? 'bg-white/10 text-white' : 'bg-slate-50 text-slate-400'}`}>{opt.icon}</div>
                          {opt.label}
                          {costPayerInput === opt.id && <div className="ml-auto bg-white/20 p-1 rounded-full"><Check size={12} /></div>}
                        </button>
                      ))}
                    </div>

                    {costPayerInput === 'Split' && (
                      <div className="bg-blue-50/50 p-8 rounded-[36px] border border-blue-100 space-y-5 animate-in slide-in-from-top duration-300">
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase text-blue-400 tracking-widest">Sender Pays</span>
                            <span className="text-xl font-black text-blue-700">{senderShareInput}%</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Receiver Pays</span>
                            <span className="text-xl font-black text-slate-900">{100 - senderShareInput}%</span>
                          </div>
                        </div>
                        <div className="relative h-4 flex items-center">
                          <div className="absolute w-full h-2 bg-slate-200 rounded-full"></div>
                          <div className="absolute h-2 bg-blue-500 rounded-full" style={{ width: `${senderShareInput}%` }}></div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={senderShareInput}
                            onChange={(e) => setSenderShareInput(Number(e.target.value))}
                            className="absolute w-full h-4 opacity-0 cursor-pointer z-10"
                          />
                          <div className="absolute w-6 h-6 bg-white border-4 border-blue-600 rounded-full shadow-lg transition-all pointer-events-none" style={{ left: `calc(${senderShareInput}% - 12px)` }}></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-6 pt-10 border-t border-slate-100 mt-4">
                <button onClick={() => saveInspection(false)} className="flex-1 py-7 bg-blue-600 text-white rounded-[28px] font-black uppercase text-sm tracking-[0.2em] shadow-2xl shadow-blue-500/40 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3">
                  <Check size={22} /> Authorize Route
                </button>
                <button onClick={() => saveInspection(true)} className="flex-1 py-7 border-3 border-red-50 text-red-600 rounded-[28px] font-black uppercase text-sm tracking-[0.2em] hover:bg-red-50 transition-all">
                  Report Deviation
                </button>
              </div>
            </div>
            <button onClick={() => setActiveInspectionPlanId(null)} className="absolute top-10 right-10 text-slate-300 hover:text-slate-900 transition-colors p-3 bg-slate-50 rounded-full"><X size={24} /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
