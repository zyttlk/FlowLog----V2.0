import './index.css';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ChevronDown,
  Check,
  X,
  MinusCircle,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  Settings,
  Download,
  Upload,
  Database,
  MessageSquare,
  PieChart,
  Book,
  Zap,
  ListTodo,
  Feather,
  Flame,
  Quote,
  Trophy,
  Archive,
  RotateCcw,
  TrendingUp,
  Activity,
  Award,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Target,
  // [新增] 引入需要的图标
  HardDrive,
  CloudCheck,
  AlertTriangle
} from 'lucide-react';
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

// --- [核心功能新增] Node.js 文件系统集成 ---
// 使用 window.require 避免 Vite 尝试打包这些原生模块
const fs = window.require('fs');
const path = window.require('path');
const os = window.require('os');

// --- 智能路径选择逻辑 ---
const home = os.homedir();
// 定义可能的路径列表（优先级：OneDrive中文文档 > OneDrive英文Documents > 本地文档）
const possiblePaths = [
  path.join(home, 'OneDrive', '文档'),      // Win10/11 中文版 OneDrive 默认位置
  path.join(home, 'OneDrive', 'Documents'), // 英文版或某些配置下的 OneDrive
  path.join(home, 'Documents')              // 保底：本地普通文档文件夹
];

// 找到第一个真实存在的路径
let baseDir = possiblePaths.find(p => fs.existsSync(p)) || path.join(home, 'Documents');

// 定义最终存储路径
const DOCUMENTS_DIR = path.join(baseDir, 'FlowLog_Data');
const DATA_FILE_PATH = path.join(DOCUMENTS_DIR, 'data_backup.json');

console.log('当前数据存储路径:', DATA_FILE_PATH); // 方便你在控制台确认

// 启动时确保文件夹存在
if (!fs.existsSync(DOCUMENTS_DIR)) {
  try {
    fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
  } catch (err) {
    console.error('无法创建数据文件夹:', err);
  }
}

// --- Type Definitions ---
type TaskStatus = 'pending' | 'completed' | 'failed' | 'given_up';
type ViewMode = 'tasks' | 'habits' | 'calendar' | 'stats';

interface Task {
  id: string;
  dateStr: string; // YYYY-MM-DD
  text: string;
  status: TaskStatus;
  slogan?: string;
  sticker?: string;
  reflection?: string;
  createdAt: number;
}

interface Habit {
  id: string;
  name: string;
  icon: string; // emoji
  color: string;
  slogan: string; // Customizable slogan
  goal: number; // Target value per day (e.g. 15), 1 means boolean check-in
  unit: string; // Unit name (e.g. "minutes", "pages", "times")
  step: number; // Value per click (e.g. 5)
  archived?: boolean;
  createdAt: number;
}

interface HabitLog {
  id: string;
  habitId: string;
  dateStr: string; // YYYY-MM-DD
  value: number; // Value accumulated
}

// --- Data Constants ---
const SLOGANS = {
  completed: [
    "今天的你闪闪发光！", "积跬步，至千里。", "干得漂亮，奖励你一朵小红花。", "每一份努力都算数。", "星光不问赶路人。"
  ],
  failed: [
    "没关系，遗憾也是生活的一部分。", "允许自己休息，明天再战。", "拥抱不完美。", "裂痕是光照进来的地方。", "慢慢来，比较快。"
  ],
  given_up: [
    "放下也是一种智慧。", "与自己和解，精力留给更重要的事。", "听从内心的声音。", "学会拒绝，也是成长。", "退一步海阔天空。"
  ]
};

const STICKERS = {
  completed: ['🐱', '☕', '☀️', '⭐', '🌸', '🏆', '🌈'],
  failed: ['🍂', '🌧️', '💭', '🩹'],
  given_up: ['💨', '🍃', '🕊️']
};

// Expanded Emoji Categories
const EMOJI_CATEGORIES: Record<string, string[]> = {
  "运动": ["🏃", "🧘", "🏋️", "🚴", "🏊", "🧗", "🤸", "⛹️", "🥊", "⚽", "🏀", "🎾"],
  "健康": ["💧", "🥗", "🍎", "💊", "🛌", "🦷", "🛁", "🚭", "📵", "🥕", "🥑", "🍵"],
  "学习": ["📖", "✏️", "💻", "🎨", "🎸", "🎹", "📝", "🧠", "📚", "🎓", "🗣️", "💡"],
  "生活": ["🧹", "🧺", "🍳", "🪴", "🐕", "🐈", "💰", "📷", "🎧", "🎮", "🎬", "✈️"],
  "心情": ["😀", "🥰", "😎", "🤔", "😴", "😭", "🤯", "🥳", "✨", "❤️", "🔥", "💪"]
};

const HABIT_COLORS = ['#fbbf24', '#f87171', '#60a5fa', '#34d399', '#a78bfa', '#f472b6', '#fb923c', '#22d3ee'];

const QUOTES = [
  { text: "生活不是等待风暴过去，而是学会在雨中跳舞。", author: "Vivian Greene" },
  { text: "种一棵树最好的时间是十年前，其次是现在。", author: "Dambisa Moyo" },
  { text: "你必须做你觉得你做不到的事。", author: "Eleanor Roosevelt" },
  { text: "每一个不曾起舞的日子，都是对生命的辜负。", author: "Nietzsche" }
];

// --- Helper Functions ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getRandomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// --- Components ---

/**
 * [新增] 状态栏组件：显示数据保存状态
 */
