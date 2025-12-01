import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, PieChart, List, Calendar, Wallet, Briefcase, TrendingUp, Percent, History, Trash2, ChevronRight, UploadCloud, X, LogIn, LogOut, User, RefreshCcw, DollarSign, Menu, LayoutDashboard, PiggyBank, Plus, Target, Coins, Landmark, Pencil, Save as SaveIcon, Download } from 'lucide-react';

// --- Firebase 模組 ---
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc } from "firebase/firestore";

// --- ⚠️ Firebase 設定 ---
const firebaseConfig = {
  apiKey: "AIzaSyC-4eqOa_YC-SdZZrjfEtKaUNtof5cfE9U",
  authDomain: "rental-roi-app.firebaseapp.com",
  projectId: "rental-roi-app",
  storageBucket: "rental-roi-app.firebasestorage.app",
  messagingSenderId: "890677733982",
  appId: "1:890677733982:web:9675eda7f63a579a5da2cf",
  measurementId: "G-0DNQVXTCLZ"
};

// --- 全域變數 ---
let db = null;
let auth = null;

try {
  if (firebaseConfig.apiKey) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("Firebase & Auth 初始化成功");
  } else {
    console.warn("⚠️ Firebase Config 未填寫");
  }
} catch (e) {
  console.error("Firebase 初始化失敗:", e);
}

// --- 財務算法 Helper ---
const calculateIRR = (values, guess = 0.1) => {
  const maxIter = 1000;
  const precision = 0.00001;
  let rate = guess;
  for (let i = 0; i < maxIter; i++) {
    let npv = 0;
    let d_npv = 0;
    for (let t = 0; t < values.length; t++) {
      npv += values[t] / Math.pow(1 + rate, t);
      d_npv -= (t * values[t]) / Math.pow(1 + rate, t + 1);
    }
    const newRate = rate - npv / d_npv;
    if (Math.abs(newRate - rate) < precision) return newRate;
    rate = newRate;
  }
  return null;
};

const calculateNPV = (rate, initialCost, cashFlows) => {
  let npv = -initialCost;
  for (let t = 0; t < cashFlows.length; t++) {
    npv += cashFlows[t] / Math.pow(1 + rate, t + 1);
  }
  return npv;
};

// --- UI 元件 ---
const Notification = ({ message, type, onClose }) => {
  if (!message) return null;
  const bgColor = type === 'error' ? 'bg-red-500' : 'bg-green-600';
  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 ${bgColor} text-white px-6 py-3 rounded-full shadow-xl z-50 flex items-center gap-3 animate-bounce-in transition-all`}>
      <span className="text-sm font-bold">{message}</span>
      <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1"><X size={14} /></button>
    </div>
  );
};

const InputGroup = ({ label, children, className = "" }) => (
  <div className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-3 ${className}`}>
    <div className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">{label}</div>
    <div className="space-y-3">{children}</div>
  </div>
);

const InputRow = ({ label, value, onChange, type = "number", suffix = "" }) => (
  <div className="flex justify-between items-center border-b border-gray-50 last:border-0 pb-2 last:pb-0 hover:bg-gray-50 transition-colors rounded px-1 -mx-1">
    <label className="text-sm font-medium text-gray-700">{label}</label>
    <div className="flex items-center">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-right font-semibold text-gray-900 outline-none bg-transparent w-32 placeholder-gray-300 focus:text-blue-600 transition-colors"
        placeholder="0"
      />
      {suffix && <span className="ml-2 text-sm text-gray-500 w-4">{suffix}</span>}
    </div>
  </div>
);

const ResultCard = ({ title, value, subValue, icon: Icon, colorClass = "bg-blue-600" }) => (
  <div className={`${colorClass} text-white p-5 rounded-2xl shadow-lg mb-4 flex flex-col justify-between h-full`}>
    <div>
      <div className="flex items-center gap-2 mb-2 opacity-90"><Icon size={18} /><span className="text-sm font-medium">{title}</span></div>
      <div className="text-4xl font-bold tracking-tight mb-1">{value}</div>
    </div>
    <div className="text-sm opacity-75 border-t border-white/20 pt-2 mt-2">{subValue}</div>
  </div>
);

const formatMoney = (num) => new Intl.NumberFormat('zh-TW').format(Math.round(num));

