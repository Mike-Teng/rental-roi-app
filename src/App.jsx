import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, PieChart, List, Calendar, Wallet, Briefcase, TrendingUp, Percent, History, Trash2, ChevronRight, UploadCloud, X, LogIn, LogOut, User, RefreshCcw, DollarSign, LayoutDashboard, Menu } from 'lucide-react';

// --- Firebase 模組導入 ---
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";

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

// --- 全域變數宣告 ---
let db = null;
let auth = null;

// --- 初始化 Firebase ---
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
      <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1">
        <X size={14} />
      </button>
    </div>
  );
};

const InputGroup = ({ label, children, className="" }) => (
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
      <div className="flex items-center gap-2 mb-2 opacity-90">
        {Icon && <Icon size={18} />}
        <span className="text-sm font-medium">{title}</span>
      </div>
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
  const [monthlyOverrides, setMonthlyOverrides] = useState({});

  const [inputs, setInputs] = useState({
    projectName: '我的租賃專案',
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

  // 1. 監聽登入
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
    try { await signOut(auth); showNotify("已登出"); setHistoryRecords([]); }
    catch (error) { showNotify("登出失敗", "error"); }
  };

  // 2. Firebase 監聽
  useEffect(() => {
    if (!db || !user) return;
    try {
      const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setHistoryRecords(records);
      }, (error) => console.error("Firebase 讀取錯誤:", error));
      return () => unsubscribe();
    } catch (err) { console.error("Firebase Query 錯誤:", err); }
  }, [user]);

  // 儲存
  const handleSaveToCloud = async () => {
    if (!db || !user) { showNotify("請先登入並連接資料庫", "error"); return; }
    setIsSaving(true);
    try {
      await addDoc(collection(db, "projects"), {
        ...inputs,
        monthlyOverrides: JSON.stringify(monthlyOverrides),
        userId: user.uid,
        authorName: user.displayName,
        createdAt: serverTimestamp(),
        summary: { roi: results.investorAnnualizedROI, netProfit: results.projectRealNetProfit }
      });
      showNotify("儲存成功！");
      setActiveTab('history');
    } catch (error) { showNotify("儲存失敗", "error"); }
    setIsSaving(false);
  };

  const handleDeleteRecord = async (id, e) => {
    e.stopPropagation();
    if (!db || !user) return;
    try { await deleteDoc(doc(db, "projects", id)); showNotify("紀錄已刪除"); }
    catch (error) { showNotify("刪除失敗", "error"); }
  };

  const handleLoadRecord = (record) => {
    const { id, createdAt, summary, userId, authorName, monthlyOverrides: savedOverrides, ...recordInputs } = record;
    
    if (recordInputs.monthlyMisc && recordInputs.expenseOther === undefined) {
      recordInputs.expenseOther = recordInputs.monthlyMisc;
      recordInputs.expenseManagement = 0;
      recordInputs.expenseMaintenance = 0;
      recordInputs.expenseTax = 0;
      recordInputs.expenseInsurance = 0;
    }

    setInputs(prev => ({ ...prev, ...recordInputs }));
    
    if (savedOverrides) {
      try { setMonthlyOverrides(JSON.parse(savedOverrides)); } catch (e) { setMonthlyOverrides({}); }
    } else { setMonthlyOverrides({}); }
    
    showNotify("已載入專案資料");
    setActiveTab('report');
  };

  const handleOverrideChange = (index, field, val) => {
    const numVal = val === '' ? null : parseFloat(val);
    setMonthlyOverrides(prev => {
      const currentMonth = prev[index] || {};
      const newMonthData = { ...currentMonth, [field]: numVal };
      if (newMonthData.income == null && newMonthData.expense == null) {
        const { [index]: deleted, ...rest } = prev;
        return rest;
      }
      return { ...prev, [index]: newMonthData };
    });
  };

  const handleResetOverrides = () => {
    if (window.confirm("確定要清除所有手動修改，恢復預設值嗎？")) {
      setMonthlyOverrides({});
      showNotify("已恢復預設值");
    }
  };

  // --- 3. 計算核心邏輯 (含 IRR & NPV) ---
  const results = useMemo(() => {
    const start = new Date(inputs.startDate + '-01');
    const totalMonths = parseInt(inputs.contractMonths) || 0;
    const p1Months = parseInt(inputs.phase1Months) || 0;
    const actualCost = parseInt(inputs.actualUpfrontCost) || 0;
    const discountRateAnnual = (parseFloat(inputs.discountRate) || 0) / 100;
    
    const fundInjPct = (parseFloat(inputs.fundInjectionRatio) || 0) / 100;
    const manInjPct = (parseFloat(inputs.manpowerInjectionRatio) || 0) / 100;
    const fundProfPct = (parseFloat(inputs.fundProfitRatio) || 0) / 100;
    const manProfPct = (parseFloat(inputs.manpowerProfitRatio) || 0) / 100;

    const baseExpense = 
      (parseInt(inputs.expenseManagement) || 0) +
      (parseInt(inputs.expenseMaintenance) || 0) +
      (parseInt(inputs.expenseTax) || 0) +
      (parseInt(inputs.expenseInsurance) || 0) +
      (parseInt(inputs.expenseOther) || 0);

    const rent1 = parseInt(inputs.rentPhase1) || 0;
    const rent2 = parseInt(inputs.rentPhase2) || 0;
    const baseIncome = parseInt(inputs.monthlyIncome) || 0;

    let cumulativeCashFlow = 0;
    let breakEvenDate = null;
    let breakEvenMonthIndex = -1;
    let totalRevenue = 0;
    let totalExpenses = 0;
    
    const monthlyData = [];
    const netCashFlowsForIRR = [-actualCost];

    for (let i = 0; i < totalMonths; i++) {
      const currentMonthDate = new Date(start);
      currentMonthDate.setMonth(start.getMonth() + i);
      const dateStr = `${currentMonthDate.getFullYear()}/${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`;

      const currentRent = i < p1Months ? rent1 : rent2;
      const defaultExpense = currentRent + baseExpense;
      
      let defaultIncome = baseIncome;
      if (i >= 12) defaultIncome = Math.round(baseIncome * 0.95);

      const override = monthlyOverrides[i] || {};
      const currentIncome = override.income != null ? override.income : defaultIncome;
      const currentExpense = override.expense != null ? override.expense : defaultExpense;
      
      const netCashFlow = currentIncome - currentExpense;
      
      cumulativeCashFlow += netCashFlow;
      totalRevenue += currentIncome;
      totalExpenses += currentExpense;
      netCashFlowsForIRR.push(netCashFlow);

      if (breakEvenMonthIndex === -1 && cumulativeCashFlow >= actualCost) {
        breakEvenMonthIndex = i + 1;
        breakEvenDate = dateStr;
      }

      monthlyData.push({
        month: i + 1, 
        date: dateStr, 
        income: currentIncome,
        expense: currentExpense, 
        netProfit: netCashFlow, 
        cumulative: cumulativeCashFlow,
        isOverridden: override.income != null || override.expense != null
      });
    }

    const monthlyDiscountRate = discountRateAnnual / 12;
    const npv = calculateNPV(monthlyDiscountRate, actualCost, netCashFlowsForIRR.slice(1));
    const monthlyIRR = calculateIRR(netCashFlowsForIRR);
    const annualIRR = monthlyIRR ? (Math.pow(1 + monthlyIRR, 12) - 1) * 100 : 0;

    const monthlyAmortization = totalMonths > 0 ? Math.round(actualCost / totalMonths) : 0;
    const monthlyTotalCostWithAmort = totalMonths > 0 ? Math.round((totalExpenses / totalMonths) + monthlyAmortization) : 0;
    const avgMonthlyNetIncome = totalMonths > 0 ? Math.round((totalRevenue - totalExpenses - actualCost) / totalMonths) : 0; 
    
    const projectRealNetProfit = cumulativeCashFlow - actualCost;

    const investorProfitShare = projectRealNetProfit > 0 ? projectRealNetProfit * fundProfPct : 0;
    const operatorProfitShare = projectRealNetProfit > 0 ? projectRealNetProfit * manProfPct : 0;
    
    const investorPrincipal = actualCost * fundInjPct;
    const operatorPrincipal = actualCost * manInjPct;

    const years = totalMonths / 12;
    const investorAnnualizedROI = (investorPrincipal > 0 && years > 0) 
      ? ((investorProfitShare / investorPrincipal) / years * 100).toFixed(1) : "0.0";
    const operatorAnnualizedROI = (operatorPrincipal > 0 && years > 0)
      ? ((operatorProfitShare / operatorPrincipal) / years * 100).toFixed(1) : "0.0";

    const totalCostIncludingUpfront = totalExpenses + actualCost;
    const costRatio = totalRevenue > 0 ? (totalCostIncludingUpfront / totalRevenue * 100).toFixed(1) : 0;

    return {
      breakEvenDate: breakEvenDate || '未回本',
      breakEvenMonths: breakEvenMonthIndex === -1 ? '-' : breakEvenMonthIndex,
      investorPrincipal, investorProfitShare, investorAnnualizedROI,
      operatorPrincipal, operatorProfitShare, operatorAnnualizedROI,
      projectRealNetProfit, monthlyAmortization, monthlyTotalCostWithAmort,
      avgMonthlyNetIncome, costRatio, monthlyData,
      npv: Math.round(npv),
      irr: annualIRR.toFixed(2)
    };
  }, [inputs, monthlyOverrides]);

  const handleRatioChange = (keyA, keyB, value) => {
    const val = parseFloat(value);
    if (isNaN(val)) return;
    setInputs(prev => ({ ...prev, [keyA]: val, [keyB]: 100 - val }));
  };

  // --- 導航組件 (共用) ---
  const NavItem = ({ id, label, icon: Icon, active }) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all ${active ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
    >
      <Icon size={20} strokeWidth={2.5} />
      <span className="font-medium text-sm md:text-base">{label}</span>
    </button>
  );

  return (
    <div className="bg-gray-100 min-h-screen font-sans flex justify-center text-gray-900 md:p-6 md:items-center">
      <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ message: '', type: 'success' })} />

      {/* Main Container: Mobile (Full Screen) / Desktop (Card with Sidebar) */}
      <div className="w-full md:max-w-7xl bg-gray-50 h-[100dvh] md:h-[90vh] md:min-h-[800px] flex flex-col md:flex-row relative shadow-2xl md:rounded-3xl overflow-hidden border border-gray-200">
        
        {/* --- Desktop Sidebar (Hidden on Mobile) --- */}
        <div className="hidden md:flex flex-col w-72 bg-white border-r border-gray-100 p-6 shrink-0">
          <div className="mb-10 px-2">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Calculator className="text-blue-600" /> 租賃試算
            </h1>
            <p className="text-xs text-gray-400 mt-1 font-medium ml-8">PRO VERSION</p>
          </div>

          <div className="space-y-2 flex-1">
            <NavItem id="input" label="試算設定" icon={LayoutDashboard} active={activeTab === 'input'} />
            <NavItem id="report" label="報表分析" icon={PieChart} active={activeTab === 'report'} />
            <NavItem id="detail" label="現金流明細" icon={List} active={activeTab === 'detail'} />
            <NavItem id="history" label="歷史紀錄" icon={History} active={activeTab === 'history'} />
          </div>

          <div className="mt-auto border-t border-gray-100 pt-6">
            {user ? (
              <div className="bg-gray-50 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">
                    {user.displayName?.[0] || 'U'}
                  </div>
                  <div className="truncate text-sm font-medium text-gray-700">{user.displayName}</div>
                </div>
                <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="登出">
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button onClick={handleLogin} className="w-full bg-black text-white py-3 rounded-xl font-bold shadow-lg hover:bg-gray-800 transition-all flex items-center justify-center gap-2">
                <LogIn size={18} /> 登入 / 註冊
              </button>
            )}
          </div>
        </div>

        {/* --- Content Area --- */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          
          {/* Mobile Top Nav (Hidden on Desktop) */}
          <div className="md:hidden bg-white px-5 pt-12 pb-4 shadow-sm z-10 flex justify-between items-center shrink-0">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">租賃專案試算</h1>
              <p className="text-xs text-gray-500 mt-1">Project ROI Calculator</p>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  {activeTab === 'report' && (
                    <button onClick={handleSaveToCloud} disabled={isSaving} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold shadow hover:bg-blue-700 flex items-center gap-1">
                      {isSaving ? "..." : <UploadCloud size={14} />}
                    </button>
                  )}
                  <button onClick={handleLogout} className="bg-gray-100 text-gray-600 p-2 rounded-lg hover:bg-gray-200 transition-colors">
                    <LogOut size={16} />
                  </button>
                </>
              ) : (
                <button onClick={handleLogin} className="bg-black text-white px-3 py-2 rounded-lg text-xs font-bold shadow hover:bg-gray-800 flex items-center gap-1 transition-colors">
                  <LogIn size={14} /> 登入
                </button>
              )}
            </div>
          </div>

          {/* Desktop Header (Hidden on Mobile) */}
          <div className="hidden md:flex justify-between items-center px-8 py-6 bg-white/50 backdrop-blur-sm sticky top-0 z-20 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-800">
              {activeTab === 'input' && '參數設定'}
              {activeTab === 'report' && '分析總覽'}
              {activeTab === 'detail' && '現金流明細'}
              {activeTab === 'history' && '歷史存檔'}
            </h2>
            {activeTab === 'report' && user && (
              <button 
                onClick={handleSaveToCloud} 
                disabled={isSaving} 
                className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-md hover:bg-blue-700 flex items-center gap-2 transition-all active:scale-95"
              >
                {isSaving ? "儲存中..." : <><UploadCloud size={18} /> 儲存至雲端</>}
              </button>
            )}
          </div>

          {/* Content Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
            
            {/* TAB 1: 輸入設定 (Responsive Grid) */}
            {activeTab === 'input' && (
              <div className="animate-fadeIn max-w-5xl mx-auto">
                 <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
                  <label className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider block">專案名稱</label>
                  <input type="text" value={inputs.projectName} onChange={(e) => setInputs({...inputs, projectName: e.target.value})} className="w-full text-lg md:text-2xl font-bold text-gray-800 border-b border-gray-200 pb-1 outline-none focus:border-blue-500 transition-colors bg-transparent" placeholder="請輸入專案名稱..." />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <InputGroup label="起始與成本">
                      <InputRow label="數值起始年月" type="month" value={inputs.startDate} onChange={v => setInputs({...inputs, startDate: v})} />
                      <InputRow label="前期預估成本" value={inputs.estimatedUpfrontCost} onChange={v => setInputs({...inputs, estimatedUpfrontCost: v})} />
                      <InputRow label="實際投入成本" value={inputs.actualUpfrontCost} onChange={v => setInputs({...inputs, actualUpfrontCost: v})} />
                    </InputGroup>

                    <InputGroup label="每月營運費用細項">
                      <InputRow label="管理費" value={inputs.expenseManagement} onChange={v => setInputs({...inputs, expenseManagement: v})} />
                      <InputRow label="修繕準備金" value={inputs.expenseMaintenance} onChange={v => setInputs({...inputs, expenseMaintenance: v})} />
                      <InputRow label="稅務攤提" value={inputs.expenseTax} onChange={v => setInputs({...inputs, expenseTax: v})} />
                      <InputRow label="保險費" value={inputs.expenseInsurance} onChange={v => setInputs({...inputs, expenseInsurance: v})} />
                      <InputRow label="其他雜支" value={inputs.expenseOther} onChange={v => setInputs({...inputs, expenseOther: v})} />
                      <div className="pt-2 mt-2 border-t border-dashed border-gray-200 flex justify-between items-center text-gray-500">
                        <span className="text-xs font-bold">合計月支出</span>
                        <span className="font-mono font-bold text-red-500">
                          {formatMoney(
                            (parseInt(inputs.expenseManagement)||0) + (parseInt(inputs.expenseMaintenance)||0) +
                            (parseInt(inputs.expenseTax)||0) + (parseInt(inputs.expenseInsurance)||0) +
                            (parseInt(inputs.expenseOther)||0)
                          )}
                        </span>
                      </div>
                    </InputGroup>
                  </div>

                  <div className="space-y-4">
                    <InputGroup label="進階財測設定">
                      <InputRow label="折現率 (NPV用)" value={inputs.discountRate} onChange={v => setInputs({...inputs, discountRate: v})} suffix="%" />
                    </InputGroup>

                    <div className="grid grid-cols-2 gap-4">
                      <InputGroup label="資本投入比例">
                        <InputRow label="資金方投入" value={inputs.fundInjectionRatio} onChange={(v) => handleRatioChange('fundInjectionRatio', 'manpowerInjectionRatio', v)} suffix="%" />
                        <InputRow label="人力方投入" value={inputs.manpowerInjectionRatio} onChange={(v) => handleRatioChange('manpowerInjectionRatio', 'fundInjectionRatio', v)} suffix="%" />
                      </InputGroup>
                      <InputGroup label="獲利分配比例">
                        <InputRow label="資金方分潤" value={inputs.fundProfitRatio} onChange={(v) => handleRatioChange('fundProfitRatio', 'manpowerProfitRatio', v)} suffix="%" />
                        <InputRow label="人力方分潤" value={inputs.manpowerProfitRatio} onChange={(v) => handleRatioChange('manpowerProfitRatio', 'fundProfitRatio', v)} suffix="%" />
                      </InputGroup>
                    </div>

                    <InputGroup label="合約與租金">
                      <InputRow label="合約總月數" value={inputs.contractMonths} onChange={v => setInputs({...inputs, contractMonths: v})} suffix="月" />
                      <InputRow label="前半段月數" value={inputs.phase1Months} onChange={v => setInputs({...inputs, phase1Months: v})} suffix="月" />
                      <InputRow label="前半段租金" value={inputs.rentPhase1} onChange={v => setInputs({...inputs, rentPhase1: v})} />
                      <InputRow label="後半段租金" value={inputs.rentPhase2} onChange={v => setInputs({...inputs, rentPhase2: v})} />
                    </InputGroup>

                    <InputGroup label="收入預估">
                      <InputRow label="每月房客租金" value={inputs.monthlyIncome} onChange={v => setInputs({...inputs, monthlyIncome: v})} />
                      <div className="text-[10px] text-gray-400 text-right px-1 mt-1">*註：第一年後租金自動 * 0.95 計算</div>
                    </InputGroup>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: 報表結果 (Responsive Grid) */}
            {activeTab === 'report' && (
              <div className="animate-fadeIn max-w-6xl mx-auto space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <ResultCard 
                    title="預估回本時間" 
                    value={typeof results.breakEvenMonths === 'number' ? `${results.breakEvenMonths} 個月` : results.breakEvenMonths} 
                    subValue={typeof results.breakEvenMonths === 'number' ? `預計於 ${results.breakEvenDate} 回本` : '尚未在合約期內回本'}
                    icon={Calendar} colorClass={typeof results.breakEvenMonths === 'number' ? "bg-indigo-600" : "bg-red-500"}
                  />
                  <div className="bg-white p-5 rounded-2xl shadow-lg border border-gray-100 flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-2 text-gray-500"><TrendingUp size={18} /><span className="text-sm font-medium">總淨利 (扣除本金)</span></div>
                    <div className={`text-3xl font-bold tracking-tight ${results.projectRealNetProfit > 0 ? 'text-green-600' : 'text-red-500'}`}>{formatMoney(results.projectRealNetProfit)}</div>
                    <div className="text-xs text-gray-400 pt-2 border-t border-gray-100 mt-2">合約期滿總收益</div>
                  </div>
                  <div className="bg-purple-600 text-white p-5 rounded-2xl shadow-lg flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-2 opacity-90"><Percent size={18} /><span className="text-sm font-medium">IRR 內部報酬率</span></div>
                    <div className="text-3xl font-bold tracking-tight">{results.irr}%</div>
                    <div className="text-xs opacity-75 pt-2 border-t border-white/20 mt-2">年化複利回報</div>
                  </div>
                  <div className="bg-blue-500 text-white p-5 rounded-2xl shadow-lg flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-2 opacity-90"><DollarSign size={18} /><span className="text-sm font-medium">NPV 淨現值</span></div>
                    <div className="text-3xl font-bold tracking-tight">{formatMoney(results.npv)}</div>
                    <div className="text-xs opacity-75 pt-2 border-t border-white/20 mt-2">折現率 {inputs.discountRate}%</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2 text-gray-900 font-bold text-lg"><Wallet className="text-green-600" size={24} />資金方</div>
                        <div className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium">出資 {inputs.fundInjectionRatio}% / 分潤 {inputs.fundProfitRatio}%</div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-gray-50 p-4 rounded-xl"><div className="text-xs text-gray-500 mb-1">收回本金</div><div className="text-xl font-bold text-gray-800">{formatMoney(results.investorPrincipal)}</div></div>
                      <div className="bg-green-50 p-4 rounded-xl"><div className="text-xs text-green-700 mb-1">超額分潤</div><div className={`text-xl font-bold ${results.investorProfitShare > 0 ? 'text-green-700' : 'text-red-500'}`}>{results.investorProfitShare > 0 ? '+' : ''}{formatMoney(results.investorProfitShare)}</div></div>
                    </div>
                    <div className="mt-6 flex justify-end items-center border-t border-gray-100 pt-4">
                        <div className="flex items-center gap-2"><Percent size={16} className="text-gray-400"/><span className="text-sm text-gray-500">年化報酬率 (ROI):</span><span className="text-2xl font-bold text-green-600">{results.investorAnnualizedROI}%</span></div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2 text-gray-900 font-bold text-lg"><Briefcase className="text-orange-600" size={24} />人力方</div>
                        <div className="text-xs bg-orange-50 text-orange-700 px-3 py-1 rounded-full font-medium">出資 {inputs.manpowerInjectionRatio}% / 分潤 {inputs.manpowerProfitRatio}%</div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-gray-50 p-4 rounded-xl"><div className="text-xs text-gray-500 mb-1">收回本金</div><div className="text-xl font-bold text-gray-800">{formatMoney(results.operatorPrincipal)}</div></div>
                      <div className="bg-orange-50 p-4 rounded-xl"><div className="text-xs text-orange-700 mb-1">超額分潤</div><div className={`text-xl font-bold ${results.operatorProfitShare > 0 ? 'text-orange-700' : 'text-red-500'}`}>{results.operatorProfitShare > 0 ? '+' : ''}{formatMoney(results.operatorProfitShare)}</div></div>
                    </div>
                     <div className="mt-6 flex justify-end items-center border-t border-gray-100 pt-4">
                        <div className="flex items-center gap-2"><Percent size={16} className="text-gray-400"/><span className="text-sm text-gray-500">年化報酬率 (ROI):</span><span className="text-2xl font-bold text-orange-600">{results.operatorAnnualizedROI}%</span></div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2"><TrendingUp size={20} className="text-blue-500"/>成本分析指標</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div><div className="text-xs text-gray-400 mb-1">成本月攤提</div><div className="text-xl font-bold text-gray-800">{formatMoney(results.monthlyAmortization)}</div></div>
                      <div><div className="text-xs text-gray-400 mb-1">總成本比率</div><div className="text-xl font-bold text-gray-800">{results.costRatio}%</div></div>
                      <div><div className="text-xs text-gray-400 mb-1">平均每月總成本 (真實)</div><div className="text-xl font-bold text-indigo-600">{formatMoney(results.monthlyTotalCostWithAmort)} / 月</div></div>
                      <div><div className="text-xs text-gray-400 mb-1">平均每月純收益 (真實)</div><div className={`text-xl font-bold ${results.avgMonthlyNetIncome > 0 ? 'text-green-600' : 'text-red-500'}`}>{formatMoney(results.avgMonthlyNetIncome)} / 月</div></div>
                    </div>
                </div>
              </div>
            )}

            {/* TAB 3: 月份明細 */}
            {activeTab === 'detail' && (
              <div className="animate-fadeIn bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-5xl mx-auto">
                <div className="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center sticky top-0 z-10">
                  <div className="text-xs text-gray-500 font-bold">現金流明細表 (點擊數字可修改)</div>
                  {Object.keys(monthlyOverrides).length > 0 && (
                    <button onClick={handleResetOverrides} className="text-[10px] bg-white border border-gray-200 px-2 py-1 rounded shadow-sm text-red-500 flex items-center gap-1 hover:bg-red-50 transition-colors">
                      <RefreshCcw size={10} /> 恢復預設
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-4 bg-gray-100 p-3 text-xs font-bold text-gray-500 border-b border-gray-200">
                  <div>年月</div><div className="text-right">收入</div><div className="text-right">支出</div><div className="text-right">淨利</div>
                </div>
                <div className="max-h-[70vh] overflow-y-auto">
                  {results.monthlyData.map((row, idx) => (
                    <div key={idx} className={`grid grid-cols-4 p-2 text-sm border-b border-gray-50 items-center hover:bg-gray-50 transition-colors ${row.cumulative >= inputs.actualUpfrontCost && results.monthlyData[idx-1]?.cumulative < inputs.actualUpfrontCost ? 'bg-yellow-50 hover:bg-yellow-100' : ''}`}>
                      <div className="text-gray-600 text-xs">
                        {row.date}
                        {row.isOverridden && <span className="block text-[9px] text-blue-500 font-bold">*手動</span>}
                        {row.cumulative >= inputs.actualUpfrontCost && results.monthlyData[idx-1]?.cumulative < inputs.actualUpfrontCost && <span className="block text-[10px] text-red-500 font-bold">★回本</span>}
                      </div>
                      <div className="text-right">
                        <input type="number" value={row.income} onChange={(e) => handleOverrideChange(idx, 'income', e.target.value)} className={`w-full text-right bg-transparent outline-none border-b border-transparent focus:border-blue-400 transition-colors py-1 ${monthlyOverrides[idx]?.income != null ? 'text-blue-600 font-bold' : 'text-gray-900'}`} />
                      </div>
                      <div className="text-right">
                        <input type="number" value={row.expense} onChange={(e) => handleOverrideChange(idx, 'expense', e.target.value)} className={`w-full text-right bg-transparent outline-none border-b border-transparent focus:border-red-400 transition-colors py-1 ${monthlyOverrides[idx]?.expense != null ? 'text-red-500 font-bold' : 'text-red-400'}`} />
                      </div>
                      <div className={`text-right font-mono font-medium text-xs ${row.netProfit > 0 ? 'text-green-600' : 'text-gray-400'}`}>{formatMoney(row.netProfit)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: 歷史紀錄 */}
            {activeTab === 'history' && (
              <div className="animate-fadeIn space-y-3 max-w-4xl mx-auto">
                {!user && (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-center p-6 bg-white rounded-2xl border border-gray-100 border-dashed">
                    <User size={48} className="mb-4 opacity-20" />
                    <p className="mb-4">請先登入以查看或儲存歷史紀錄</p>
                    <button onClick={handleLogin} className="bg-black text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-gray-800 transition-all">使用 Google 登入</button>
                  </div>
                )}
                {user && historyRecords.length === 0 && <div className="text-center text-gray-400 py-20 text-sm bg-white rounded-2xl border border-gray-100 border-dashed">尚無儲存的紀錄</div>}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {user && historyRecords.map((record) => (
                    <div key={record.id} onClick={() => handleLoadRecord(record)} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer relative group flex flex-col justify-between h-full">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-bold text-gray-800 text-lg mb-1 line-clamp-1">{record.projectName || '未命名專案'}</h3>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>{record.createdAt?.seconds ? new Date(record.createdAt.seconds * 1000).toLocaleString('zh-TW') : '剛剛'}</span>
                            {record.monthlyOverrides && <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-bold">含手動調整</span>}
                          </div>
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

          {/* Mobile Bottom Tab Bar (Hidden on Desktop) */}
          <div className="md:hidden absolute bottom-0 w-full bg-white/90 backdrop-blur border-t border-gray-200 h-20 flex justify-around pt-2 pb-6 z-20">
            <button onClick={() => setActiveTab('input')} className={`flex flex-col items-center w-16 ${activeTab === 'input' ? 'text-blue-600' : 'text-gray-400'}`}><LayoutDashboard size={24} strokeWidth={activeTab === 'input' ? 2.5 : 2} /><span className="text-[10px] mt-1 font-medium">試算</span></button>
            <button onClick={() => setActiveTab('report')} className={`flex flex-col items-center w-16 ${activeTab === 'report' ? 'text-blue-600' : 'text-gray-400'}`}><PieChart size={24} strokeWidth={activeTab === 'report' ? 2.5 : 2} /><span className="text-[10px] mt-1 font-medium">分析</span></button>
            <button onClick={() => setActiveTab('detail')} className={`flex flex-col items-center w-16 ${activeTab === 'detail' ? 'text-blue-600' : 'text-gray-400'}`}><List size={24} strokeWidth={activeTab === 'detail' ? 2.5 : 2} /><span className="text-[10px] mt-1 font-medium">明細</span></button>
            <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center w-16 ${activeTab === 'history' ? 'text-blue-600' : 'text-gray-400'}`}><History size={24} strokeWidth={activeTab === 'history' ? 2.5 : 2} /><span className="text-[10px] mt-1 font-medium">紀錄</span></button>
          </div>

        </div>
      </div>
    </div>
  );
}