const StatusBar = ({ status, message }: { status: 'success' | 'error' | 'idle', message: string }) => {
  if (status === 'idle') return null;
  return (
    <div className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-bold z-[100] animate-in slide-in-from-bottom-2 ${status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {status === 'success' ? <CloudCheck size={16} /> : <AlertTriangle size={16} />}
      <span>{message}</span>
    </div>
  );
};

/**
 * Statistics View Component
 */
const StatisticsView = ({ tasks, habits, habitLogs }: { tasks: Task[], habits: Habit[], habitLogs: HabitLog[] }) => {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const failedTasks = tasks.filter(t => t.status === 'failed').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Calculate Habit Check-in counts (Top 5)
  const habitData = habits.map(h => {
    const activeDays = new Set(habitLogs.filter(log => log.habitId === h.id).map(l => l.dateStr)).size;
    return { name: h.name, count: activeDays, color: h.color, icon: h.icon };
  }).sort((a, b) => b.count - a.count).slice(0, 5);

  // Task Data for Pie
  const taskData = [
    { name: '完成', value: completedTasks, color: '#4ade80' },
    { name: '未完', value: failedTasks, color: '#fb923c' },
    { name: '放弃', value: tasks.filter(t => t.status === 'given_up').length, color: '#94a3b8' },
    { name: '进行中', value: tasks.filter(t => t.status === 'pending').length, color: '#e2e8f0' },
  ].filter(d => d.value > 0);

  return (
    <div className="flex-1 overflow-y-auto p-8 lg:p-12 animate-in fade-in duration-500 bg-[#FBF9F6]">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
          <PieChart className="text-orange-400" />
          数据概览
        </h2>
        <p className="text-gray-400 mb-10">回顾你的心流旅程</p>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
             <div className="absolute right-0 top-0 w-32 h-32 bg-blue-50 rounded-full translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform"></div>
             <div>
                 <p className="text-gray-400 text-sm font-medium mb-1">总任务数</p>
                 <h3 className="text-4xl font-bold text-slate-700">{totalTasks}</h3>
             </div>
             <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center relative z-10">
                 <ListTodo size={24} />
             </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
             <div className="absolute right-0 top-0 w-32 h-32 bg-green-50 rounded-full translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform"></div>
             <div>
                 <p className="text-gray-400 text-sm font-medium mb-1">平均完成率</p>
                 <h3 className="text-4xl font-bold text-slate-700">{completionRate}<span className="text-xl text-gray-400 ml-1">%</span></h3>
             </div>
             <div className="w-12 h-12 rounded-full bg-green-100 text-green-500 flex items-center justify-center relative z-10">
                 <Activity size={24} />
             </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
             <div className="absolute right-0 top-0 w-32 h-32 bg-orange-50 rounded-full translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform"></div>
             <div>
                 <p className="text-gray-400 text-sm font-medium mb-1">习惯坚持天数</p>
                 <h3 className="text-4xl font-bold text-slate-700">{habitData.reduce((acc, curr) => acc + curr.count, 0)}</h3>
             </div>
             <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center relative z-10">
                 <Flame size={24} />
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Task Status */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[420px]">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-700 flex items-center gap-2">
                    <TrendingUp size={20} className="text-gray-400"/> 任务状态分布
                </h3>
            </div>
            <div className="w-full h-[300px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={taskData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={6}
                    dataKey="value"
                    cornerRadius={6}
                  >
                    {taskData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    itemStyle={{ color: '#555', fontWeight: 'bold' }}
                  />
                </RePieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                      <span className="text-3xl font-bold text-gray-700">{totalTasks}</span>
                      <p className="text-xs text-gray-400">Total Tasks</p>
                  </div>
              </div>
            </div>
          </div>

          {/* Habit Ranking */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[420px]">
               <h3 className="text-xl font-bold text-gray-700 mb-6 flex items-center gap-2">
                  <Award size={20} className="text-gray-400"/> 习惯荣耀榜
               </h3>
               {habitData.length > 0 ? (
                  <div className="flex-1 flex flex-col justify-center space-y-4 overflow-y-auto pr-2">
                      {habitData.map((habit, idx) => (
                          <div key={habit.name} className="flex items-center gap-4">
                              <div className="w-8 text-center font-bold text-gray-300 text-lg">#{idx + 1}</div>
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-gray-50 shrink-0">
                                  {habit.icon}
                              </div>
                              <div className="flex-1">
                                  <div className="flex justify-between text-sm mb-1">
                                      <span className="font-bold text-gray-700">{habit.name}</span>
                                      <span className="text-gray-400 font-mono">{habit.count} 天</span>
                                  </div>
                                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full rounded-full" 
                                        style={{ width: `${Math.min(100, (habit.count / 30) * 100)}%`, backgroundColor: habit.color }}
                                      ></div>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
               ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-300 flex-col gap-2">
                     <Archive size={48} className="opacity-20"/>
                     <p>暂无打卡记录</p>
                  </div>
               )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Database Manager Component (Updated)
 */
const DatabaseManager = ({
  isOpen,
  onClose,
  data,
  onImport
}: {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  onImport: (data: any) => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flowlog_backup_${formatDate(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (importedData && typeof importedData === 'object') {
          onImport(importedData);
          alert("数据恢复成功！");
          onClose();
        } else {
          alert("文件格式不正确");
        }
      } catch (err) {
        alert("无法解析文件，请确保是正确的备份文件");
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm relative overflow-hidden">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-gray-700 mb-2 flex items-center gap-2">
          <Database size={20} className="text-orange-400" />
          数据管家
        </h2>
        
        {/* [新增] 显示本地同步路径 */}
        <div className="mb-4 bg-orange-50 p-3 rounded-lg text-xs text-orange-600 border border-orange-100">
           <p className="font-bold mb-1 flex items-center gap-1"><HardDrive size={12}/> 自动同步位置：</p>
           <p className="break-all font-mono opacity-80">{DATA_FILE_PATH}</p>
           <p className="mt-2 text-orange-400">开启 OneDrive/iCloud 可实现云备份</p>
        </div>

        <div className="space-y-4">
          <button 
            onClick={handleExport}
            className="w-full py-3 rounded-xl border border-gray-200 flex items-center justify-center gap-2 text-gray-700 hover:bg-gray-50 hover:border-orange-300 transition-all"
          >
            <Download size={18} />
            <span>手动导出 (.json)</span>
          </button>

          <button 
            onClick={handleImportClick}
            className="w-full py-3 rounded-xl border border-gray-200 flex items-center justify-center gap-2 text-gray-700 hover:bg-gray-50 hover:border-green-300 transition-all"
          >
            <Upload size={18} />
            <span>手动恢复</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".json" 
            className="hidden" 
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Time Travel Navigation
 */
const TimeTraveler = ({
  currentDate,
  onDateChange
}: {
  currentDate: Date;
  onDateChange: (d: Date) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const years = Array.from({ length: 80 }, (_, i) => 2020 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const handleYearSelect = (y: number) => {
    const newDate = new Date(currentDate.getTime());
    newDate.setFullYear(y);
    onDateChange(newDate);
  };

  const handleMonthSelect = (m: number) => {
    const newDate = new Date(currentDate.getTime());
    newDate.setDate(1);
    newDate.setMonth(m - 1);
    const y = newDate.getFullYear();
    const originalDay = currentDate.getDate();
    const daysInNewMonth = new Date(y, m, 0).getDate();
    newDate.setDate(Math.min(originalDay, daysInNewMonth));
    onDateChange(newDate);
  };

  return (
    <div className="relative z-50 mb-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`px-4 py-3 rounded-2xl flex items-center gap-3 text-gray-700 font-bold text-lg transition-all duration-200 bg-white border border-transparent shadow-sm hover:shadow-md hover:border-orange-100 group w-full justify-between ${isOpen ? 'text-orange-500 ring-2 ring-orange-100' : ''}`}
        >
          <span>{currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月</span>
          <ChevronDown size={20} className={`transition-transform duration-300 group-hover:text-orange-500 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-16 left-0 w-full z-[60] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="rounded-2xl shadow-xl p-4 grid grid-cols-2 gap-4 bg-white border border-gray-100">
            <div className="h-48 overflow-y-auto snap-y scroll-smooth no-scrollbar border-r border-gray-100">
              {years.map(year => (
                <div
                  key={year}
                  onClick={() => handleYearSelect(year)}
                  className={`snap-center py-2 text-center cursor-pointer transition-all hover:bg-gray-50 rounded-lg ${year === currentDate.getFullYear() ? 'text-xl font-bold text-orange-400 scale-110' : 'text-gray-400'}`}
                >
                  {year}
                </div>
              ))}
            </div>
            <div className="h-48 overflow-y-auto snap-y scroll-smooth no-scrollbar">
              {months.map(m => (
                <div
                  key={m}
                  onClick={() => handleMonthSelect(m)}
                  className={`snap-center py-2 text-center cursor-pointer transition-all hover:bg-gray-50 rounded-lg ${m === currentDate.getMonth() + 1 ? 'text-xl font-bold text-orange-400 scale-110' : 'text-gray-400'}`}
                >
                  {m}月
                </div>
              ))}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="col-span-2 mt-2 py-2 text-sm text-gray-400 hover:text-gray-600 border-t border-gray-100"
            >
              收起时光机
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Visual Trace Calendar (Mini Sidebar)
 */
const TraceCalendar = ({
  currentDate,
  tasks,
  selectedDate,
  onSelectDate
}: {
  currentDate: Date;
  tasks: Task[];
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
}) => {
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const firstDayOfWeek = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const prefixDays = Array.from({ length: firstDayOfWeek });

  const getTraceForDay = (day: number) => {
    const dateToCheck = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = formatDate(dateToCheck);
    const dayTasks = tasks.filter(t => t.dateStr === dateStr);

    if (dayTasks.length === 0) return null;
    const completed = dayTasks.filter(t => t.status === 'completed');
    const failed = dayTasks.filter(t => t.status === 'failed');
    const givenUp = dayTasks.filter(t => t.status === 'given_up');

    if (completed.length > 0) return <span className="text-xl animate-bounce">{completed[0].sticker || '🐱'}</span>;
    if (failed.length === dayTasks.length) return <span className="text-xl">🌧️</span>;
    if (givenUp.length === dayTasks.length) return <span className="text-xl opacity-50">💨</span>;

    return (
      <svg viewBox="0 0 100 100" className="w-8 h-8 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <path d="M 50, 50 m -40, 0 a 40,40 0 1,0 80,0 a 40,40 0 1,0 -80,0" className="pencil-trace" style={{ strokeDashoffset: '20' }} />
      </svg>
    );
  };

  return (
    <div className="mb-6">
      <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-400 mb-2">
          {['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {prefixDays.map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square"></div>
          ))}
          {days.map(day => {
            const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === currentDate.getMonth() && selectedDate.getFullYear() === currentDate.getFullYear();
            return (
              <div
                key={day}
                onClick={() => {
                  const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                  onSelectDate(newDate);
                }}
                className={`relative aspect-square flex items-center justify-center rounded-xl cursor-pointer transition-all duration-200 ${isSelected ? 'bg-orange-100 text-orange-600 font-bold shadow-inner scale-95 ring-2 ring-orange-200' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <span className="relative z-10 text-sm">{day}</span>
                {getTraceForDay(day)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/**
 * Task Card Component
 */
interface TaskCardProps {
  task: Task;
  onUpdateStatus: (id: string, status: TaskStatus) => void;
  onUpdateReflection: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onUpdateStatus,
  onUpdateReflection,
  onDelete
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showReflection, setShowReflection] = useState(false);

  useEffect(() => {
    if (task.reflection && !showReflection) {
        setShowReflection(true);
    }
  }, []);

  const handleDeleteClick = () => setShowConfirm(true);
  const confirmDelete = () => {
    setShowConfirm(false);
    setIsDeleting(true);
    setTimeout(() => onDelete(task.id), 800);
  };

  const toggleReflection = () => setShowReflection(!showReflection);

  if (isDeleting) {
    return (
      <div className="w-full h-32 mb-4 flex items-center justify-center erasing text-gray-400">
        <span className="font-handwriting text-lg">正在擦除记忆...</span>
      </div>
    );
  }

  const getStatusColor = (s: TaskStatus) => {
    switch (s) {
      case 'completed': return 'text-green-600 bg-green-50/50 border-green-200';
      case 'failed': return 'text-orange-600 bg-orange-50/50 border-orange-200';
      case 'given_up': return 'text-slate-500 bg-slate-100/50 border-slate-200';
      default: return 'text-gray-700 bg-white border-slate-100';
    }
  };

  return (
    <div className="mb-6 relative group animate-in slide-in-from-bottom-2 duration-300">
      <div className={`rounded-2xl shadow-sm p-6 transition-all duration-300 border ${task.status !== 'pending' ? getStatusColor(task.status) : 'hover:shadow-md'}`}>
        
        {/* Header: Text & Actions */}
        <div className="flex justify-between items-start mb-4">
          <p className={`text-xl font-medium tracking-wide ${task.status === 'given_up' ? 'line-through opacity-60' : ''}`}>
            {task.text}
          </p>
          <div className="flex gap-2">
            <button
               onClick={toggleReflection}
               className={`p-2 transition-colors rounded-full hover:bg-black/5 ${showReflection || task.reflection ? 'text-orange-400' : 'text-gray-300 hover:text-gray-500'}`}
               title="写感想"
            >
               <MessageSquare size={18} />
            </button>
            <button
              onClick={handleDeleteClick}
              className="text-gray-300 hover:text-red-400 transition-colors p-2 rounded-full hover:bg-black/5"
              title="删除任务"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-between mt-2">
           <button 
             onClick={() => onUpdateStatus(task.id, 'completed')}
             className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 border
               ${task.status === 'completed' ? 'bg-green-100 border-green-200 text-green-600 font-bold shadow-inner' : 'bg-white border-gray-100 text-gray-400 hover:text-green-500 hover:border-green-200'}
             `}
           >
             <Check size={18} />
             <span className="text-sm">完成</span>
           </button>

           <button 
             onClick={() => onUpdateStatus(task.id, 'failed')}
             className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 border
               ${task.status === 'failed' ? 'bg-orange-100 border-orange-200 text-orange-500 font-bold shadow-inner' : 'bg-white border-gray-100 text-gray-400 hover:text-orange-500 hover:border-orange-200'}
             `}
           >
             <X size={18} />
             <span className="text-sm">未完</span>
           </button>

           <button 
             onClick={() => onUpdateStatus(task.id, 'given_up')}
             className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 border
               ${task.status === 'given_up' ? 'bg-slate-100 border-slate-200 text-slate-500 font-bold shadow-inner' : 'bg-white border-gray-100 text-gray-400 hover:text-slate-500 hover:border-slate-200'}
             `}
           >
             <MinusCircle size={18} />
             <span className="text-sm">放弃</span>
           </button>
        </div>

        {/* Emotional Slogan Feedback */}
        {task.slogan && (
          <div className="mt-5 pt-4 border-t border-black/5 fade-in-up text-center relative">
            <p className="font-handwriting text-2xl leading-relaxed opacity-80 text-gray-600">
              {task.slogan}
            </p>
            {task.sticker && task.status === 'completed' && (
              <div className="absolute -top-6 -right-2 text-5xl animate-bounce filter drop-shadow-lg transform rotate-12">
                {task.sticker}
              </div>
            )}
            {(task.status === 'failed') && (
              <div className="absolute -top-6 -right-2 text-5xl opacity-80 filter drop-shadow-md">
                🍂
              </div>
            )}
          </div>
        )}

        {/* Reflection Area - Sticky Note Style */}
        {showReflection && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
             <div className="relative bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl p-4 shadow-sm">
                <textarea
                  value={task.reflection || ''}
                  onChange={(e) => onUpdateReflection(task.id, e.target.value)}
                  placeholder="记录下这一刻的想法，未来的你会感谢现在..."
                  className="w-full bg-transparent text-lg text-gray-700 placeholder-gray-400 focus:outline-none font-handwriting resize-none leading-relaxed"
                  rows={3}
                  autoFocus
                />
            </div>
          </div>
        )}
      </div>

      {showConfirm && (
        <div className="absolute inset-0 bg-white/95 z-20 rounded-2xl flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm shadow-xl border border-gray-100">
          <p className="text-gray-600 mb-6 font-handwriting text-xl">确定要擦掉这个痕迹吗？<br/><span className="text-sm font-sans text-gray-400 mt-2 block">删除后无法找回</span></p>
          <div className="flex gap-4">
            <button
              onClick={() => setShowConfirm(false)}
              className="px-6 py-2 bg-white border border-gray-200 rounded-full shadow-sm text-gray-600 hover:bg-gray-50"
            >
              保留
            </button>
            <button
              onClick={confirmDelete}
              className="px-6 py-2 bg-red-50 text-red-500 rounded-full shadow-sm hover:bg-red-100 border border-red-100"
            >
              擦除
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Habit Tracker View (Flattened & Cleaned)
 */
const HabitTracker = ({
  habits,
  habitLogs,
  selectedDate,
  onAddHabit,
  onLogHabit,
  onUpdateHabitSlogan,
  onDeleteHabit,
  onArchiveHabit,
  onUnarchiveHabit,
  onResetHabitLogs
}: {
  habits: Habit[];
  habitLogs: HabitLog[];
  selectedDate: Date;
  onAddHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'archived'>) => void;
  onLogHabit: (habitId: string, step: number) => void;
  onUpdateHabitSlogan: (id: string, slogan: string) => void;
  onDeleteHabit: (id: string) => void;
  onArchiveHabit: (id: string) => void;
  onUnarchiveHabit: (id: string) => void;
  onResetHabitLogs: (habitId: string, dateStr: string) => void;
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const dateStr = formatDate(selectedDate);
  const [showArchived, setShowArchived] = useState(false);
  
  // New Habit Form State
  const [newName, setNewName] = useState("");
  const [newSlogan, setNewSlogan] = useState("坚持就是胜利");
  const [newIcon, setNewIcon] = useState("💧");
  const [newColor, setNewColor] = useState(HABIT_COLORS[2]);
  const [newGoal, setNewGoal] = useState<number>(1);
  const [newUnit, setNewUnit] = useState("次");
  const [newStep, setNewStep] = useState<number>(1);
  
  // Icon Picker State
  const [activeCategory, setActiveCategory] = useState("运动");
  const [customIcon, setCustomIcon] = useState("");

  // Editing Slogan State
  const [editingSloganId, setEditingSloganId] = useState<string | null>(null);
  const [tempSlogan, setTempSlogan] = useState("");

  // Delete/Reset Confirmation
  const [habitToDelete, setHabitToDelete] = useState<string | null>(null);
  const [habitToReset, setHabitToReset] = useState<string | null>(null);

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAddHabit({
      name: newName,
      slogan: newSlogan || "坚持就是胜利",
      icon: customIcon || newIcon,
      color: newColor,
      goal: newGoal,
      unit: newUnit,
      step: newStep
    });
    // Reset form
    setNewName("");
    setNewSlogan("坚持就是胜利");
    setNewColor(HABIT_COLORS[2]);
    setIsAdding(false);
  };

  const handleStartEditSlogan = (h: Habit) => {
    setEditingSloganId(h.id);
    setTempSlogan(h.slogan);
  };

  const handleSaveSlogan = (id: string) => {
    onUpdateHabitSlogan(id, tempSlogan);
    setEditingSloganId(null);
  };

  const displayedHabits = habits.filter(h => showArchived ? h.archived : !h.archived);

  return (
    <div className="flex-1 overflow-y-auto p-10 pb-32 relative">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">习惯打卡</h2>
          <p className="text-gray-400 font-handwriting">
             {dateStr} · 每天进步一点点
          </p>
        </div>
        <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-100">
           <button
             onClick={() => setShowArchived(false)}
             className={`px-4 py-2 rounded-lg text-sm transition-all ${!showArchived ? 'bg-orange-50 text-orange-500 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
           >
             进行中
           </button>
           <button
             onClick={() => setShowArchived(true)}
             className={`px-4 py-2 rounded-lg text-sm transition-all ${showArchived ? 'bg-orange-50 text-orange-500 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
           >
             已归档
           </button>
        </div>
      </header>

      {/* Habit Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedHabits.map(habit => {
          // Calculate progress
          const logs = habitLogs.filter(log => log.habitId === habit.id && log.dateStr === dateStr);
          const currentVal = logs.reduce((acc, curr) => acc + curr.value, 0);
          const isCompleted = currentVal >= habit.goal;
          const progressPercent = Math.min(100, Math.round((currentVal / habit.goal) * 100));
          const isSimpleHabit = habit.goal === 1;

          return (
            <div 
              key={habit.id}
              className={`bg-white rounded-2xl p-6 relative transition-all duration-300 group border border-slate-100 hover:border-orange-100 shadow-sm hover:shadow-lg ${isCompleted ? 'bg-opacity-90' : ''}`}
            >
               {/* Background tint for color accent */}
               <div className="absolute top-0 left-0 w-1.5 h-full rounded-l-2xl opacity-80" style={{ backgroundColor: habit.color }} />

               {/* Action Buttons */}
               <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                 {habit.archived ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onUnarchiveHabit(habit.id); }}
                      className="p-1.5 text-gray-300 hover:text-blue-500 rounded-md hover:bg-blue-50 transition-colors"
                      title="恢复习惯"
                    >
                      <RotateCcw size={16} />
                    </button>
                 ) : (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onArchiveHabit(habit.id); }}
                      className="p-1.5 text-gray-300 hover:text-slate-500 rounded-md hover:bg-slate-50 transition-colors"
                      title="归档习惯"
                    >
                      <Archive size={16} />
                    </button>
                 )}
                 <button 
                    onClick={(e) => { e.stopPropagation(); setHabitToDelete(habit.id); }}
                    className="p-1.5 text-gray-300 hover:text-red-400 rounded-md hover:bg-red-50 transition-colors"
                    title="彻底删除"
                 >
                    <Trash2 size={16} />
                 </button>
               </div>

               <div className="flex items-center gap-4 mb-5 pl-3">
                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-sm ${isCompleted ? 'bg-white' : 'bg-gray-50 border border-gray-100'}`}>
                    {habit.icon}
                 </div>
                 <div className="flex-1 min-w-0">
                   <h3 className="font-bold text-gray-800 text-lg truncate">{habit.name}</h3>
                   {/* Editable Slogan */}
                   {editingSloganId === habit.id ? (
                      <div className="flex items-center gap-1 mt-1">
                          <input 
                            type="text" 
                            value={tempSlogan}
                            onChange={(e) => setTempSlogan(e.target.value)}
                            className="text-xs bg-gray-50 border border-gray-200 rounded px-1 py-0.5 w-full outline-none"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveSlogan(habit.id)}
                            onBlur={() => handleSaveSlogan(habit.id)}
                          />
                      </div>
                   ) : (
                      <div 
                        className="text-xs text-gray-400 truncate cursor-pointer hover:text-orange-400 flex items-center gap-1 group/slogan mt-0.5"
                        onClick={() => handleStartEditSlogan(habit)}
                        title="点击修改标语"
                      >
                         <span>{habit.slogan}</span>
                      </div>
                   )}
                 </div>
               </div>
               
               {/* Progress UI (Unified for all habits) */}
               <div className="mb-5 pl-3">
                   <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                       <span className="font-medium">进度: {currentVal} / {habit.goal} {habit.unit}</span>
                       <span>{progressPercent}%</span>
                   </div>
                   <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                       <div 
                         className="h-full rounded-full transition-all duration-500 ease-out shadow-sm"
                         style={{ width: `${progressPercent}%`, backgroundColor: habit.color }}
                       ></div>
                   </div>
               </div>

               {!habit.archived && (
                 <div className="pl-3">
                    <button
                        onClick={() => {
                            if (isCompleted) {
                                setHabitToReset(habit.id);
                            } else {
                                onLogHabit(habit.id, habit.step);
                            }
                        }}
                        className={`w-full relative overflow-hidden transition-all duration-300 rounded-xl group/btn py-2.5 ${
                            isCompleted 
                            ? 'bg-gradient-to-r shadow-md text-white border-transparent'
                            : 'bg-white border-2 border-dashed border-gray-200 hover:border-solid hover:border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                        style={isCompleted ? { 
                            backgroundImage: `linear-gradient(135deg, ${habit.color}, ${habit.color}dd)` 
                        } : {}}
                    >
                        <div className="flex items-center justify-center gap-2 relative z-10">
                            {isCompleted ? (
                                <>
                                    <Check size={20} className="animate-in zoom-in spin-in-12 duration-300" strokeWidth={3} />
                                    <span className="font-bold">已完成</span>
                                </>
                            ) : (
                                <>
                                   {isSimpleHabit ? (
                                     <div className="w-5 h-5 rounded-full border-2 border-gray-300 group-hover/btn:border-gray-400"></div>
                                   ) : (
                                     <Plus size={18} />
                                   )}
                                   <span className="font-medium text-sm">
                                      {isSimpleHabit ? '打卡' : `打卡 (+${habit.step})`}
                                   </span>
                                </>
                            )}
                        </div>
                    </button>
                 </div>
               )}
            </div>
          );
        })}

        {/* Add Habit Button */}
        {!showArchived && (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-6 flex flex-col items-center justify-center gap-2 text-gray-300 hover:text-orange-400 hover:border-orange-300 hover:bg-orange-50/10 transition-all min-h-[180px] group"
          >
             <div className="w-12 h-12 rounded-full bg-gray-50 group-hover:bg-orange-100 flex items-center justify-center transition-colors">
                <Plus size={24} className="text-gray-400 group-hover:text-orange-500"/>
             </div>
             <span className="font-bold group-hover:text-orange-500 transition-colors">新建习惯</span>
          </button>
        )}
      </div>

      {/* Add Habit Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
           <div className="bg-white w-full max-w-2xl animate-in zoom-in-95 duration-200 h-[85vh] flex flex-col overflow-hidden rounded-3xl shadow-2xl">
              {/* Header */}
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
                 <h3 className="text-xl font-bold text-gray-700">开启新习惯</h3>
                 <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#FBF9F6]">
                  
                  {/* Preview Card Section */}
                  <div className="flex flex-col items-center justify-center">
                      <span className="text-xs font-bold text-gray-400 mb-3 tracking-widest uppercase">卡片预览</span>
                      <div className="bg-white rounded-2xl p-6 w-full max-w-sm relative shadow-sm border border-slate-100">
                          <div className="absolute top-0 left-0 w-1.5 h-full rounded-l-2xl opacity-80" style={{ backgroundColor: newColor }}></div>
                          <div className="flex items-center gap-4 mb-4 pl-3">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl bg-gray-50 border border-gray-100">
                                {customIcon || newIcon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-gray-800 text-lg truncate">{newName || "习惯名称"}</h3>
                                <div className="text-xs text-gray-400 truncate mt-0.5">{newSlogan || "激励标语"}</div>
                            </div>
                          </div>
                          <div className="pl-3">
                              <div className="w-full py-3 rounded-xl flex items-center justify-center gap-2 bg-white border-2 border-dashed border-gray-200 text-gray-400">
                                  <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                                  <span className="font-medium">打卡</span>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Section 1: Basic Info */}
                  <div className="space-y-4">
                     <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2"><Feather size={16} className="text-orange-400"/> 基础信息</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs text-gray-500 ml-1">习惯名称</label>
                            <input 
                              type="text" 
                              value={newName}
                              onChange={e => setNewName(e.target.value)}
                              className="w-full bg-white border border-gray-200 px-4 py-3 rounded-xl outline-none focus:ring-2 ring-orange-100 focus:border-orange-300 transition-all"
                              placeholder="例如：阅读"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-gray-500 ml-1">激励标语</label>
                            <input 
                              type="text" 
                              value={newSlogan}
                              onChange={e => setNewSlogan(e.target.value)}
                              className="w-full bg-white border border-gray-200 px-4 py-3 rounded-xl outline-none focus:ring-2 ring-orange-100 focus:border-orange-300 transition-all"
                              placeholder="一句话激励自己"
                            />
                        </div>
                     </div>
                  </div>

                  {/* Section 2: Goals */}
                  <div className="space-y-4">
                      <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2"><Trophy size={16} className="text-orange-400"/> 目标设定</h4>
                      <div className="bg-white p-4 rounded-2xl border border-gray-200 grid grid-cols-3 gap-4">
                          <div className="space-y-1">
                             <label className="text-xs text-gray-400 block text-center">单次打卡量</label>
                             <input type="number" min="1" value={newStep} onChange={e => setNewStep(parseInt(e.target.value)||1)} className="w-full bg-gray-50 p-2 rounded-lg text-center font-bold text-gray-700 outline-none focus:bg-white focus:ring-1 ring-orange-200" />
                          </div>
                          <div className="space-y-1">
                             <label className="text-xs text-gray-400 block text-center">单位</label>
                             <input type="text" value={newUnit} onChange={e => setNewUnit(e.target.value)} className="w-full bg-gray-50 p-2 rounded-lg text-center text-gray-700 outline-none focus:bg-white focus:ring-1 ring-orange-200" placeholder="次"/>
                          </div>
                          <div className="space-y-1">
                             <label className="text-xs text-gray-400 block text-center">每日目标</label>
                             <input type="number" min="1" value={newGoal} onChange={e => setNewGoal(parseInt(e.target.value)||1)} className="w-full bg-gray-50 p-2 rounded-lg text-center font-bold text-gray-700 outline-none focus:bg-white focus:ring-1 ring-orange-200" />
                          </div>
                      </div>
                      <div className="text-xs text-gray-400 px-2 flex gap-1">
                         <div className="text-orange-400">*</div>
                         如果只是简单的“完成/未完成”，将目标设为 1 即可。
                      </div>
                  </div>

                  {/* Section 3: Visuals */}
                  <div className="space-y-4">
                     <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2"><Zap size={16} className="text-orange-400"/> 视觉风格</h4>
                     
                     {/* Color Picker */}
                     <div className="flex gap-3 flex-wrap justify-center p-2">
                        {HABIT_COLORS.map(color => (
                          <button 
                            key={color}
                            onClick={() => setNewColor(color)}
                            className={`w-8 h-8 rounded-full transition-all shadow-sm ${newColor === color ? 'ring-2 ring-offset-2 ring-gray-300 scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                     </div>

                     {/* Icon Picker */}
                     <div className="bg-white p-4 rounded-2xl border border-gray-200">
                        <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar pb-1">
                            {Object.keys(EMOJI_CATEGORIES).map(cat => (
                                <button 
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-orange-100 text-orange-600 font-bold' : 'text-gray-400 hover:bg-gray-50'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-8 gap-2 max-h-32 overflow-y-auto no-scrollbar">
                            {EMOJI_CATEGORIES[activeCategory].map(icon => (
                            <button 
                                key={icon}
                                onClick={() => { setCustomIcon(""); setNewIcon(icon); }}
                                className={`aspect-square rounded-lg flex items-center justify-center text-xl hover:bg-gray-50 transition-colors ${newIcon === icon && !customIcon ? 'bg-orange-50 scale-110 ring-1 ring-orange-200' : 'opacity-80'}`}
                            >
                                {icon}
                            </button>
                            ))}
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
                            <span className="text-xs text-gray-400">自定义 Emoji:</span>
                            <input 
                            type="text" 
                            value={customIcon}
                            onChange={e => setCustomIcon(e.target.value)} 
                            placeholder="😀"
                            className="w-16 bg-gray-50 p-1.5 rounded-lg text-center focus:bg-white outline-none focus:ring-1 ring-orange-200 transition-colors"
                            />
                        </div>
                     </div>
                  </div>
              </div>

              <div className="p-6 border-t border-gray-100 bg-white flex gap-4 shrink-0">
                 <button onClick={() => setIsAdding(false)} className="flex-1 py-3 text-gray-500 hover:bg-gray-50 rounded-xl transition-colors font-medium border border-transparent hover:border-gray-200">取消</button>
                 <button onClick={handleAdd} className="flex-1 py-3 bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-xl shadow-lg hover:shadow-orange-200 hover:-translate-y-0.5 transition-all font-bold">
                    确认创建
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Delete Habit Confirmation Modal */}
      {habitToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-xl">
                 <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 size={32} />
                 </div>
                 <h3 className="text-xl font-bold text-gray-700 mb-2">删除这个习惯？</h3>
                 <p className="text-gray-500 mb-6 text-sm">删除后，该习惯的所有打卡记录也将被清空，且无法恢复。</p>
                 <div className="flex gap-4">
                    <button 
                      onClick={() => setHabitToDelete(null)}
                      className="flex-1 py-2.5 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100"
                    >
                      取消
                    </button>
                    <button 
                      onClick={() => { onDeleteHabit(habitToDelete); setHabitToDelete(null); }}
                      className="flex-1 py-2.5 rounded-xl bg-red-500 text-white shadow-lg hover:bg-red-600 transition-colors"
                    >
                      确认删除
                    </button>
                 </div>
            </div>
        </div>
      )}

      {/* Reset Habit Logs Confirmation Modal */}
      {habitToReset && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-xl">
                 <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <RotateCcw size={32} />
                 </div>
                 <h3 className="text-xl font-bold text-gray-700 mb-2">重置今日打卡？</h3>
                 <p className="text-gray-500 mb-6 text-sm">这将清除该习惯今天所有的打卡进度。</p>
                 <div className="flex gap-4">
                    <button 
                      onClick={() => setHabitToReset(null)}
                      className="flex-1 py-2.5 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100"
                    >
                      取消
                    </button>
                    <button 
                      onClick={() => { onResetHabitLogs(habitToReset, dateStr); setHabitToReset(null); }}
                      className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white shadow-lg hover:bg-orange-600 transition-colors"
                    >
                      确定重置
                    </button>
                 </div>
            </div>
        </div>
      )}
    </div>
  );
};

/**
 * Global Calendar View (Replaces Diary)
 */
const CalendarView = ({
  tasks,
  currentDate,
  onDateChange,
  onAddTask
}: {
  tasks: Task[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onAddTask: (dateStr: string, text: string) => void;
}) => {
  const [viewDate, setViewDate] = useState(currentDate);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskModalDate, setTaskModalDate] = useState("");
  const [newTaskText, setNewTaskText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync viewDate when currentDate changes from outside
  useEffect(() => {
    setViewDate(currentDate);
  }, [currentDate]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday

  // FIX: Padding days from prev month to align grid properly
  // Generate empty cells based on the first day of the week
  const prefixDays = Array.from({ length: firstDayOfMonth }, (_, i) => null);
  
  // Days of current month
  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Remaining slots for next month to fill grid (assuming 6 rows max -> 42 cells)
  const totalSlots = 42; 
  const suffixDays = Array.from({ length: totalSlots - prefixDays.length - currentMonthDays.length }, (_, i) => i + 1);

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };
  
  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleDayClick = (day: number) => {
    const selected = new Date(year, month, day);
    onDateChange(selected);
  };

  const openAddTaskModal = (day: number, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent selecting date if we just want to add task
    const selectedStr = formatDate(new Date(year, month, day));
    setTaskModalDate(selectedStr);
    setIsTaskModalOpen(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const submitNewTask = () => {
    if (newTaskText.trim()) {
      onAddTask(taskModalDate, newTaskText);
      setNewTaskText("");
      setIsTaskModalOpen(false);
    }
  };

  const getTraceIcon = (day: number) => {
    const dateToCheck = new Date(year, month, day);
    const dateStr = formatDate(dateToCheck);
    const dayTasks = tasks.filter(t => t.dateStr === dateStr);

    if (dayTasks.length === 0) return null;
    const completed = dayTasks.filter(t => t.status === 'completed');
    const failed = dayTasks.filter(t => t.status === 'failed');
    const givenUp = dayTasks.filter(t => t.status === 'given_up');

    // Logic synced with Sidebar TraceCalendar
    if (completed.length > 0) return <span className="text-xl animate-bounce">{completed[0].sticker || '🐱'}</span>;
    if (failed.length === dayTasks.length) return <span className="text-xl">🌧️</span>;
    if (givenUp.length === dayTasks.length) return <span className="text-xl opacity-50">💨</span>;

    // Default Pencil Trace
    return (
      <svg viewBox="0 0 100 100" className="w-6 h-6 opacity-30">
         <path d="M 50, 50 m -40, 0 a 40,40 0 1,0 80,0 a 40,40 0 1,0 -80,0" className="pencil-trace" style={{ strokeDashoffset: '20' }} />
      </svg>
    );
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[#F7F5F0] p-6 lg:p-10 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
            <h2 className="text-4xl font-bold text-gray-800 font-handwriting tracking-wide flex items-center gap-3">
                {year}年 {month + 1}月
                <span className="text-sm font-sans font-normal bg-orange-100 text-orange-600 px-2 py-1 rounded-md">
                   {totalSlots > 35 ? '6 Weeks' : '5 Weeks'}
                </span>
            </h2>
            <div className="flex gap-3 bg-white p-1.5 rounded-2xl shadow-sm border border-stone-200">
                <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-stone-100 text-gray-600 transition-colors">
                    <ChevronLeft size={20} />
                </button>
                <button 
                  onClick={() => {
                      const now = new Date();
                      setViewDate(now);
                      onDateChange(now);
                  }} 
                  className="px-4 py-2 rounded-xl hover:bg-stone-100 text-gray-700 font-bold text-sm transition-colors flex items-center gap-2"
                >
                    <RotateCcw size={14}/> 回到今天
                </button>
                <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-stone-100 text-gray-600 transition-colors">
                    <ChevronRight size={20} />
                </button>
            </div>
        </div>

        {/* Calendar Grid - Planner Style */}
        <div className="flex-1 bg-[#FBF9F6] rounded-t-xl shadow-[2px_2px_10px_rgba(0,0,0,0.05)] border-t border-l border-r border-stone-200 flex flex-col relative overflow-hidden">
            
            {/* Binding Rings Effect (Decoration) */}
            <div className="absolute top-0 left-0 w-full flex justify-around -mt-3 z-20 pointer-events-none">
                {Array.from({length: 8}).map((_,i) => (
                    <div key={i} className="w-2 h-6 bg-stone-300 rounded-full shadow-inner border border-stone-400"></div>
                ))}
            </div>

            {/* Weekday Header */}
            <div className="grid grid-cols-7 bg-[#F7F5F0] border-b-2 border-dashed border-stone-300 pt-6 shrink-0 z-10 relative">
                {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                    <div key={d} className="pb-3 text-center text-lg font-handwriting text-stone-500">周{d}</div>
                ))}
            </div>
            
            {/* Days Grid - Scrollable */}
            <div className="grid grid-cols-7 flex-1 overflow-y-auto">
                {/* Prev Month Padding - Fixed to show empty slots correctly */}
                {prefixDays.map((_, i) => (
                    <div key={`prev-${i}`} className="bg-stone-50/50 p-2 border-b border-r border-dashed border-stone-200 flex flex-col items-start opacity-30 select-none min-h-[160px]">
                    </div>
                ))}

                {/* Current Month */}
                {currentMonthDays.map(d => {
                    const dateObj = new Date(year, month, d);
                    const dateStr = formatDate(dateObj);
                    const isToday = formatDate(new Date()) === dateStr;
                    const traceIcon = getTraceIcon(d);
                    const dayTasks = tasks.filter(t => t.dateStr === dateStr);

                    return (
                        <div 
                            key={`curr-${d}`} 
                            onClick={() => handleDayClick(d)}
                            className={`relative p-2 border-b border-r border-dashed border-stone-300 transition-colors hover:bg-white group cursor-pointer flex flex-col justify-start min-h-[160px] ${isToday ? 'bg-orange-50/30' : ''}`}
                        >
                            {/* Top Row: Date & Add Btn */}
                            <div className="flex justify-between items-start w-full">
                                <span className={`text-lg font-handwriting w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-orange-500 text-white shadow-md transform -rotate-6' : 'text-stone-700'}`}>
                                    {d}
                                </span>
                                <button 
                                    onClick={(e) => openAddTaskModal(d, e)}
                                    className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-orange-500 transition-opacity p-0.5"
                                    title="添加任务"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>

                            {/* Task List (Max 3) */}
                            <div className="flex flex-col gap-1.5 mt-2 w-full px-1 relative z-10">
                                {dayTasks.slice(0, 3).map(task => (
                                    <div key={task.id} className="flex items-center gap-1 text-base text-stone-600 truncate">
                                       <span className={`truncate ${task.status === 'completed' ? 'line-through opacity-50' : ''}`}>{task.text}</span>
                                       {task.status === 'completed' && <span className="text-green-500 font-bold ml-1">√</span>}
                                       {task.status === 'failed' && <span className="text-red-500 font-bold ml-1">×</span>}
                                       {task.status === 'given_up' && <span className="text-gray-400 font-bold ml-1">-</span>}
                                    </div>
                                ))}
                                {dayTasks.length > 3 && <div className="text-xs text-stone-400 pl-3">+{dayTasks.length - 3} 更多</div>}
                            </div>

                            {/* Bottom Decor: Icon (Watermark style) */}
                            <div className="absolute bottom-1 right-1 opacity-60 scale-75 pointer-events-none">
                                {traceIcon}
                            </div>
                        </div>
                    );
                })}

                {/* Next Month Padding */}
                {suffixDays.map(d => (
                    <div key={`next-${d}`} className="bg-stone-50/50 p-2 border-b border-r border-dashed border-stone-200 flex flex-col items-start opacity-30 select-none min-h-[160px]">
                         <span className="text-xl font-handwriting text-stone-400">{d}</span>
                    </div>
                ))}
            </div>
        </div>

        {/* Add Task Modal for Calendar */}
        {isTaskModalOpen && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative border border-stone-100">
                    <button onClick={() => setIsTaskModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                    <h3 className="text-2xl font-handwriting font-bold text-gray-800 mb-1">添加新任务</h3>
                    <p className="text-sm text-gray-400 mb-6 font-mono">{taskModalDate}</p>
                    
                    <input 
                        ref={inputRef}
                        type="text" 
                        value={newTaskText}
                        onChange={(e) => setNewTaskText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && submitNewTask()}
                        placeholder="想做点什么？"
                        className="w-full bg-[#F7F5F0] border-b-2 border-stone-200 px-4 py-3 rounded-t-xl outline-none focus:border-orange-400 transition-all text-lg mb-6 font-handwriting placeholder-stone-400"
                    />
                    
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setIsTaskModalOpen(false)} className="px-5 py-2.5 rounded-xl text-gray-500 hover:bg-stone-50 font-medium">取消</button>
                        <button onClick={submitNewTask} className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-lg shadow-orange-200 transition-all font-bold">
                            添加任务
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

// --- Main Application ---
const App = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<ViewMode>('tasks');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // [Fix] Daily Quote State to prevent flickering
  const [dailyQuote, setDailyQuote] = useState({ text: "", author: "" });
  
  // [新增] 状态栏 State
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | 'idle'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  // [修改] 初始化数据加载逻辑 (优先读硬盘，其次读 LocalStorage)
  const loadData = (key: string, defaultValue: any, fallbackKey: string) => {
    try {
      // 1. 尝试读硬盘
      if (fs.existsSync(DATA_FILE_PATH)) {
        const raw = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
        const data = JSON.parse(raw);
        if (data[key]) return data[key];
        // 兼容旧格式
        if (key === 'tasks' && Array.isArray(data)) return data;
      }
      // 2. 硬盘没有，读 LocalStorage
      const saved = localStorage.getItem(fallbackKey);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (err) {
      console.error(`Error loading ${key}`, err);
      return defaultValue;
    }
  };

  const [tasks, setTasks] = useState<Task[]>(() => loadData('tasks', [], 'flowlog_tasks'));
  
  const [habits, setHabits] = useState<Habit[]>(() => {
    const defaultHabits = [
      { id: 'h1', name: '喝水', icon: '💧', color: '#60a5fa', slogan: '水是生命之源', goal: 8, unit: '杯', step: 1, createdAt: Date.now() },
      { id: 'h2', name: '冥想', icon: '🧘', color: '#a78bfa', slogan: '寻找内心的平静', goal: 15, unit: '分钟', step: 5, createdAt: Date.now() }
    ];
    return loadData('habits', defaultHabits, 'flowlog_habits');
  });

  const [habitLogs, setHabitLogs] = useState<HabitLog[]>(() => loadData('habitLogs', [], 'flowlog_habit_logs'));

  const [newTaskText, setNewTaskText] = useState("");

  // [修改] 数据保存逻辑 (双重写入)
  useEffect(() => {
    const saveData = async () => {
        try {
            // A. LocalStorage
            localStorage.setItem('flowlog_tasks', JSON.stringify(tasks));
            localStorage.setItem('flowlog_habits', JSON.stringify(habits));
            localStorage.setItem('flowlog_habit_logs', JSON.stringify(habitLogs));

            // B. File System (硬盘)
            const fullData = { tasks, habits, habitLogs, lastUpdated: new Date().toISOString() };
            fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(fullData, null, 2), 'utf-8');
            
            // setSaveStatus('success'); setStatusMsg('已同步');
        } catch (err) {
            console.error("Save failed:", err);
            setSaveStatus('error');
            setStatusMsg('写入硬盘失败: 权限不足或路径错误');
        }
    };
    saveData();
  }, [tasks, habits, habitLogs]);

  // 清除状态栏
  useEffect(() => {
    if (saveStatus !== 'idle') {
        const timer = setTimeout(() => setSaveStatus('idle'), 3000);
        return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  // [Fix] Set random quote only once on mount
  useEffect(() => {
    setDailyQuote(getRandomItem(QUOTES));
  }, []);

  // --- Logic ---
  const selectedDateStr = formatDate(currentDate);
  const currentTasks = tasks.filter(t => t.dateStr === selectedDateStr);

  const addTask = (dateStr: string = selectedDateStr, text: string = newTaskText) => {
    if (!text.trim()) return;
    const newTask: Task = {
      id: generateId(),
      dateStr: dateStr,
      text: text,
      status: 'pending',
      createdAt: Date.now()
    };
    setTasks(prev => [...prev, newTask]);
    if (dateStr === selectedDateStr) {
        setNewTaskText("");
        setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const updateTaskStatus = (id: string, status: TaskStatus) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      if (t.status === status) return t;

      let slogan = t.slogan;
      let sticker = t.sticker;

      if (status !== 'pending') {
        slogan = getRandomItem(SLOGANS[status]);
        if (status === 'completed') sticker = getRandomItem(STICKERS.completed);
        else if (status === 'failed') sticker = getRandomItem(STICKERS.failed);
        else sticker = getRandomItem(STICKERS.given_up);
      } else {
        slogan = undefined;
        sticker = undefined;
      }
      return { ...t, status, slogan, sticker };
    }));
  };

  const updateTaskReflection = (id: string, text: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, reflection: text } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const addHabit = (habitData: Omit<Habit, 'id' | 'createdAt' | 'archived'>) => {
    const newHabit: Habit = { id: generateId(), ...habitData, archived: false, createdAt: Date.now() };
    setHabits([...habits, newHabit]);
  };

  const logHabit = (habitId: string, step: number) => {
    const newLog: HabitLog = { id: generateId(), habitId, dateStr: selectedDateStr, value: step };
    setHabitLogs(prev => [...prev, newLog]);
  };

  const resetHabitLogs = (habitId: string, dateStr: string) => {
    setHabitLogs(prev => prev.filter(l => !(l.habitId === habitId && l.dateStr === dateStr)));
  };

  const updateHabitSlogan = (id: string, slogan: string) => {
      setHabits(prev => prev.map(h => h.id === id ? { ...h, slogan } : h));
  };

  const deleteHabit = (id: string) => {
    setHabits(prev => prev.filter(h => h.id !== id));
    setHabitLogs(prev => prev.filter(l => l.habitId !== id));
  };

  const archiveHabit = (id: string) => {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, archived: true } : h));
  };

  const unarchiveHabit = (id: string) => {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, archived: false } : h));
  };

  // Combined Data for Export
  const getAllData = () => ({ tasks, habits, habitLogs });
  const importAllData = (data: any) => {
    if(data.tasks) setTasks(data.tasks);
    if(data.habits) setHabits(data.habits);
    if(data.habitLogs) setHabitLogs(data.habitLogs);
  };

  return (
    <div className="flex h-screen bg-[#F7F5F0] overflow-hidden font-sans text-slate-700 selection:bg-orange-100">
      
      {/* 状态栏提示 */}
      <StatusBar status={saveStatus} message={statusMsg} />

      <aside className="w-20 bg-[#F7F5F0] border-r border-gray-200/60 flex flex-col items-center py-6 z-20 shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
         <div className="mb-8 p-2 bg-orange-100 text-orange-500 rounded-xl shadow-inner"><div className="font-handwriting font-bold text-xl">流</div></div>
         <nav className="flex-1 flex flex-col gap-6 w-full px-2">
             <button onClick={() => setActiveTab('tasks')} className={`p-3 rounded-xl flex flex-col items-center gap-1 transition-all ${activeTab === 'tasks' ? 'neu-pressed text-orange-500' : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'}`} title="任务"><ListTodo size={24} /><span className="text-[10px] font-bold">任务</span></button>
             <button onClick={() => setActiveTab('habits')} className={`p-3 rounded-xl flex flex-col items-center gap-1 transition-all ${activeTab === 'habits' ? 'neu-pressed text-orange-500' : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'}`} title="习惯"><Zap size={24} /><span className="text-[10px] font-bold">习惯</span></button>
             <button onClick={() => setActiveTab('calendar')} className={`p-3 rounded-xl flex flex-col items-center gap-1 transition-all ${activeTab === 'calendar' ? 'neu-pressed text-orange-500' : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'}`} title="日历"><CalendarIcon size={24} /><span className="text-[10px] font-bold">日历</span></button>
             <button onClick={() => setActiveTab('stats')} className={`p-3 rounded-xl flex flex-col items-center gap-1 transition-all ${activeTab === 'stats' ? 'neu-pressed text-orange-500' : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'}`} title="统计"><PieChart size={24} /><span className="text-[10px] font-bold">统计</span></button>
         </nav>
         <button onClick={() => setIsSettingsOpen(true)} className="p-3 text-gray-400 hover:text-orange-400 transition-colors mt-auto" title="设置"><Settings size={22} /></button>
      </aside>

      {/* --- Sub-Sidebar (Calendar Widget) --- */}
      {/* Persistent for Tasks, Habits. Hidden for Stats and Calendar */}
      {(activeTab !== 'stats' && activeTab !== 'calendar') && (
        <aside className="hidden md:flex w-[480px] border-r border-gray-200/60 bg-[#F7F5F0] p-4 flex-col animate-in slide-in-from-left-4 duration-300 z-10">
            <TimeTraveler
                currentDate={currentDate}
                onDateChange={setCurrentDate}
            />
            <div className="flex-1 overflow-y-auto no-scrollbar">
                <TraceCalendar 
                    currentDate={currentDate} 
                    tasks={tasks} 
                    selectedDate={currentDate}
                    onSelectDate={setCurrentDate}
                />
                 <div className="mt-8 px-4 text-center">
                    <div className="font-handwriting text-xl text-gray-400 opacity-60 whitespace-nowrap">
                        “ 逝者如斯夫，不舍昼夜 ”
                    </div>
                </div>
            </div>
        </aside>
      )}

      {/* --- Main Content Area --- */}
      <main className="flex-1 flex flex-col relative bg-[#FBF9F6]">
        
        {activeTab === 'stats' && (
            <StatisticsView tasks={tasks} habits={habits} habitLogs={habitLogs} />
        )}

        {activeTab === 'calendar' && (
            <CalendarView 
                tasks={tasks} 
                currentDate={currentDate} 
                onDateChange={setCurrentDate} 
                onAddTask={addTask} 
            />
        )}

        {activeTab === 'habits' && (
            <HabitTracker 
               habits={habits} 
               habitLogs={habitLogs} 
               selectedDate={currentDate}
               onAddHabit={addHabit}
               onLogHabit={logHabit}
               onUpdateHabitSlogan={updateHabitSlogan}
               onDeleteHabit={deleteHabit}
               onArchiveHabit={archiveHabit}
               onUnarchiveHabit={unarchiveHabit}
               onResetHabitLogs={resetHabitLogs}
            />
        )}

        {activeTab === 'tasks' && (
            <>
                {/* Header */}
                <header className="px-10 pt-10 pb-4">
                  <h2 className="text-3xl font-bold text-gray-800 flex items-baseline gap-4">
                    {currentDate.getMonth() + 1}月 {currentDate.getDate()}日
                    <span className="text-lg font-normal text-gray-400 font-handwriting">
                       {['周日', '周一', '周二', '周三', '周四', '周五', '周六'][currentDate.getDay()]}
                    </span>
                  </h2>
                  <p className="text-gray-400 mt-2 font-handwriting text-lg">
                     {currentTasks.length > 0 ? `今天种下了 ${currentTasks.length} 颗种子` : '准备开始心流之旅吗？'}
                  </p>
                </header>

                <div className="flex-1 overflow-hidden flex">
                    {/* Task List Column */}
                    <div className="flex-1 overflow-y-auto px-10 pb-32 pt-4 relative">
                      {currentTasks.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-40 -mt-20 select-none">
                          <div className="text-8xl mb-6 grayscale text-gray-300">🌱</div>
                          <p className="font-handwriting text-2xl text-gray-400">静待发芽...</p>
                        </div>
                      ) : (
                        <div className="max-w-2xl mx-auto w-full">
                          {currentTasks.map(task => (
                            <TaskCard 
                              key={task.id} 
                              task={task} 
                              onUpdateStatus={updateTaskStatus}
                              onUpdateReflection={updateTaskReflection}
                              onDelete={deleteTask}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right Aesthetic Column */}
                    <div className="hidden xl:flex w-80 border-l border-gray-100 flex-col p-8 bg-white/30 backdrop-blur-sm">
                         <div className="mb-8">
                             <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">DAILY INSPIRATION</h3>
                             <div className="bg-white rounded-2xl p-6 relative shadow-sm border border-slate-100">
                                <Quote size={20} className="text-orange-300 absolute top-4 left-4" />
                                <p className="font-handwriting text-lg text-gray-600 mt-4 leading-relaxed">
                                    {dailyQuote.text || "Loading..."}
                                </p>
                                <p className="text-right text-xs text-gray-400 mt-4">- {dailyQuote.author}</p>
                             </div>
                         </div>
                    </div>
                </div>

                {/* Add Task Input (Sticky Bottom) */}
                <div className="absolute bottom-0 left-0 w-full p-8 bg-gradient-to-t from-[#FBF9F6] via-[#FBF9F6]/90 to-transparent z-30">
                  <div className="max-w-2xl mx-auto bg-white/80 p-2 pl-6 flex items-center backdrop-blur-md border border-white shadow-lg rounded-2xl">
                    <input 
                      ref={inputRef}
                      type="text" 
                      value={newTaskText}
                      onChange={(e) => setNewTaskText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addTask(selectedDateStr, newTaskText)}
                      placeholder={`添加 ${formatDate(currentDate)} 的任务...`}
                      className="flex-1 bg-transparent outline-none text-lg text-gray-700 placeholder-gray-400 h-12"
                    />
                    <button 
                      onClick={() => addTask(selectedDateStr, newTaskText)}
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-orange-500 hover:bg-orange-50 transition-all"
                    >
                      <Plus size={28} />
                    </button>
                  </div>
                </div>
            </>
        )}
      </main>

      {/* Database / Settings Modal */}
      <DatabaseManager
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        data={getAllData()}
        onImport={importAllData}
      />
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
} else {
  console.error("Failed to find the root element");
}