// --- 主程式 ---
export default function App() {
  const [activeTab, setActiveTab] = useState('input');
  const [historyRecords, setHistoryRecords] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState({ message: '', type: 'success' });
  const [user, setUser] = useState(null);

  // ==========================================
  // 1. 資金管理系統 (Fund System) - 獨立運作
  // ==========================================
  const [fundData, setFundData] = useState(() => {
    const saved = localStorage.getItem('fundData');
    return saved ? JSON.parse(saved) : {
      initialAssets: 0,
      piggyBanks: [
        { id: 1, name: '10年還款基金', target: 5000000, percent: 10 },
        { id: 2, name: '設備汰換準備', target: 1000000, percent: 5 }
      ],
      ledger: {} 
    };
  });

  useEffect(() => {
    localStorage.setItem('fundData', JSON.stringify(fundData));
  }, [fundData]);

  // ==========================================
  // 2. 專案試算系統 (Project System) - 模擬用
  // ==========================================
  const [projectParams, setProjectParams] = useState({
    projectName: '我的財務專案',
    estimatedUpfrontCost: 2000000,
    actualUpfrontCost: 2200000,
    expenseManagement: 2000,
    expenseMaintenance: 1000,
    expenseTax: 0,
    expenseInsurance: 0,
    expenseOther: 2000,
    discountRate: 3,
    fundInjectionRatio: 80,
    manpowerInjectionRatio: 20,
    fundProfitRatio: 30,
    manpowerProfitRatio: 70,
    contractMonths: 60,
    phase1Months: 24,
    rentPhase1: 30000,
    rentPhase2: 35000,
    monthlyIncome: 80000,
    startDate: '2025-12',
  });

  const showNotify = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification({ message: '', type: 'success' }), 3000);
  };

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
  }, []);

  const handleLogin = async () => {
    if (!auth) { showNotify("Auth 未初始化", "error"); return; }
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); showNotify("登入成功！"); }
    catch (error) { showNotify("登入失敗", "error"); }
  };

  const handleLogout = async () => {
    try { await signOut(auth); showNotify("已登出"); }
    catch (error) { showNotify("登出失敗", "error"); }
  };

  // Firebase 專案紀錄監聽
  useEffect(() => {
    if (!db) return;
    try {
      const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setHistoryRecords(records);
      }, (error) => console.error("Firebase 讀取錯誤:", error));
      return () => unsubscribe();
    } catch (err) { console.error("Firebase Query 錯誤:", err); }
  }, []);

  // --- 資金管理操作 ---
  const updateFundData = (key, value) => {
    setFundData(prev => ({ ...prev, [key]: value }));
  };

  const addPiggyBank = () => {
    updateFundData('piggyBanks', [...fundData.piggyBanks, { id: Date.now(), name: '新目標', target: 100000, percent: 5 }]);
  };
  const updatePiggyBank = (id, field, val) => {
    updateFundData('piggyBanks', fundData.piggyBanks.map(b => b.id === id ? { ...b, [field]: val } : b));
  };
  const removePiggyBank = (id) => {
    updateFundData('piggyBanks', fundData.piggyBanks.filter(b => b.id !== id));
  };

  const handleLedgerChange = (monthKey, field, val) => {
    const numVal = val === '' ? null : parseFloat(val);
    setFundData(prev => {
        const currentLedger = { ...prev.ledger };
        const monthData = currentLedger[monthKey] || {};
        const newData = { ...monthData, [field]: numVal };
        
        if (newData.income == null && newData.expense == null) {
            delete currentLedger[monthKey];
        } else {
            currentLedger[monthKey] = newData;
        }
        return { ...prev, ledger: currentLedger };
    });
  };

  const handleBackupFunds = async () => {
    if (!db || !user) { showNotify("請先登入", "error"); return; }
    setIsSaving(true);
    try {
      await setDoc(doc(db, "user_funds", user.uid), {
        ...fundData,
        lastUpdated: serverTimestamp()
      });
      showNotify("資金帳本已備份！");
    } catch (error) { console.error(error); showNotify("備份失敗", "error"); }
    setIsSaving(false);
  };

  const handleRestoreFunds = async () => {
    if (!db || !user) { showNotify("請先登入", "error"); return; }
    if (!window.confirm("確定要還原嗎？這將覆蓋本機紀錄。")) return;
    try {
      const docSnap = await getDoc(doc(db, "user_funds", user.uid));
      if (docSnap.exists()) {
        const { lastUpdated, ...rest } = docSnap.data();
        setFundData(rest);
        showNotify("還原成功！");
      } else { showNotify("無備份紀錄", "error"); }
    } catch (error) { showNotify("還原失敗", "error"); }
  };

  // --- 專案試算操作 ---
  const handleProjectParamChange = (key, val) => {
    setProjectParams(prev => ({ ...prev, [key]: val }));
  };
  const handleRatioChange = (keyA, keyB, value) => {
    const val = parseFloat(value);
    if (isNaN(val)) return;
    setProjectParams(prev => ({ ...prev, [keyA]: val, [keyB]: 100 - val }));
  };

  const handleSaveProject = async () => {
    if (!db || !user) { showNotify("請先登入", "error"); return; }
    setIsSaving(true);
    try {
      await addDoc(collection(db, "projects"), {
        ...projectParams,
        userId: user.uid,
        authorName: user.displayName,
        createdAt: serverTimestamp(),
        summary: { roi: simulationResults.investorAnnualizedROI, netProfit: simulationResults.projectRealNetProfit }
      });
      showNotify("專案參數已儲存");
      setActiveTab('history');
    } catch (error) { showNotify("儲存失敗", "error"); }
    setIsSaving(false);
  };

  const handleDeleteRecord = async (id, e) => {
    e.stopPropagation();
    if (!db) return;
    if (!window.confirm("確定刪除此紀錄？")) return;
    try { await deleteDoc(doc(db, "projects", id)); showNotify("紀錄已刪除"); }
    catch (error) { showNotify("刪除失敗", "error"); }
  };

  const handleLoadRecord = (record) => {
    const { id, createdAt, summary, userId, authorName, ...loadedParams } = record;
    if (loadedParams.monthlyMisc && loadedParams.expenseOther === undefined) {
      loadedParams.expenseOther = loadedParams.monthlyMisc;
      loadedParams.expenseManagement = 0; loadedParams.expenseMaintenance = 0;
      loadedParams.expenseTax = 0; loadedParams.expenseInsurance = 0;
    }
    delete loadedParams.piggyBanks;
    delete loadedParams.monthlyOverrides;
    delete loadedParams.initialCompanyAssets;

    setProjectParams(prev => ({ ...prev, ...loadedParams }));
    showNotify("已載入專案參數 (資金帳本未變動)");
    setActiveTab('report');
  };

  // --- 計算 1: 資金管理 (Funds Calculation) ---
  const fundsCalculations = useMemo(() => {
    const initial = parseInt(fundData.initialAssets) || 0;
    let currentTotalAssets = initial;
    let bankBalances = fundData.piggyBanks.map(b => ({ ...b, currentAmount: 0 }));
    
    const ledgerList = [];
    const startYear = parseInt(projectParams.startDate.split('-')[0]) || 2025;
    const startMonth = parseInt(projectParams.startDate.split('-')[1]) || 1;

    for (let i = 0; i < 60; i++) {
        const date = new Date(startYear, startMonth - 1 + i, 1);
        const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
        const key = i.toString();

        const entry = fundData.ledger[key] || {};
        const income = entry.income !== undefined && entry.income !== null ? entry.income : 0;
        const expense = entry.expense !== undefined && entry.expense !== null ? entry.expense : 0;
        const net = income - expense;

        let monthlyAllocated = 0;
        if (net > 0) {
            bankBalances = bankBalances.map(bank => {
                const allocation = Math.round(net * (bank.percent / 100));
                monthlyAllocated += allocation;
                return { ...bank, currentAmount: bank.currentAmount + allocation };
            });
        }

        currentTotalAssets += net;

        ledgerList.push({
            key,
            date: dateStr,
            income: entry.income,
            expense: entry.expense,
            net,
            currentTotalAssets,
            allocated: monthlyAllocated
        });
    }

    return { currentTotalAssets, bankBalances, ledgerList };
  }, [fundData, projectParams.startDate]);

  // --- 計算 2: 專案試算 (Simulation Calculation) ---
  const simulationResults = useMemo(() => {
    const { 
        contractMonths, phase1Months, actualUpfrontCost,
        expenseManagement, expenseMaintenance, expenseTax, expenseInsurance, expenseOther,
        rentPhase1, rentPhase2, monthlyIncome, discountRate,
        fundInjectionRatio, manpowerInjectionRatio, fundProfitRatio, manpowerProfitRatio
    } = projectParams;

    const totalMonths = parseInt(contractMonths) || 0;
    const actualCostVal = parseInt(actualUpfrontCost) || 0;
    const baseExpense = (parseInt(expenseManagement)||0) + (parseInt(expenseMaintenance)||0) + (parseInt(expenseTax)||0) + (parseInt(expenseInsurance)||0) + (parseInt(expenseOther)||0);
    const rent1 = parseInt(rentPhase1) || 0;
    const rent2 = parseInt(rentPhase2) || 0;
    const baseIncome = parseInt(monthlyIncome) || 0;
    
    let cumulativeCashFlow = 0;
    const monthlyData = [];
    const netCashFlowsForIRR = [-actualCostVal];
    let breakEvenDate = null;
    
    for (let i = 0; i < totalMonths; i++) {
      const date = new Date(projectParams.startDate + '-01');
      date.setMonth(date.getMonth() + i);
      const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;

      const currentRent = i < parseInt(phase1Months) ? rent1 : rent2;
      const expense = currentRent + baseExpense;
      let income = baseIncome;
      if (i >= 12) income = Math.round(baseIncome * 0.95);
      
      const net = income - expense;
      cumulativeCashFlow += net;
      netCashFlowsForIRR.push(net);

      if (!breakEvenDate && cumulativeCashFlow >= actualCostVal) breakEvenDate = dateStr;

      monthlyData.push({ month: i+1, date: dateStr, income, expense, netProfit: net, cumulative: cumulativeCashFlow });
    }

    const discountRateAnnual = (parseFloat(discountRate) || 0) / 100;
    const npv = calculateNPV(discountRateAnnual/12, actualCostVal, netCashFlowsForIRR.slice(1));
    const monthlyIRR = calculateIRR(netCashFlowsForIRR);
    const annualIRR = monthlyIRR ? (Math.pow(1 + monthlyIRR, 12) - 1) * 100 : 0;

    const projectRealNetProfit = cumulativeCashFlow - actualCostVal;
    
    const investorProfitShare = (projectRealNetProfit > 0 ? projectRealNetProfit : 0) * ((parseFloat(fundProfitRatio)||0)/100);
    const operatorProfitShare = (projectRealNetProfit > 0 ? projectRealNetProfit : 0) * ((parseFloat(manpowerProfitRatio)||0)/100);
    const investorPrincipal = actualCostVal * ((parseFloat(fundInjectionRatio)||0)/100);
    const operatorPrincipal = actualCostVal * ((parseFloat(manpowerInjectionRatio)||0)/100);
    const years = totalMonths / 12;
    const investorROI = (investorPrincipal > 0 && years > 0) ? ((investorProfitShare / investorPrincipal) / years * 100).toFixed(1) : "0.0";
    const operatorROI = (operatorPrincipal > 0 && years > 0) ? ((operatorProfitShare / operatorPrincipal) / years * 100).toFixed(1) : "0.0";

    const totalRevenue = monthlyData.reduce((acc, c) => acc + c.income, 0);
    const totalExpenses = monthlyData.reduce((acc, c) => acc + c.expense, 0);
    const costRatio = totalRevenue > 0 ? ((totalExpenses + actualCostVal) / totalRevenue * 100).toFixed(1) : 0;
    const monthlyAmortization = totalMonths > 0 ? Math.round(actualCostVal / totalMonths) : 0;
    const monthlyTotalCostWithAmort = totalMonths > 0 ? Math.round((totalExpenses / totalMonths) + monthlyAmortization) : 0;
    const avgMonthlyNetIncome = totalMonths > 0 ? Math.round((totalRevenue - totalExpenses - actualCostVal) / totalMonths) : 0;

    return {
      monthlyData, breakEvenDate, breakEvenMonths: breakEvenDate ? monthlyData.findIndex(d => d.date === breakEvenDate) + 1 : '-',
      projectRealNetProfit, npv: Math.round(npv), irr: annualIRR.toFixed(2),
      investorPrincipal, investorProfitShare, investorAnnualizedROI: investorROI,
      operatorPrincipal, operatorProfitShare, operatorAnnualizedROI: operatorROI,
      monthlyAmortization, costRatio, monthlyTotalCostWithAmort, avgMonthlyNetIncome
    };
  }, [projectParams]);

  // --- Render ---
  const NavItem = ({ id, label, icon: Icon, active }) => (
    <button onClick={() => setActiveTab(id)} className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all ${active ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>
      <Icon size={20} strokeWidth={2.5} />
      <span className="font-medium text-sm md:text-base">{label}</span>
    </button>
  );

  return (
    <div className="bg-gray-100 min-h-screen font-sans flex justify-center text-gray-900 md:p-6 md:items-center">
      <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ message: '', type: 'success' })} />

      <div className="w-full md:max-w-7xl bg-gray-50 h-[100dvh] md:h-[90vh] md:min-h-[800px] flex flex-col md:flex-row relative shadow-2xl md:rounded-3xl overflow-hidden border border-gray-200">
        
        {/* Sidebar */}
        <div className="hidden md:flex flex-col w-72 bg-white border-r border-gray-100 p-6 shrink-0">
          <div className="mb-10 px-2"><h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2"><Calculator className="text-blue-600" /> 金流管理</h1><p className="text-xs text-gray-400 mt-1 font-medium ml-8">Cash Flow Manager</p></div>
          <div className="space-y-2 flex-1">
            <NavItem id="input" label="專案參數" icon={LayoutDashboard} active={activeTab === 'input'} />
            <NavItem id="report" label="報表分析" icon={PieChart} active={activeTab === 'report'} />
            <NavItem id="detail" label="試算明細" icon={List} active={activeTab === 'detail'} />
            <NavItem id="history" label="專案存檔" icon={History} active={activeTab === 'history'} />
            <div className="my-4 border-t border-gray-100"></div>
            <NavItem id="funds" label="資金管理" icon={PiggyBank} active={activeTab === 'funds'} />
          </div>
          <div className="mt-auto pt-6 border-t border-gray-100">
            {user ? (
                <div className="bg-gray-50 p-4 rounded-xl flex items-center justify-between"><div className="flex items-center gap-3 overflow-hidden"><div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">{user.displayName?.[0] || 'U'}</div><div className="truncate text-sm font-medium text-gray-700">{user.displayName}</div></div><button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-colors p-1"><LogOut size={16} /></button></div>
            ) : (<button onClick={handleLogin} className="w-full bg-black text-white py-3 rounded-xl font-bold shadow-lg hover:bg-gray-800 transition-all flex items-center justify-center gap-2"><LogIn size={18} /> 登入 / 註冊</button>)}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div className="md:hidden bg-white px-5 pt-12 pb-4 shadow-sm z-10 flex justify-between items-center shrink-0">
            <div><h1 className="text-2xl font-bold text-gray-900">金流管理</h1><p className="text-xs text-gray-500 mt-1">Cash Flow Manager</p></div>
            <div className="flex items-center gap-2">
                {user ? <button onClick={handleLogout} className="bg-gray-100 text-gray-600 p-2 rounded-lg"><LogOut size={16} /></button> : <button onClick={handleLogin} className="bg-black text-white px-3 py-2 rounded-lg text-xs font-bold shadow"><LogIn size={14} /> 登入</button>}
            </div>
          </div>

          <div className="hidden md:flex justify-between items-center px-8 py-6 bg-white/50 backdrop-blur-sm sticky top-0 z-20 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-800">
              {activeTab === 'input' && '專案參數設定'}
              {activeTab === 'funds' && '公司資金管理'}
              {activeTab === 'report' && '專案試算分析'}
              {activeTab === 'detail' && '專案試算明細'}
              {activeTab === 'history' && '專案存檔紀錄'}
            </h2>
            {activeTab === 'report' && user && <button onClick={handleSaveProject} disabled={isSaving} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-md hover:bg-blue-700 flex items-center gap-2 transition-all active:scale-95">{isSaving ? "儲存中..." : <><SaveIcon size={18} /> 儲存參數</>}</button>}
            {activeTab === 'funds' && user && (
                <div className="flex gap-2">
                    <button onClick={handleRestoreFunds} disabled={isSaving} className="bg-white border border-gray-300 text-gray-600 px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-50 flex items-center gap-2 transition-all"><Download size={18} /> 還原備份</button>
                    <button onClick={handleBackupFunds} disabled={isSaving} className="bg-orange-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-md hover:bg-orange-700 flex items-center gap-2 transition-all active:scale-95">{isSaving ? "備份中..." : <><UploadCloud size={18} /> 備份帳本</>}</button>
                </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
            
            {/* TAB 1: 專案參數 */}
            {activeTab === 'input' && (
              <div className="animate-fadeIn max-w-5xl mx-auto">
                 <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
                  <label className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider block">專案名稱</label>
                  <input type="text" value={projectParams.projectName} onChange={(e) => handleProjectParamChange('projectName', e.target.value)} className="w-full text-lg md:text-2xl font-bold text-gray-800 border-b border-gray-200 pb-1 outline-none focus:border-blue-500 transition-colors bg-transparent" placeholder="請輸入專案名稱..." />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <InputGroup label="起始與成本">
                      <InputRow label="數值起始年月" type="month" value={projectParams.startDate} onChange={v => handleProjectParamChange('startDate', v)} />
                      <InputRow label="前期預估成本" value={projectParams.estimatedUpfrontCost} onChange={v => handleProjectParamChange('estimatedUpfrontCost', v)} />
                      <InputRow label="實際投入成本" value={projectParams.actualUpfrontCost} onChange={v => handleProjectParamChange('actualUpfrontCost', v)} />
                    </InputGroup>
                    <InputGroup label="每月營運費用細項">
                      <InputRow label="管理費" value={projectParams.expenseManagement} onChange={v => handleProjectParamChange('expenseManagement', v)} />
                      <InputRow label="修繕準備金" value={projectParams.expenseMaintenance} onChange={v => handleProjectParamChange('expenseMaintenance', v)} />
                      <InputRow label="稅務攤提" value={projectParams.expenseTax} onChange={v => handleProjectParamChange('expenseTax', v)} />
                      <InputRow label="保險費" value={projectParams.expenseInsurance} onChange={v => handleProjectParamChange('expenseInsurance', v)} />
                      <InputRow label="其他雜支" value={projectParams.expenseOther} onChange={v => handleProjectParamChange('expenseOther', v)} />
                      <div className="pt-2 mt-2 border-t border-dashed border-gray-200 flex justify-between items-center text-gray-500">
                        <span className="text-xs font-bold">合計月支出</span>
                        <span className="font-mono font-bold text-red-500">{formatMoney((parseInt(projectParams.expenseManagement)||0) + (parseInt(projectParams.expenseMaintenance)||0) + (parseInt(projectParams.expenseTax)||0) + (parseInt(projectParams.expenseInsurance)||0) + (parseInt(projectParams.expenseOther)||0))}</span>
                      </div>
                    </InputGroup>
                  </div>
                  <div className="space-y-4">
                    <InputGroup label="進階財測設定">
                      <InputRow label="折現率 (NPV用)" value={projectParams.discountRate} onChange={v => handleProjectParamChange('discountRate', v)} suffix="%" />
                    </InputGroup>
                    <div className="grid grid-cols-2 gap-4">
                      <InputGroup label="資本投入比例">
                        <InputRow label="資金方投入" value={projectParams.fundInjectionRatio} onChange={(v) => handleRatioChange('fundInjectionRatio', 'manpowerInjectionRatio', v)} suffix="%" />
                        <InputRow label="人力方投入" value={projectParams.manpowerInjectionRatio} onChange={(v) => handleRatioChange('manpowerInjectionRatio', 'fundInjectionRatio', v)} suffix="%" />
                      </InputGroup>
                      <InputGroup label="獲利分配比例">
                        <InputRow label="資金方分潤" value={projectParams.fundProfitRatio} onChange={(v) => handleRatioChange('fundProfitRatio', 'manpowerProfitRatio', v)} suffix="%" />
                        <InputRow label="人力方分潤" value={projectParams.manpowerProfitRatio} onChange={(v) => handleRatioChange('manpowerProfitRatio', 'fundProfitRatio', v)} suffix="%" />
                      </InputGroup>
                    </div>
                    <InputGroup label="專案週期與成本">
                      <InputRow label="總週期月數" value={projectParams.contractMonths} onChange={v => handleProjectParamChange('contractMonths', v)} suffix="月" />
                      <InputRow label="第一階段月數" value={projectParams.phase1Months} onChange={v => handleProjectParamChange('phase1Months', v)} suffix="月" />
                      <InputRow label="第一階段月成本" value={projectParams.rentPhase1} onChange={v => handleProjectParamChange('rentPhase1', v)} />
                      <InputRow label="第二階段月成本" value={projectParams.rentPhase2} onChange={v => handleProjectParamChange('rentPhase2', v)} />
                    </InputGroup>
                    <InputGroup label="營收預估">
                      <InputRow label="每月預估營收" value={projectParams.monthlyIncome} onChange={v => handleProjectParamChange('monthlyIncome', v)} />
                      <div className="text-[10px] text-gray-400 text-right px-1 mt-1">*註：第一年後營收自動 * 0.95 計算</div>
                    </InputGroup>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: 資金管理 */}
            {activeTab === 'funds' && (
                <div className="animate-fadeIn max-w-6xl mx-auto space-y-6">
                    {/* 資產儀表板 */}
                    <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6 rounded-2xl shadow-xl">
                        <div className="flex items-center gap-2 mb-6 opacity-80"><Landmark size={20} /><span className="font-bold">公司資金帳本總覽</span></div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                            <div className="flex flex-col gap-2">
                                <span className="text-xs text-gray-400">目前公司起始資金</span>
                                <div className="flex items-center border-b border-gray-600 pb-1">
                                    <span className="text-gray-400 mr-2">$</span>
                                    <input type="number" value={fundData.initialAssets} onChange={(e) => updateFundData('initialAssets', e.target.value)} className="bg-transparent text-xl font-bold text-white outline-none w-full placeholder-gray-600" placeholder="0" />
                                </div>
                                <span className="text-[10px] text-gray-500">手動輸入，不隨專案變動</span>
                            </div>
                            <div className="flex flex-col justify-center border-l border-gray-700 pl-6">
                                <span className="text-xs text-gray-400 mb-1">目前帳面總現金</span>
                                <span className="text-3xl font-bold text-green-400">{formatMoney(fundsCalculations.currentTotalAssets)}</span>
                                <span className="text-[10px] text-gray-500 mt-1">= 起始資金 + 帳本累計損益</span>
                            </div>
                            <div className="col-span-2 space-y-4 border-l border-gray-700 pl-6">
                                <div className="text-xs font-bold text-orange-400 mb-2">專案存錢筒 (依實際帳本盈餘提撥)</div>
                                {fundsCalculations.bankBalances.map(bank => {
                                    const progress = Math.min((bank.currentAmount / bank.target) * 100, 100);
                                    return (
                                        <div key={bank.id}>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="font-bold flex items-center gap-2 text-white">{bank.name}</span>
                                                <span className="text-orange-300 font-mono">{formatMoney(bank.currentAmount)} / {formatMoney(bank.target)}</span>
                                            </div>
                                            <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                                <div className="bg-orange-500 h-2.5 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                                            </div>
                                            <div className="text-[10px] text-gray-500 text-right mt-0.5">達成率 {progress.toFixed(1)}% (分配 {bank.percent}%)</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* 存錢筒設定 */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                      <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><PiggyBank size={20} className="text-orange-500"/> 存錢筒設定</h3>
                            <p className="text-xs text-gray-500 mt-1">當該月帳本有盈餘時，自動提撥比例進入存錢筒。</p>
                        </div>
                        <button onClick={addPiggyBank} className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-gray-800 flex items-center gap-2 transition-colors"><Plus size={16}/> 新增</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {fundData.piggyBanks.map((bank, idx) => (
                          <div key={bank.id} className="bg-orange-50/30 p-4 rounded-xl border border-orange-100 relative group hover:shadow-md transition-all">
                            <button onClick={() => removePiggyBank(bank.id)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X size={16} /></button>
                            <div className="mb-3">
                                <label className="text-xs font-bold text-gray-400 mb-1 block">名稱</label>
                                <input type="text" value={bank.name} onChange={(e) => updatePiggyBank(bank.id, 'name', e.target.value)} className="w-full bg-transparent border-b border-orange-200 text-base font-bold text-gray-800 outline-none focus:border-orange-500 pb-1" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div><label className="text-[10px] font-bold text-gray-400 mb-1 block">目標金額</label><div className="relative"><span className="absolute left-2 top-1.5 text-gray-400 text-xs">$</span><input type="number" value={bank.target} onChange={(e) => updatePiggyBank(bank.id, 'target', e.target.value)} className="w-full bg-white rounded-lg pl-5 pr-2 py-1.5 text-sm font-medium border border-gray-200 focus:border-orange-400 outline-none" /></div></div>
                              <div><label className="text-[10px] font-bold text-gray-400 mb-1 block">分配比例</label><div className="relative"><input type="number" value={bank.percent} onChange={(e) => updatePiggyBank(bank.id, 'percent', e.target.value)} className="w-full bg-white rounded-lg pl-2 pr-6 py-1.5 text-sm font-medium border border-gray-200 focus:border-orange-400 outline-none text-center" /><span className="absolute right-3 top-1.5 text-orange-500 text-xs font-bold">%</span></div></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 收支帳本 */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                            <div><h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Pencil size={18} className="text-blue-500"/> 每月收支帳本</h3><p className="text-xs text-gray-500 mt-1">手動紀錄每月實際收支，自動計算現金水位與存錢筒分配。</p></div>
                        </div>
                        <div className="grid grid-cols-5 bg-gray-100 p-3 text-xs font-bold text-gray-500 border-b border-gray-200"><div>年月</div><div className="text-right">實際收入</div><div className="text-right">實際支出</div><div className="text-right">當月淨利</div><div className="text-right">公司總現金</div></div>
                        <div className="max-h-[500px] overflow-y-auto">
                            {fundsCalculations.ledgerList.map((row) => (
                                <div key={row.key} className="grid grid-cols-5 p-2 text-sm border-b border-gray-50 items-center hover:bg-gray-50 transition-colors">
                                    <div className="text-gray-600 text-xs font-medium">{row.date}</div>
                                    <div className="text-right"><input type="number" value={row.income || ''} onChange={(e) => handleLedgerChange(row.key, 'income', e.target.value)} className={`w-full text-right bg-transparent outline-none border-b border-transparent focus:border-blue-400 transition-colors py-1 ${row.income != null ? 'text-blue-600 font-bold' : 'text-gray-400'}`} placeholder="-" /></div>
                                    <div className="text-right"><input type="number" value={row.expense || ''} onChange={(e) => handleLedgerChange(row.key, 'expense', e.target.value)} className={`w-full text-right bg-transparent outline-none border-b border-transparent focus:border-red-400 transition-colors py-1 ${row.expense != null ? 'text-red-500 font-bold' : 'text-gray-400'}`} placeholder="-" /></div>
                                    <div className={`text-right font-mono font-medium ${row.net > 0 ? 'text-green-600' : row.net < 0 ? 'text-red-500' : 'text-gray-400'}`}>{formatMoney(row.net)}</div>
                                    <div className="text-right font-mono font-bold text-gray-700">{formatMoney(row.currentTotalAssets)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: 試算報表 */}
            {activeTab === 'report' && (
              <div className="animate-fadeIn max-w-6xl mx-auto space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <ResultCard title="預估回本時間" value={typeof simulationResults.breakEvenMonths === 'number' ? `${simulationResults.breakEvenMonths} 個月` : simulationResults.breakEvenMonths} subValue={typeof simulationResults.breakEvenMonths === 'number' ? `預計於 ${simulationResults.breakEvenDate} 回本` : '尚未在週期內回本'} icon={Calendar} colorClass={typeof simulationResults.breakEvenMonths === 'number' ? "bg-indigo-600" : "bg-red-500"} />
                  <div className="bg-white p-5 rounded-2xl shadow-lg border border-gray-100 flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-2 text-gray-500"><TrendingUp size={18} /><span className="text-sm font-medium">專案總淨利 (模擬)</span></div>
                    <div className={`text-3xl font-bold tracking-tight ${simulationResults.projectRealNetProfit > 0 ? 'text-green-600' : 'text-red-500'}`}>{formatMoney(simulationResults.projectRealNetProfit)}</div>
                    <div className="text-xs text-gray-400 pt-2 border-t border-gray-100 mt-2">扣除本金後</div>
                  </div>
                  <div className="bg-purple-600 text-white p-5 rounded-2xl shadow-lg flex flex-col justify-between"><div className="flex items-center gap-2 mb-2 opacity-90"><Percent size={18} /><span className="text-sm font-medium">IRR 內部報酬率</span></div><div className="text-3xl font-bold tracking-tight">{simulationResults.irr}%</div><div className="text-xs opacity-75 pt-2 border-t border-white/20 mt-2">年化複利回報</div></div>
                  <div className="bg-blue-500 text-white p-5 rounded-2xl shadow-lg flex flex-col justify-between"><div className="flex items-center gap-2 mb-2 opacity-90"><DollarSign size={18} /><span className="text-sm font-medium">NPV 淨現值</span></div><div className="text-3xl font-bold tracking-tight">{formatMoney(simulationResults.npv)}</div><div className="text-xs opacity-75 pt-2 border-t border-white/20 mt-2">折現率 {projectParams.discountRate}%</div></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-6"><div className="flex items-center gap-2 text-gray-900 font-bold text-lg"><Wallet className="text-green-600" size={24} />資金方</div><div className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium">出資 {projectParams.fundInjectionRatio}% / 分潤 {projectParams.fundProfitRatio}%</div></div>
                    <div className="grid grid-cols-2 gap-6"><div className="bg-gray-50 p-4 rounded-xl"><div className="text-xs text-gray-500 mb-1">收回本金</div><div className="text-xl font-bold text-gray-800">{formatMoney(simulationResults.investorPrincipal)}</div></div><div className="bg-green-50 p-4 rounded-xl"><div className="text-xs text-green-700 mb-1">超額分潤</div><div className={`text-xl font-bold ${simulationResults.investorProfitShare > 0 ? 'text-green-700' : 'text-red-500'}`}>{simulationResults.investorProfitShare > 0 ? '+' : ''}{formatMoney(simulationResults.investorProfitShare)}</div></div></div>
                    <div className="mt-6 flex justify-end items-center border-t border-gray-100 pt-4"><div className="flex items-center gap-2"><Percent size={16} className="text-gray-400"/><span className="text-sm text-gray-500">年化報酬率 (ROI):</span><span className="text-2xl font-bold text-green-600">{simulationResults.investorAnnualizedROI}%</span></div></div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-6"><div className="flex items-center gap-2 text-gray-900 font-bold text-lg"><Briefcase className="text-orange-600" size={24} />人力方</div><div className="text-xs bg-orange-50 text-orange-700 px-3 py-1 rounded-full font-medium">出資 {projectParams.manpowerInjectionRatio}% / 分潤 {projectParams.manpowerProfitRatio}%</div></div>
                    <div className="grid grid-cols-2 gap-6"><div className="bg-gray-50 p-4 rounded-xl"><div className="text-xs text-gray-500 mb-1">收回本金</div><div className="text-xl font-bold text-gray-800">{formatMoney(simulationResults.operatorPrincipal)}</div></div><div className="bg-orange-50 p-4 rounded-xl"><div className="text-xs text-orange-700 mb-1">超額分潤</div><div className={`text-xl font-bold ${simulationResults.operatorProfitShare > 0 ? 'text-orange-700' : 'text-red-500'}`}>{simulationResults.operatorProfitShare > 0 ? '+' : ''}{formatMoney(simulationResults.operatorProfitShare)}</div></div></div>
                     <div className="mt-6 flex justify-end items-center border-t border-gray-100 pt-4"><div className="flex items-center gap-2"><Percent size={16} className="text-gray-400"/><span className="text-sm text-gray-500">年化報酬率 (ROI):</span><span className="text-2xl font-bold text-orange-600">{simulationResults.operatorAnnualizedROI}%</span></div></div>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2"><TrendingUp size={20} className="text-blue-500"/>成本分析指標</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div><div className="text-xs text-gray-400 mb-1">成本月攤提</div><div className="text-xl font-bold text-gray-800">{formatMoney(simulationResults.monthlyAmortization)}</div></div>
                      <div><div className="text-xs text-gray-400 mb-1">總成本比率</div><div className="text-xl font-bold text-gray-800">{simulationResults.costRatio}%</div></div>
                      <div><div className="text-xs text-gray-400 mb-1">平均每月總成本 (模擬)</div><div className="text-xl font-bold text-indigo-600">{formatMoney(simulationResults.monthlyTotalCostWithAmort)} / 月</div></div>
                      <div><div className="text-xs text-gray-400 mb-1">平均每月純收益 (模擬)</div><div className={`text-xl font-bold ${simulationResults.avgMonthlyNetIncome > 0 ? 'text-green-600' : 'text-red-500'}`}>{formatMoney(simulationResults.avgMonthlyNetIncome)} / 月</div></div>
                    </div>
                </div>
              </div>
            )}

            {/* TAB 3: 試算明細 */}
            {activeTab === 'detail' && (
              <div className="animate-fadeIn bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-5xl mx-auto">
                <div className="p-3 border-b border-gray-200 bg-gray-50"><div className="text-xs text-gray-500 font-bold">試算模擬明細 (此表為預估值)</div></div>
                <div className="grid grid-cols-4 bg-gray-100 p-3 text-xs font-bold text-gray-500 border-b border-gray-200"><div>年月</div><div className="text-right">預估收入</div><div className="text-right">預估支出</div><div className="text-right">預估淨利</div></div>
                <div className="max-h-[70vh] overflow-y-auto">
                  {simulationResults.monthlyData.map((row, idx) => (
                    <div key={idx} className={`grid grid-cols-4 p-2 text-sm border-b border-gray-50 items-center hover:bg-gray-50 transition-colors ${row.cumulative >= projectParams.actualUpfrontCost && simulationResults.monthlyData[idx-1]?.cumulative < projectParams.actualUpfrontCost ? 'bg-yellow-50 hover:bg-yellow-100' : ''}`}>
                      <div className="text-gray-600 text-xs">
                        {row.date}
                        {row.cumulative >= projectParams.actualUpfrontCost && simulationResults.monthlyData[idx-1]?.cumulative < projectParams.actualUpfrontCost && <span className="block text-[10px] text-red-500 font-bold">★回本</span>}
                      </div>
                      <div className="text-right font-mono">{formatMoney(row.income)}</div>
                      <div className="text-right font-mono text-red-400">{formatMoney(row.expense)}</div>
                      <div className={`text-right font-mono font-medium text-xs ${row.netProfit > 0 ? 'text-green-600' : 'text-gray-400'}`}>{formatMoney(row.netProfit)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: 歷史紀錄 (專案存檔) */}
            {activeTab === 'history' && (
              <div className="animate-fadeIn space-y-3 max-w-4xl mx-auto">
                {!user && (<div className="flex flex-col items-center justify-center h-64 text-gray-400 text-center p-6 bg-white rounded-2xl border border-gray-100 border-dashed"><User size={48} className="mb-4 opacity-20" /><p className="mb-4">請先登入以查看或儲存歷史紀錄</p><button onClick={handleLogin} className="bg-black text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-gray-800 transition-all">使用 Google 登入</button></div>)}
                {user && historyRecords.length === 0 && <div className="text-center text-gray-400 py-20 text-sm bg-white rounded-2xl border border-gray-100 border-dashed">尚無儲存的專案參數</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {historyRecords.map((record) => (
                    <div key={record.id} onClick={() => handleLoadRecord(record)} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer relative group flex flex-col justify-between h-full">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-bold text-gray-800 text-lg mb-1 line-clamp-1">{record.projectName || '未命名專案'}</h3>
                          <div className="flex items-center gap-2 text-xs text-gray-400"><span>{record.createdAt?.seconds ? new Date(record.createdAt.seconds * 1000).toLocaleString('zh-TW') : '剛剛'}</span></div>
                        </div>
                        <button onClick={(e) => handleDeleteRecord(record.id, e)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors z-10"><Trash2 size={18} /></button>
                      </div>
                      <div className="flex gap-4 text-sm border-t border-gray-50 pt-3 mt-auto">
                        <div><span className="text-gray-400 text-xs block">年化報酬</span><span className="font-bold text-green-600">{record.summary?.roi}%</span></div>
                        <div><span className="text-gray-400 text-xs block">專案淨利</span><span className="font-bold text-gray-700">{formatMoney(record.summary?.netProfit || 0)}</span></div>
                        <div className="ml-auto flex items-center text-blue-500 text-xs font-bold group-hover:translate-x-1 transition-transform">載入 <ChevronRight size={14} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Mobile Bottom Tab Bar */}
          <div className="md:hidden absolute bottom-0 w-full bg-white/90 backdrop-blur border-t border-gray-200 h-20 flex justify-around pt-2 pb-6 z-20">
            <button onClick={() => setActiveTab('input')} className={`flex flex-col items-center w-16 ${activeTab === 'input' ? 'text-blue-600' : 'text-gray-400'}`}><LayoutDashboard size={24} strokeWidth={activeTab === 'input' ? 2.5 : 2} /><span className="text-[10px] mt-1 font-medium">試算</span></button>
            <button onClick={() => setActiveTab('report')} className={`flex flex-col items-center w-16 ${activeTab === 'report' ? 'text-blue-600' : 'text-gray-400'}`}><PieChart size={24} strokeWidth={activeTab === 'report' ? 2.5 : 2} /><span className="text-[10px] mt-1 font-medium">分析</span></button>
            <button onClick={() => setActiveTab('detail')} className={`flex flex-col items-center w-16 ${activeTab === 'detail' ? 'text-blue-600' : 'text-gray-400'}`}><List size={24} strokeWidth={activeTab === 'detail' ? 2.5 : 2} /><span className="text-[10px] mt-1 font-medium">明細</span></button>
            <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center w-16 ${activeTab === 'history' ? 'text-blue-600' : 'text-gray-400'}`}><History size={24} strokeWidth={activeTab === 'history' ? 2.5 : 2} /><span className="text-[10px] mt-1 font-medium">紀錄</span></button>
            <button onClick={() => setActiveTab('funds')} className={`flex flex-col items-center w-16 ${activeTab === 'funds' ? 'text-blue-600' : 'text-gray-400'}`}><PiggyBank size={24} strokeWidth={activeTab === 'funds' ? 2.5 : 2} /><span className="text-[10px] mt-1 font-medium">資金</span></button>
          </div>

        </div>
      </div>
    </div>
  );
}