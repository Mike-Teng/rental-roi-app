import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, PieChart, List, Calendar, Wallet, Briefcase, TrendingUp, Percent, History, Trash2, ChevronRight, UploadCloud, X, LogIn, LogOut, User } from 'lucide-react';

// --- Firebase 模組導入 ---
import { initializeApp } from "firebase/app";
// 新增 Auth 相關模組
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";

// --- ⚠️ Firebase 設定 (請保持您原本填好的金鑰) ---
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
let auth = null; // 新增 auth 變數

// --- 初始化 Firebase ---
try {
  if (firebaseConfig.apiKey) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app); // 初始化 Auth
    console.log("Firebase & Auth 初始化成功");
  } else {
    console.warn("⚠️ Firebase Config 未填寫");
  }
} catch (e) {
  console.error("Firebase 初始化失敗:", e);
}

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

const InputGroup = ({ label, children }) => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-3">
    <div className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">{label}</div>
    <div className="space-y-3">{children}</div>
  </div>
);

const InputRow = ({ label, value, onChange, type = "number", suffix = "" }) => (
  <div className="flex justify-between items-center border-b border-gray-50 last:border-0 pb-2 last:pb-0">
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
  <div className={`${colorClass} text-white p-5 rounded-2xl shadow-lg mb-4`}>
    <div className="flex items-center gap-2 mb-2 opacity-90">
      {Icon && <Icon size={18} />}
      <span className="text-sm font-medium">{title}</span>
    </div>
    <div className="text-4xl font-bold tracking-tight mb-1">{value}</div>
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
  
  // 新增：使用者狀態
  const [user, setUser] = useState(null);

  const [inputs, setInputs] = useState({
    projectName: '我的租賃專案',
    estimatedUpfrontCost: 2000000,
    actualUpfrontCost: 2200000,
    monthlyMisc: 5000,
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

  // --- 1. 監聽登入狀態 ---
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 登入功能
  const handleLogin = async () => {
    if (!auth) {
      showNotify("Auth 未初始化，請檢查 Config", "error");
      return;
    }
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      showNotify("登入成功！");
    } catch (error) {
      console.error("Login Failed:", error);
      showNotify("登入失敗，請重試", "error");
    }
  };

  // 登出功能
  const handleLogout = async () => {
    try {
      await signOut(auth);
      showNotify("已登出");
      setHistoryRecords([]); // 清空畫面上的紀錄
    } catch (error) {
      showNotify("登出失敗", "error");
    }
  };

  // --- 2. Firebase 資料庫監聽 (只有登入後才執行) ---
  useEffect(() => {
    if (!db || !user) return; // 沒登入就不監聽
    
    try {
      const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const records = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setHistoryRecords(records);
      }, (error) => {
        console.error("Firebase 讀取錯誤:", error);
        if (error.code === 'permission-denied') {
           // 如果規則沒設好，這裡會報錯
        }
      });
      return () => unsubscribe();
    } catch (err) {
      console.error("Firebase Query 錯誤:", err);
    }
  }, [user]); // user 改變時重新執行

  // 儲存到雲端
  const handleSaveToCloud = async () => {
    if (!db) {
      showNotify("未連接資料庫", "error");
      return;
    }
    if (!user) {
      showNotify("請先登入才能儲存", "error");
      return;
    }
    setIsSaving(true);
    try {
      await addDoc(collection(db, "projects"), {
        ...inputs,
        userId: user.uid, // 紀錄是誰存的
        authorName: user.displayName,
        createdAt: serverTimestamp(),
        summary: {
          roi: results.investorAnnualizedROI,
          netProfit: results.projectRealNetProfit
        }
      });
      showNotify("儲存成功！");
      setActiveTab('history');
    } catch (error) {
      console.error("Error adding document: ", error);
      showNotify("儲存失敗，權限不足", "error");
    }
    setIsSaving(false);
  };

  const handleDeleteRecord = async (id, e) => {
    e.stopPropagation();
    if (!db || !user) return;
    
    try {
      await deleteDoc(doc(db, "projects", id));
      showNotify("紀錄已刪除");
    } catch (error) {
      console.error("Error deleting document: ", error);
      showNotify("刪除失敗，您可能沒有權限", "error");
    }
  };

  const handleLoadRecord = (record) => {
    // eslint-disable-next-line no-unused-vars
    const { id, createdAt, summary, userId, authorName, ...recordInputs } = record;
    setInputs(prev => ({ ...prev, ...recordInputs }));
    showNotify("已載入專案資料");
    setActiveTab('report');
  };

  const results = useMemo(() => {
    const start = new Date(inputs.startDate + '-01');
    const totalMonths = parseInt(inputs.contractMonths) || 0;
    const p1Months = parseInt(inputs.phase1Months) || 0;
    const actualCost = parseInt(inputs.actualUpfrontCost) || 0;
    
    const fundInjPct = (parseFloat(inputs.fundInjectionRatio) || 0) / 100;
    const manInjPct = (parseFloat(inputs.manpowerInjectionRatio) || 0) / 100;
    const fundProfPct = (parseFloat(inputs.fundProfitRatio) || 0) / 100;
    const manProfPct = (parseFloat(inputs.manpowerProfitRatio) || 0) / 100;

    const misc = parseInt(inputs.monthlyMisc) || 0;
    const rent1 = parseInt(inputs.rentPhase1) || 0;
    const rent2 = parseInt(inputs.rentPhase2) || 0;
    const baseIncome = parseInt(inputs.monthlyIncome) || 0;

    let cumulativeCashFlow = 0;
    let breakEvenDate = null;
    let breakEvenMonthIndex = -1;
    let totalRevenue = 0;
    let totalExpenses = 0;
    
    const monthlyData = [];

    for (let i = 0; i < totalMonths; i++) {
      const currentMonthDate = new Date(start);
      currentMonthDate.setMonth(start.getMonth() + i);
      const dateStr = `${currentMonthDate.getFullYear()}/${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`;

      const currentRent = i < p1Months ? rent1 : rent2;

      let currentIncome = baseIncome;
      if (i >= 12) currentIncome = Math.round(baseIncome * 0.95);
      
      const netCashFlow = currentIncome - (currentRent + misc);
      cumulativeCashFlow += netCashFlow;
      totalRevenue += currentIncome;
      totalExpenses += (currentRent + misc);

      if (breakEvenMonthIndex === -1 && cumulativeCashFlow >= actualCost) {
        breakEvenMonthIndex = i + 1;
        breakEvenDate = dateStr;
      }

      monthlyData.push({
        month: i + 1, date: dateStr, rent: currentRent, income: currentIncome,
        expense: currentRent + misc, netProfit: netCashFlow, cumulative: cumulativeCashFlow
      });
    }

    const monthlyAmortization = totalMonths > 0 ? Math.round(actualCost / totalMonths) : 0;
    const avgMonthlyRent = totalMonths > 0 ? (totalExpenses - (misc * totalMonths)) / totalMonths : 0;
    const monthlyTotalCostWithAmort = Math.round(avgMonthlyRent + misc + monthlyAmortization);
    const avgMonthlyRevenue = totalMonths > 0 ? totalRevenue / totalMonths : 0;
    const avgMonthlyNetIncome = Math.round(avgMonthlyRevenue - monthlyTotalCostWithAmort);
    
    const totalEstimatedProfit = avgMonthlyNetIncome * totalMonths;
    const investorProfitShare = totalEstimatedProfit * fundProfPct;
    const operatorProfitShare = totalEstimatedProfit * manProfPct;
    const investorPrincipal = actualCost * fundInjPct;
    const operatorPrincipal = actualCost * manInjPct;

    const years = totalMonths / 12;
    const investorAnnualizedROI = (investorPrincipal > 0 && years > 0) 
      ? ((investorProfitShare / investorPrincipal) / years * 100).toFixed(1) : "0.0";
    const operatorAnnualizedROI = (operatorPrincipal > 0 && years > 0)
      ? ((operatorProfitShare / operatorPrincipal) / years * 100).toFixed(1) : "0.0";

    const projectRealNetProfit = cumulativeCashFlow - actualCost;
    const totalCostIncludingUpfront = totalExpenses + actualCost;
    const costRatio = totalRevenue > 0 ? (totalCostIncludingUpfront / totalRevenue * 100).toFixed(1) : 0;

    return {
      breakEvenDate: breakEvenDate || '未回本',
      breakEvenMonths: breakEvenMonthIndex === -1 ? '-' : breakEvenMonthIndex,
      investorPrincipal, investorProfitShare, investorAnnualizedROI,
      operatorPrincipal, operatorProfitShare, operatorAnnualizedROI,
      projectRealNetProfit, monthlyAmortization, monthlyTotalCostWithAmort,
      avgMonthlyNetIncome, costRatio, monthlyData,
    };
  }, [inputs]);

  const handleRatioChange = (keyA, keyB, value) => {
    const val = parseFloat(value);
    if (isNaN(val)) return;
    setInputs(prev => ({ ...prev, [keyA]: val, [keyB]: 100 - val }));
  };

  return (
    <div className="bg-gray-100 min-h-screen font-sans flex justify-center text-gray-900">
      <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ message: '', type: 'success' })} />

      <div className="w-full max-w-md bg-gray-50 h-[100dvh] flex flex-col relative shadow-2xl overflow-hidden">
        
        {/* 頂部導航 */}
        <div className="bg-white px-5 pt-12 pb-4 shadow-sm z-10 flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">租賃專案試算</h1>
            <p className="text-xs text-gray-500 mt-1">Project ROI Calculator</p>
          </div>
          
          {/* 登入/登出/儲存 按鈕區 */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {/* 已登入：顯示儲存與登出 */}
                {activeTab === 'report' && (
                  <button onClick={handleSaveToCloud} disabled={isSaving} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold shadow hover:bg-blue-700 flex items-center gap-1">
                    {isSaving ? "..." : <UploadCloud size={14} />}
                  </button>
                )}
                <button onClick={handleLogout} className="bg-gray-100 text-gray-600 p-2 rounded-lg hover:bg-gray-200 transition-colors" title={`登出 ${user.displayName}`}>
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              /* 未登入：顯示登入按鈕 */
              <button onClick={handleLogin} className="bg-black text-white px-3 py-2 rounded-lg text-xs font-bold shadow hover:bg-gray-800 flex items-center gap-1 transition-colors">
                <LogIn size={14} /> 登入
              </button>
            )}
          </div>
        </div>

        {/* 內容捲動區 */}
        <div className="flex-1 overflow-y-auto p-4 pb-24">
          
          {/* TAB 1: 輸入設定 */}
          {activeTab === 'input' && (
            <div className="animate-fadeIn">
               <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-3">
                <label className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider block">專案名稱</label>
                <input 
                  type="text" 
                  value={inputs.projectName}
                  onChange={(e) => setInputs({...inputs, projectName: e.target.value})}
                  className="w-full text-lg font-bold text-gray-800 border-b border-gray-200 pb-1 outline-none focus:border-blue-500 transition-colors bg-transparent"
                  placeholder="請輸入專案名稱..."
                />
              </div>

              <InputGroup label="起始與成本">
                <InputRow label="數值起始年月" type="month" value={inputs.startDate} onChange={v => setInputs({...inputs, startDate: v})} />
                <InputRow label="前期預估成本" value={inputs.estimatedUpfrontCost} onChange={v => setInputs({...inputs, estimatedUpfrontCost: v})} />
                <InputRow label="實際投入成本" value={inputs.actualUpfrontCost} onChange={v => setInputs({...inputs, actualUpfrontCost: v})} />
                <InputRow label="預估每月雜支" value={inputs.monthlyMisc} onChange={v => setInputs({...inputs, monthlyMisc: v})} />
              </InputGroup>

              <InputGroup label="資本投入比例">
                <InputRow label="資金方投入" value={inputs.fundInjectionRatio} onChange={(v) => handleRatioChange('fundInjectionRatio', 'manpowerInjectionRatio', v)} suffix="%" />
                <InputRow label="人力方投入" value={inputs.manpowerInjectionRatio} onChange={(v) => handleRatioChange('manpowerInjectionRatio', 'fundInjectionRatio', v)} suffix="%" />
              </InputGroup>

              <InputGroup label="獲利分配比例">
                <InputRow label="資金方分潤" value={inputs.fundProfitRatio} onChange={(v) => handleRatioChange('fundProfitRatio', 'manpowerProfitRatio', v)} suffix="%" />
                <InputRow label="人力方分潤" value={inputs.manpowerProfitRatio} onChange={(v) => handleRatioChange('manpowerProfitRatio', 'fundProfitRatio', v)} suffix="%" />
              </InputGroup>

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
          )}

          {/* TAB 2: 報表結果 */}
          {activeTab === 'report' && (
            <div className="animate-fadeIn space-y-4">
              <ResultCard 
                title="預估回本時間" 
                value={typeof results.breakEvenMonths === 'number' ? `${results.breakEvenMonths} 個月` : results.breakEvenMonths} 
                subValue={typeof results.breakEvenMonths === 'number' ? `預計於 ${results.breakEvenDate} 回本` : '尚未在合約期內回本'}
                icon={Calendar}
                colorClass={typeof results.breakEvenMonths === 'number' ? "bg-indigo-600" : "bg-red-500"}
              />

              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
                <div className="text-xs text-gray-400 mb-1">合約期滿總淨利 (扣除本金後)</div>
                <div className={`text-2xl font-bold ${results.projectRealNetProfit > 0 ? 'text-green-600' : 'text-red-500'}`}>{formatMoney(results.projectRealNetProfit)}</div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-gray-900 font-bold"><Wallet className="text-green-600" size={20} />資金方</div>
                    <div className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full">出資 {inputs.fundInjectionRatio}% / 分潤 {inputs.fundProfitRatio}%</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg"><div className="text-xs text-gray-500 mb-1">收回本金</div><div className="text-lg font-semibold text-gray-800">{formatMoney(results.investorPrincipal)}</div></div>
                  <div className="bg-green-50 p-3 rounded-lg"><div className="text-xs text-green-700 mb-1">超額分潤</div><div className={`text-lg font-bold ${results.investorProfitShare > 0 ? 'text-green-700' : 'text-red-500'}`}>{results.investorProfitShare > 0 ? '+' : ''}{formatMoney(results.investorProfitShare)}</div></div>
                </div>
                <div className="mt-4 flex justify-end items-center border-t border-gray-100 pt-3">
                    <div className="flex items-center gap-2"><Percent size={14} className="text-gray-400"/><span className="text-xs text-gray-500">年化報酬率 (ROI):</span><span className="text-lg font-bold text-green-600">{results.investorAnnualizedROI}%</span></div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-gray-900 font-bold"><Briefcase className="text-orange-600" size={20} />人力方</div>
                    <div className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded-full">出資 {inputs.manpowerInjectionRatio}% / 分潤 {inputs.manpowerProfitRatio}%</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg"><div className="text-xs text-gray-500 mb-1">收回本金</div><div className="text-lg font-semibold text-gray-800">{formatMoney(results.operatorPrincipal)}</div></div>
                  <div className="bg-orange-50 p-3 rounded-lg"><div className="text-xs text-orange-700 mb-1">超額分潤</div><div className={`text-lg font-bold ${results.operatorProfitShare > 0 ? 'text-orange-700' : 'text-red-500'}`}>{results.operatorProfitShare > 0 ? '+' : ''}{formatMoney(results.operatorProfitShare)}</div></div>
                </div>
                 <div className="mt-4 flex justify-end items-center border-t border-gray-100 pt-3">
                    <div className="flex items-center gap-2"><Percent size={14} className="text-gray-400"/><span className="text-xs text-gray-500">年化報酬率 (ROI):</span><span className="text-lg font-bold text-orange-600">{results.operatorAnnualizedROI}%</span></div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <div className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><TrendingUp size={16} className="text-blue-500"/>成本分析指標</div>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                    <div><div className="text-xs text-gray-400 mb-1">成本月攤提</div><div className="text-base font-bold text-gray-800">{formatMoney(results.monthlyAmortization)}</div></div>
                    <div><div className="text-xs text-gray-400 mb-1">總成本比率</div><div className="text-base font-bold text-gray-800">{results.costRatio}%</div></div>
                    <div className="col-span-2 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 mt-1">
                        <div><div className="text-xs text-gray-400 mb-1">平均每月總成本</div><div className="text-base font-bold text-indigo-600">{formatMoney(results.monthlyTotalCostWithAmort)} / 月</div></div>
                        <div><div className="text-xs text-gray-400 mb-1">平均每月純收益</div><div className={`text-base font-bold ${results.avgMonthlyNetIncome > 0 ? 'text-green-600' : 'text-red-500'}`}>{formatMoney(results.avgMonthlyNetIncome)} / 月</div></div>
                    </div>
                  </div>
              </div>
            </div>
          )}

          {/* TAB 3: 月份明細 */}
          {activeTab === 'detail' && (
            <div className="animate-fadeIn bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-4 bg-gray-100 p-3 text-xs font-bold text-gray-500 border-b border-gray-200">
                <div>年月</div><div className="text-right">收入</div><div className="text-right">支出</div><div className="text-right">淨利</div>
              </div>
              {results.monthlyData.map((row, idx) => (
                <div key={idx} className={`grid grid-cols-4 p-3 text-sm border-b border-gray-50 items-center ${row.cumulative >= inputs.actualUpfrontCost && results.monthlyData[idx-1]?.cumulative < inputs.actualUpfrontCost ? 'bg-yellow-50' : ''}`}>
                  <div className="text-gray-600 text-xs">{row.date}{row.cumulative >= inputs.actualUpfrontCost && results.monthlyData[idx-1]?.cumulative < inputs.actualUpfrontCost && <span className="block text-[10px] text-red-500 font-bold">★回本</span>}</div>
                  <div className="text-right font-mono">{formatMoney(row.income)}</div>
                  <div className="text-right font-mono text-red-400">{formatMoney(row.expense)}</div>
                  <div className={`text-right font-mono font-medium ${row.netProfit > 0 ? 'text-green-600' : 'text-gray-400'}`}>{formatMoney(row.netProfit)}</div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: 歷史紀錄 */}
          {activeTab === 'history' && (
            <div className="animate-fadeIn space-y-3">
              {!user && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-center p-6">
                  <User size={48} className="mb-4 opacity-20" />
                  <p className="mb-4">請先登入以查看或儲存歷史紀錄</p>
                  <button onClick={handleLogin} className="bg-black text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-gray-800 transition-all">
                    使用 Google 登入
                  </button>
                </div>
              )}
              
              {user && historyRecords.length === 0 && (
                <div className="text-center text-gray-400 py-10 text-sm">尚無儲存的紀錄</div>
              )}
              
              {user && historyRecords.map((record) => (
                <div 
                  key={record.id} 
                  onClick={() => handleLoadRecord(record)}
                  className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 active:scale-[0.98] transition-transform cursor-pointer relative group"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-gray-800 text-lg mb-1">{record.projectName || '未命名專案'}</h3>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                        <span>{record.createdAt?.seconds ? new Date(record.createdAt.seconds * 1000).toLocaleString('zh-TW') : '剛剛'}</span>
                        {record.authorName && <span className="bg-gray-100 px-1 rounded">by {record.authorName}</span>}
                      </div>
                    </div>
                    <button 
                      onClick={(e) => handleDeleteRecord(record.id, e)}
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors z-10"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  
                  <div className="flex gap-4 text-sm border-t border-gray-50 pt-3">
                    <div>
                      <span className="text-gray-400 text-xs block">年化報酬</span>
                      <span className="font-bold text-green-600">{record.summary?.roi}%</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs block">專案淨利</span>
                      <span className="font-bold text-gray-700">{formatMoney(record.summary?.netProfit || 0)}</span>
                    </div>
                    <div className="ml-auto flex items-center text-blue-500 text-xs font-bold">
                      載入 <ChevronRight size={14} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* 底部 Tab Bar */}
        <div className="absolute bottom-0 w-full bg-white/90 backdrop-blur border-t border-gray-200 h-20 flex justify-around pt-2 pb-6 z-20">
          <button onClick={() => setActiveTab('input')} className={`flex flex-col items-center w-16 ${activeTab === 'input' ? 'text-blue-600' : 'text-gray-400'}`}>
            <Calculator size={24} strokeWidth={activeTab === 'input' ? 2.5 : 2} />
            <span className="text-[10px] mt-1 font-medium">試算</span>
          </button>
          <button onClick={() => setActiveTab('report')} className={`flex flex-col items-center w-16 ${activeTab === 'report' ? 'text-blue-600' : 'text-gray-400'}`}>
            <PieChart size={24} strokeWidth={activeTab === 'report' ? 2.5 : 2} />
            <span className="text-[10px] mt-1 font-medium">分析</span>
          </button>
          <button onClick={() => setActiveTab('detail')} className={`flex flex-col items-center w-16 ${activeTab === 'detail' ? 'text-blue-600' : 'text-gray-400'}`}>
            <List size={24} strokeWidth={activeTab === 'detail' ? 2.5 : 2} />
            <span className="text-[10px] mt-1 font-medium">明細</span>
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center w-16 ${activeTab === 'history' ? 'text-blue-600' : 'text-gray-400'}`}>
            <History size={24} strokeWidth={activeTab === 'history' ? 2.5 : 2} />
            <span className="text-[10px] mt-1 font-medium">紀錄</span>
          </button>
        </div>

      </div>
    </div>
  );
}