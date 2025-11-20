import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, PieChart, List, Save, Calendar, DollarSign, Users, TrendingUp, Briefcase, Wallet, Percent } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('input');

  // --- 1. 輸入資料狀態 ---
  const [inputs, setInputs] = useState({
    // 成本與收入
    estimatedUpfrontCost: 2000000, // 前期預估成本
    actualUpfrontCost: 2200000,    // 實際投入前期成本
    monthlyMisc: 5000,             // 預估每月雜支
    
    // 投資與分潤拆分
    fundInjectionRatio: 80,        // 資金方-投入比例 (%)
    manpowerInjectionRatio: 20,    // 人力方-投入比例 (%)
    
    fundProfitRatio: 30,           // 資金方-分潤比例 (%)
    manpowerProfitRatio: 70,       // 人力方-分潤比例 (%)

    // 合約
    contractMonths: 60,            // 合約總月數 (5年)
    phase1Months: 24,              // 前段合約月數 (2年)
    
    // 收支
    rentPhase1: 30000,             // 前段每月房東租金
    rentPhase2: 35000,             // 後段每月房東租金
    monthlyIncome: 80000,          // 每月房客租金收入
    
    // 時間
    startDate: '2025-12',          // 數值起始年月
  });

  // --- 2. 計算核心邏輯 ---
  const results = useMemo(() => {
    const start = new Date(inputs.startDate + '-01');
    const totalMonths = parseInt(inputs.contractMonths) || 0;
    const p1Months = parseInt(inputs.phase1Months) || 0;
    const actualCost = parseInt(inputs.actualUpfrontCost) || 0;
    
    // 比例設定
    const fundInjPct = (parseFloat(inputs.fundInjectionRatio) || 0) / 100;
    const manInjPct = (parseFloat(inputs.manpowerInjectionRatio) || 0) / 100;
    const fundProfPct = (parseFloat(inputs.fundProfitRatio) || 0) / 100;
    const manProfPct = (parseFloat(inputs.manpowerProfitRatio) || 0) / 100;

    const misc = parseInt(inputs.monthlyMisc) || 0;
    const rent1 = parseInt(inputs.rentPhase1) || 0;
    const rent2 = parseInt(inputs.rentPhase2) || 0;
    const baseIncome = parseInt(inputs.monthlyIncome) || 0;

    let cumulativeCashFlow = 0; // 累計現金流 (不含初期成本扣除)
    let breakEvenDate = null;
    let breakEvenMonthIndex = -1;
    let totalRevenue = 0;
    let totalExpenses = 0; // 現金支出 (租金+雜支)
    
    const monthlyData = [];

    for (let i = 0; i < totalMonths; i++) {
      // 計算當月日期
      const currentMonthDate = new Date(start);
      currentMonthDate.setMonth(start.getMonth() + i);
      const dateStr = `${currentMonthDate.getFullYear()}/${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`;

      // 判斷是前段還是後段租金 (成本)
      const currentRent = i < p1Months ? rent1 : rent2;

      // 計算當月收入 (邏輯：第一年後 * 0.95)
      let currentIncome = baseIncome;
      if (i >= 12) {
        currentIncome = Math.round(baseIncome * 0.95);
      }
      
      // 當月淨現金流 = 收入 - (租金 + 雜支)
      const netCashFlow = currentIncome - (currentRent + misc);
      
      cumulativeCashFlow += netCashFlow;
      totalRevenue += currentIncome;
      totalExpenses += (currentRent + misc);

      // 判斷回本 (累計現金流 >= 實際投入成本)
      if (breakEvenMonthIndex === -1 && cumulativeCashFlow >= actualCost) {
        breakEvenMonthIndex = i + 1;
        breakEvenDate = dateStr;
      }

      monthlyData.push({
        month: i + 1,
        date: dateStr,
        rent: currentRent,
        income: currentIncome,
        expense: currentRent + misc,
        netProfit: netCashFlow,
        cumulative: cumulativeCashFlow
      });
    }

    // --- 財務指標與平均值計算 ---
    const monthlyAmortization = totalMonths > 0 ? Math.round(actualCost / totalMonths) : 0;
    const avgMonthlyRent = totalMonths > 0 ? (totalExpenses - (misc * totalMonths)) / totalMonths : 0;
    const monthlyTotalCostWithAmort = Math.round(avgMonthlyRent + misc + monthlyAmortization);

    // 平均每月純收益
    const avgMonthlyRevenue = totalMonths > 0 ? totalRevenue / totalMonths : 0;
    const avgMonthlyNetIncome = Math.round(avgMonthlyRevenue - monthlyTotalCostWithAmort);

    // --- 利潤分配邏輯 ---
    // 基數：平均每月純收益 * 合約總數
    const totalEstimatedProfit = avgMonthlyNetIncome * totalMonths;

    // 分潤計算
    const investorProfitShare = totalEstimatedProfit * fundProfPct;
    const operatorProfitShare = totalEstimatedProfit * manProfPct;
    
    // 本金投入額
    const investorPrincipal = actualCost * fundInjPct;
    const operatorPrincipal = actualCost * manInjPct;

    // --- 年化報酬率計算 (Annualized ROI) ---
    // 公式：((總分潤 / 本金) / (總月數 / 12)) * 100
    const years = totalMonths / 12;
    
    const investorAnnualizedROI = (investorPrincipal > 0 && years > 0) 
      ? ((investorProfitShare / investorPrincipal) / years * 100).toFixed(1) 
      : "0.0";

    const operatorAnnualizedROI = (operatorPrincipal > 0 && years > 0)
      ? ((operatorProfitShare / operatorPrincipal) / years * 100).toFixed(1)
      : "0.0";

    // 專案總真實獲利 (供參考)
    const projectRealNetProfit = cumulativeCashFlow - actualCost;
    
    // 成本比
    const totalCostIncludingUpfront = totalExpenses + actualCost;
    const costRatio = totalRevenue > 0 ? (totalCostIncludingUpfront / totalRevenue * 100).toFixed(1) : 0;

    return {
      breakEvenDate: breakEvenDate || '未回本',
      breakEvenMonths: breakEvenMonthIndex === -1 ? '-' : breakEvenMonthIndex,
      
      investorPrincipal,
      investorProfitShare,
      investorAnnualizedROI, // 新增
      
      operatorPrincipal,
      operatorProfitShare,
      operatorAnnualizedROI, // 新增
      
      projectRealNetProfit, 

      monthlyAmortization,
      monthlyTotalCostWithAmort,
      avgMonthlyNetIncome,
      costRatio,
      monthlyData,
    };
  }, [inputs]);

  // --- 3. UI 元件 ---
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
          className="text-right font-semibold text-gray-900 outline-none bg-transparent w-32 placeholder-gray-300"
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

  const handleRatioChange = (keyA, keyB, value) => {
    const val = parseFloat(value);
    if (isNaN(val)) return;
    setInputs(prev => ({
      ...prev,
      [keyA]: val,
      [keyB]: 100 - val
    }));
  };

  return (
    <div className="bg-gray-100 min-h-screen font-sans flex justify-center">
      <div className="w-full max-w-md bg-gray-50 h-[100dvh] flex flex-col relative shadow-2xl overflow-hidden">
        
        {/* 頂部導航 */}
        <div className="bg-white px-5 pt-12 pb-4 shadow-sm z-10">
          <h1 className="text-2xl font-bold text-gray-900">租賃專案試算</h1>
          <p className="text-xs text-gray-500 mt-1">Project ROI Calculator</p>
        </div>

        {/* 內容捲動區 */}
        <div className="flex-1 overflow-y-auto p-4 pb-24">
          
          {/* TAB 1: 輸入設定 */}
          {activeTab === 'input' && (
            <div className="animate-fadeIn">
              <InputGroup label="起始與成本">
                <InputRow label="數值起始年月" type="month" value={inputs.startDate} onChange={v => setInputs({...inputs, startDate: v})} />
                <InputRow label="前期預估成本" value={inputs.estimatedUpfrontCost} onChange={v => setInputs({...inputs, estimatedUpfrontCost: v})} />
                <InputRow label="實際投入成本" value={inputs.actualUpfrontCost} onChange={v => setInputs({...inputs, actualUpfrontCost: v})} />
                <InputRow label="預估每月雜支" value={inputs.monthlyMisc} onChange={v => setInputs({...inputs, monthlyMisc: v})} />
              </InputGroup>

              <InputGroup label="資本投入比例 (誰出錢)">
                <InputRow 
                  label="資金方投入" 
                  value={inputs.fundInjectionRatio} 
                  onChange={(v) => handleRatioChange('fundInjectionRatio', 'manpowerInjectionRatio', v)} 
                  suffix="%" 
                />
                <InputRow 
                  label="人力方投入" 
                  value={inputs.manpowerInjectionRatio} 
                  onChange={(v) => handleRatioChange('manpowerInjectionRatio', 'fundInjectionRatio', v)} 
                  suffix="%" 
                />
              </InputGroup>

              <InputGroup label="獲利分配比例 (怎麼分)">
                <InputRow 
                  label="資金方分潤" 
                  value={inputs.fundProfitRatio} 
                  onChange={(v) => handleRatioChange('fundProfitRatio', 'manpowerProfitRatio', v)} 
                  suffix="%" 
                />
                <InputRow 
                  label="人力方分潤" 
                  value={inputs.manpowerProfitRatio} 
                  onChange={(v) => handleRatioChange('manpowerProfitRatio', 'fundProfitRatio', v)} 
                  suffix="%" 
                />
              </InputGroup>

              <InputGroup label="合約與租金">
                <InputRow label="合約總月數" value={inputs.contractMonths} onChange={v => setInputs({...inputs, contractMonths: v})} suffix="月" />
                <InputRow label="前半段月數" value={inputs.phase1Months} onChange={v => setInputs({...inputs, phase1Months: v})} suffix="月" />
                <div className="py-2 text-xs text-gray-400 text-center bg-gray-50 rounded my-1">租金支出設定</div>
                <InputRow label="前半段租金" value={inputs.rentPhase1} onChange={v => setInputs({...inputs, rentPhase1: v})} />
                <InputRow label="後半段租金" value={inputs.rentPhase2} onChange={v => setInputs({...inputs, rentPhase2: v})} />
              </InputGroup>

              <InputGroup label="收入預估">
                <InputRow label="每月房客租金" value={inputs.monthlyIncome} onChange={v => setInputs({...inputs, monthlyIncome: v})} />
                <div className="text-[10px] text-gray-400 text-right px-1 mt-1">
                  *註：第一年後租金自動 * 0.95 計算
                </div>
              </InputGroup>
            </div>
          )}

          {/* TAB 2: 報表結果 */}
          {activeTab === 'report' && (
            <div className="animate-fadeIn space-y-4">
              {/* 回本卡片 (修正顯示：大字月數，小字日期) */}
              <ResultCard 
                title="預估回本時間" 
                value={typeof results.breakEvenMonths === 'number' ? `${results.breakEvenMonths} 個月` : results.breakEvenMonths} 
                subValue={typeof results.breakEvenMonths === 'number' ? `預計於 ${results.breakEvenDate} 回本` : '尚未在合約期內回本'}
                icon={Calendar}
                colorClass={typeof results.breakEvenMonths === 'number' ? "bg-indigo-600" : "bg-red-500"}
              />

              {/* 專案總損益摘要 */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
                <div className="text-xs text-gray-400 mb-1">合約期滿總淨利 (扣除本金後)</div>
                <div className={`text-2xl font-bold ${results.projectRealNetProfit > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatMoney(results.projectRealNetProfit)}
                </div>
                <div className="text-[10px] text-gray-400 mt-1">總營收 - 總支出 - 初始成本</div>
              </div>

              {/* 資金方卡片 (新增年化報酬，移除總回收) */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-gray-900 font-bold">
                        <Wallet className="text-green-600" size={20} />
                        資金方
                    </div>
                    <div className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full">
                        出資 {inputs.fundInjectionRatio}% / 分潤 {inputs.fundProfitRatio}%
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">收回本金</div>
                    <div className="text-lg font-semibold text-gray-800">{formatMoney(results.investorPrincipal)}</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-xs text-green-700 mb-1">超額分潤</div>
                    <div className={`text-lg font-bold ${results.investorProfitShare > 0 ? 'text-green-700' : 'text-red-500'}`}>
                        {results.investorProfitShare > 0 ? '+' : ''}{formatMoney(results.investorProfitShare)}
                    </div>
                  </div>
                </div>
                {/* 年化報酬率標籤 */}
                <div className="mt-4 flex justify-end items-center border-t border-gray-100 pt-3">
                    <div className="flex items-center gap-2">
                        <Percent size={14} className="text-gray-400"/>
                        <span className="text-xs text-gray-500">年化報酬率 (ROI):</span>
                        <span className="text-lg font-bold text-green-600">{results.investorAnnualizedROI}%</span>
                    </div>
                </div>
              </div>

              {/* 人力方卡片 (新增年化報酬，移除總回收) */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-gray-900 font-bold">
                        <Briefcase className="text-orange-600" size={20} />
                        人力方
                    </div>
                    <div className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded-full">
                        出資 {inputs.manpowerInjectionRatio}% / 分潤 {inputs.manpowerProfitRatio}%
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">收回本金</div>
                    <div className="text-lg font-semibold text-gray-800">{formatMoney(results.operatorPrincipal)}</div>
                  </div>
                  <div className="bg-orange-50 p-3 rounded-lg">
                    <div className="text-xs text-orange-700 mb-1">超額分潤</div>
                    <div className={`text-lg font-bold ${results.operatorProfitShare > 0 ? 'text-orange-700' : 'text-red-500'}`}>
                        {results.operatorProfitShare > 0 ? '+' : ''}{formatMoney(results.operatorProfitShare)}
                    </div>
                  </div>
                </div>
                 {/* 年化報酬率標籤 */}
                 <div className="mt-4 flex justify-end items-center border-t border-gray-100 pt-3">
                    <div className="flex items-center gap-2">
                        <Percent size={14} className="text-gray-400"/>
                        <span className="text-xs text-gray-500">年化報酬率 (ROI):</span>
                        <span className="text-lg font-bold text-orange-600">{results.operatorAnnualizedROI}%</span>
                    </div>
                </div>
              </div>

              {/* 財務指標 */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <div className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <TrendingUp size={16} className="text-blue-500"/> 
                      成本分析指標
                  </div>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                    <div>
                        <div className="text-xs text-gray-400 mb-1">成本月攤提</div>
                        <div className="text-base font-bold text-gray-800">{formatMoney(results.monthlyAmortization)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-400 mb-1">總成本比率</div>
                        <div className="text-base font-bold text-gray-800">{results.costRatio}%</div>
                    </div>
                    
                    <div className="col-span-2 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 mt-1">
                        <div>
                            <div className="text-xs text-gray-400 mb-1">平均每月總成本</div>
                            <div className="text-base font-bold text-indigo-600">{formatMoney(results.monthlyTotalCostWithAmort)} / 月</div>
                            <div className="text-[10px] text-gray-400 mt-1">含攤提+租金+雜支</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-400 mb-1">平均每月純收益</div>
                            <div className={`text-base font-bold ${results.avgMonthlyNetIncome > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {formatMoney(results.avgMonthlyNetIncome)} / 月
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1">營收 - 總成本</div>
                        </div>
                    </div>
                  </div>
              </div>
            </div>
          )}

          {/* TAB 3: 月份明細 */}
          {activeTab === 'detail' && (
            <div className="animate-fadeIn bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-4 bg-gray-100 p-3 text-xs font-bold text-gray-500 border-b border-gray-200">
                <div>年月</div>
                <div className="text-right">收入</div>
                <div className="text-right">支出</div>
                <div className="text-right">淨利</div>
              </div>
              {results.monthlyData.map((row, idx) => (
                <div key={idx} className={`grid grid-cols-4 p-3 text-sm border-b border-gray-50 items-center ${row.cumulative >= inputs.actualUpfrontCost && results.monthlyData[idx-1]?.cumulative < inputs.actualUpfrontCost ? 'bg-yellow-50' : ''}`}>
                  <div className="text-gray-600 text-xs">
                    {row.date}
                    {row.cumulative >= inputs.actualUpfrontCost && results.monthlyData[idx-1]?.cumulative < inputs.actualUpfrontCost && <span className="block text-[10px] text-red-500 font-bold">★回本</span>}
                  </div>
                  <div className="text-right font-mono">{formatMoney(row.income)}</div>
                  <div className="text-right font-mono text-red-400">{formatMoney(row.expense)}</div>
                  <div className={`text-right font-mono font-medium ${row.netProfit > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {formatMoney(row.netProfit)}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* 底部 Tab Bar */}
        <div className="absolute bottom-0 w-full bg-white/90 backdrop-blur border-t border-gray-200 h-20 flex justify-around pt-2 pb-6 z-20">
          <button onClick={() => setActiveTab('input')} className={`flex flex-col items-center w-16 ${activeTab === 'input' ? 'text-blue-600' : 'text-gray-400'}`}>
            <Calculator size={24} />
            <span className="text-[10px] mt-1 font-medium">試算設定</span>
          </button>
          <button onClick={() => setActiveTab('report')} className={`flex flex-col items-center w-16 ${activeTab === 'report' ? 'text-blue-600' : 'text-gray-400'}`}>
            <PieChart size={24} />
            <span className="text-[10px] mt-1 font-medium">總表分析</span>
          </button>
          <button onClick={() => setActiveTab('detail')} className={`flex flex-col items-center w-16 ${activeTab === 'detail' ? 'text-blue-600' : 'text-gray-400'}`}>
            <List size={24} />
            <span className="text-[10px] mt-1 font-medium">現金流</span>
          </button>
        </div>

      </div>
    </div>
  );
}