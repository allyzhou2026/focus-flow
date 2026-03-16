import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Play, Square, CheckCircle, Calendar as CalendarIcon,
  ListTodo, Clock, X, BarChart3, ChevronLeft, ChevronRight, Settings2,
  GripHorizontal, Edit2, Trash2, CalendarDays, Menu,
  Wand2, FileText, ImagePlus, Loader2, UploadCloud, Columns,
  Swords, Sparkles
} from 'lucide-react';

// --- 实用函数 ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const fetchWithRetry = async (url, options, maxRetries = 5) => {
  let delay = 1000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await new Promise(res => setTimeout(res, delay));
      delay *= 2;
    }
  }
};

const formatTime = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatDate = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d;
};

const getEndOfWeek = (date) => {
  const d = getStartOfWeek(date);
  d.setDate(d.getDate() + 6);
  return d;
};

const SUBJECT_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899'];

// --- 主应用组件 ---
export default function App() {
  // --- 状态管理 (包含 LocalStorage 缓存) ---
  const [subjects, setSubjects] = useState(() => JSON.parse(localStorage.getItem('focus_subjects')) || [
    { id: 's1', name: '语文', color: '#3B82F6' },
    { id: 's2', name: '数学', color: '#10B981' },
    { id: 's3', name: '英语', color: '#EF4444' },
    { id: 's4', name: '提醒', color: '#8B5CF6' }
  ]);
  const [tasks, setTasks] = useState(() => JSON.parse(localStorage.getItem('focus_tasks')) || []);
  // sessions 结构: { id, taskId, subjectId, duration (秒), date (YYYY-MM-DD) }
  const [sessions, setSessions] = useState(() => JSON.parse(localStorage.getItem('focus_sessions')) || []);

  const [activeTab, setActiveTab] = useState('board'); // 'board' | 'calendar'

  // 左侧边栏收起状态
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true); // 默认改为收起 (true)

  // 弹窗控制
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isBatchTaskModalOpen, setIsBatchTaskModalOpen] = useState(false);

  // 计时器状态
  const [activeTimer, setActiveTimer] = useState(null); // { task, mode: 'countup'|'countdown', remaining, elapsed, isRunning }

  // --- 数据持久化 ---
  useEffect(() => { localStorage.setItem('focus_subjects', JSON.stringify(subjects)); }, [subjects]);
  useEffect(() => { localStorage.setItem('focus_tasks', JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem('focus_sessions', JSON.stringify(sessions)); }, [sessions]);

  // --- 核心操作函数 ---
  const addSubject = (name, color) => {
    setSubjects([...subjects, { id: generateId(), name, color }]);
    setIsSubjectModalOpen(false);
  };

  const updateSubjectName = (id, newName) => {
    setSubjects(subjects.map(s => s.id === id ? { ...s, name: newName } : s));
  };

  const reorderSubjects = (draggedId, targetId) => {
    if (draggedId === targetId) return;
    setSubjects(prev => {
      const copy = [...prev];
      const draggedIdx = copy.findIndex(s => s.id === draggedId);
      const targetIdx = copy.findIndex(s => s.id === targetId);
      const [item] = copy.splice(draggedIdx, 1);
      copy.splice(targetIdx, 0, item);
      return copy;
    });
  };

  const addMultipleTasks = (targetDate, tasksToAdd) => {
    const newTasks = tasksToAdd.map(t => ({
      id: generateId(),
      title: t.title,
      subjectId: t.subjectId,
      totalTime: 0,
      completed: false,
      createdAt: new Date().toISOString(),
      targetDate: targetDate
    }));
    setTasks([...tasks, ...newTasks]);
    setIsBatchTaskModalOpen(false);
  };

  // 新增：快速添加单个任务的方法
  const addSingleTask = (title, subjectId, targetDate) => {
    setTasks([...tasks, {
      id: generateId(),
      title,
      subjectId,
      totalTime: 0,
      completed: false,
      createdAt: new Date().toISOString(),
      targetDate: targetDate
    }]);
  };

  const toggleTaskCompletion = (taskId) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = (taskId) => {
    setTasks(tasks.filter(t => t.id !== taskId));
  };

  const saveSession = (taskId, subjectId, duration) => {
    if (duration < 5) return; // 忽略小于5秒的无效计时
    const today = formatDate(new Date());

    // 添加到 sessions
    setSessions([...sessions, { id: generateId(), taskId, subjectId, duration, date: today }]);

    // 更新任务总时长
    setTasks(tasks.map(t => t.id === taskId ? { ...t, totalTime: t.totalTime + duration } : t));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans text-gray-800">

      {/* 侧边导航栏 */}
      <nav className={`bg-white border-r border-gray-200 p-4 flex flex-col gap-2 shadow-sm z-10 transition-all duration-300 flex-shrink-0 ${isSidebarCollapsed ? 'md:w-20 items-center' : 'w-full md:w-64'}`}>
        <div className={`flex items-center px-2 py-4 mb-4 text-indigo-600 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'hidden' : 'flex'}`}>
            <Clock className="w-8 h-8 flex-shrink-0" />
            <h1 className="text-xl font-bold tracking-tight truncate">Focus Flow</h1>
          </div>
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="text-gray-400 hover:text-indigo-600 transition-colors hidden md:block"
            title={isSidebarCollapsed ? "展开菜单" : "收起菜单"}
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        <button
          onClick={() => setActiveTab('board')}
          title="任务看板"
          className={`flex items-center gap-3 py-3 rounded-xl transition-colors ${activeTab === 'board' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-gray-100 text-gray-600'} ${isSidebarCollapsed ? 'px-0 justify-center w-12 h-12' : 'px-4'}`}
        >
          <ListTodo className="w-5 h-5 flex-shrink-0" />
          <span className={isSidebarCollapsed ? 'hidden' : 'block'}>任务看板</span>
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          title="数据日历"
          className={`flex items-center gap-3 py-3 rounded-xl transition-colors ${activeTab === 'calendar' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-gray-100 text-gray-600'} ${isSidebarCollapsed ? 'px-0 justify-center w-12 h-12' : 'px-4'}`}
        >
          <CalendarIcon className="w-5 h-5 flex-shrink-0" />
          <span className={isSidebarCollapsed ? 'hidden' : 'block'}>数据日历</span>
        </button>

        <div className={`mt-8 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>管理 Subjects</div>
        <div className={`mt-8 mb-2 border-t border-gray-100 w-full ${isSidebarCollapsed ? 'block' : 'hidden'}`}></div>

        <div className="flex flex-col gap-1 w-full items-center md:items-stretch">
          {subjects.map(sub => (
            <div key={sub.id} className={`flex items-center gap-3 py-2 text-sm text-gray-600 ${isSidebarCollapsed ? 'justify-center px-0' : 'px-4'}`} title={sub.name}>
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color }}></span>
              <span className={`truncate ${isSidebarCollapsed ? 'hidden' : 'block'}`}>{sub.name}</span>
            </div>
          ))}
          <button
            onClick={() => setIsSubjectModalOpen(true)}
            title="新建 Subject"
            className={`flex items-center gap-2 py-2 mt-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors ${isSidebarCollapsed ? 'justify-center px-0 w-12 h-12 mx-auto' : 'px-4'}`}
          >
            <Plus className="w-5 h-5 flex-shrink-0" />
            <span className={isSidebarCollapsed ? 'hidden' : 'block'}>新建 Subject</span>
          </button>
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto bg-gray-50/50 p-4 md:p-8 relative">
        {activeTab === 'board' ? (
          <TaskBoard
            subjects={subjects}
            tasks={tasks}
            onAddTask={() => setIsBatchTaskModalOpen(true)}
            onToggleComplete={toggleTaskCompletion}
            onStartTimer={(task) => setActiveTimer({ task, mode: 'countup', remaining: 25 * 60, elapsed: 0, isRunning: false })}
            onUpdateSubjectName={updateSubjectName}
            onReorderSubjects={reorderSubjects}
            onDeleteTask={deleteTask}
            onAddSingleTask={addSingleTask}
          />
        ) : (
          <CalendarBoard subjects={subjects} sessions={sessions} tasks={tasks} />
        )}
      </main>

      {/* 模态框 */}
      {isSubjectModalOpen && (
        <SubjectModal onClose={() => setIsSubjectModalOpen(false)} onSave={addSubject} />
      )}
      {isBatchTaskModalOpen && (
        <BatchTaskModal subjects={subjects} onClose={() => setIsBatchTaskModalOpen(false)} onSave={addMultipleTasks} />
      )}

      {/* 专注计时器全屏/弹窗 */}
      {activeTimer && (
        <TimerOverlay
          timerState={activeTimer}
          setTimerState={setActiveTimer}
          onClose={(duration) => {
            if (duration > 0) saveSession(activeTimer.task.id, activeTimer.task.subjectId, duration);
            setActiveTimer(null);
          }}
          onCompleteTask={(duration) => {
            if (duration > 0) saveSession(activeTimer.task.id, activeTimer.task.subjectId, duration);
            toggleTaskCompletion(activeTimer.task.id);
            setActiveTimer(null);
          }}
          subjectColor={subjects.find(s => s.id === activeTimer.task.subjectId)?.color || '#3B82F6'}
        />
      )}
    </div>
  );
}

// --- 任务看板组件 ---
function TaskBoard({ subjects, tasks, onAddTask, onToggleComplete, onStartTimer, onUpdateSubjectName, onReorderSubjects, onDeleteTask, onAddSingleTask }) {
  const [baseDate, setBaseDate] = useState(new Date()); // 用于控制日历导航的基准日期
  const [columns, setColumns] = useState(2);
  const [draggedSubjectId, setDraggedSubjectId] = useState(null);

  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editingName, setEditingName] = useState('');

  // 快速添加任务的状态
  const [quickAddSubjectId, setQuickAddSubjectId] = useState(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  const targetDateStr = formatDate(baseDate);

  // 导航逻辑
  const handleNavigate = (direction) => {
    const newDate = new Date(baseDate);
    newDate.setDate(newDate.getDate() + direction);
    setBaseDate(newDate);
  };

  const resetToToday = () => setBaseDate(new Date());

  // 看板现在仅严格展示选定日期的任务
  const filteredTasks = tasks.filter(t => {
    const taskDate = t.targetDate || t.createdAt.split('T')[0];
    return taskDate === targetDateStr;
  });

  const startEditSubject = (subject) => {
    setEditingSubjectId(subject.id);
    setEditingName(subject.name);
  };

  const saveSubjectName = () => {
    if (editingName.trim() && editingSubjectId) {
      onUpdateSubjectName(editingSubjectId, editingName.trim());
    }
    setEditingSubjectId(null);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">

        {/* --- 视觉优化：打怪升级主题的头部 --- */}
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-500 to-pink-500 flex items-center gap-2 drop-shadow-sm pb-1">
            <Swords className="w-7 h-7 md:w-8 md:h-8 text-indigo-500 flex-shrink-0" />
            勇者探险岛
          </h2>
          <div className="text-xs md:text-sm font-bold text-indigo-700 flex items-center gap-1.5 bg-indigo-50 px-3 py-1.5 rounded-full w-fit border border-indigo-100 shadow-sm">
            <Sparkles className="w-4 h-4 text-amber-500" />
            冲吧小勇士！每消灭一个任务，就能赚取经验值变强哦！
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* 时间导航器 */}
          <div className="flex items-center gap-1 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
            <button onClick={() => handleNavigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={resetToToday} className="px-2 text-sm font-medium text-gray-700 hover:text-indigo-600 min-w-[100px] text-center" title="回到今天">
              {targetDateStr}
            </button>
            <button onClick={() => handleNavigate(1)} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>

          <button
            onClick={onAddTask}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 md:px-5 md:py-2.5 rounded-xl flex items-center gap-2 font-medium shadow-sm transition-all active:scale-95 ml-auto md:ml-0"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden md:inline">新建计划</span>
          </button>
        </div>
      </div>

      <div className={`grid gap-6 ${columns === 1 ? 'grid-cols-1' : columns === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
        {subjects.map(subject => {
          const subjectTasks = filteredTasks.filter(t => t.subjectId === subject.id);
          const pendingTasks = subjectTasks.filter(t => !t.completed);
          const completedTasks = subjectTasks.filter(t => t.completed);

          // 计算当前视图下该 Subject 的总专注时长
          const totalSubjectTime = subjectTasks.reduce((sum, task) => sum + (task.totalTime || 0), 0);

          return (
            <div
              key={subject.id}
              draggable={editingSubjectId !== subject.id}
              onDragStart={() => setDraggedSubjectId(subject.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedSubjectId) {
                  onReorderSubjects(draggedSubjectId, subject.id);
                  setDraggedSubjectId(null);
                }
              }}
              // 移除了 transition-all 改为 transition (不包含高度动画，保证拖拽流畅)，加入 resize-y 和 overflow-hidden 允许调整高度
              className={`bg-white rounded-2xl shadow-sm border ${draggedSubjectId === subject.id ? 'border-indigo-300 opacity-50' : 'border-gray-100'} p-5 flex flex-col h-[340px] min-h-[250px] max-h-[80vh] resize-y overflow-hidden transition`}
            >
              {/* Subject 头部 */}
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100 group">
                <GripHorizontal className="w-4 h-4 text-gray-300 cursor-grab active:cursor-grabbing hover:text-gray-500 flex-shrink-0" title="拖动调整顺序" />
                <div className="w-4 h-4 rounded-full shadow-inner flex-shrink-0" style={{ backgroundColor: subject.color }}></div>

                {editingSubjectId === subject.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={saveSubjectName}
                    onKeyDown={(e) => e.key === 'Enter' && saveSubjectName()}
                    className="font-bold text-lg text-gray-800 bg-gray-50 border border-indigo-300 rounded px-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                ) : (
                  <h3
                    className="font-bold text-lg text-gray-800 truncate cursor-pointer hover:text-indigo-600 transition-colors flex-1"
                    onDoubleClick={() => startEditSubject(subject)}
                    title="双击重命名"
                  >
                    {subject.name}
                  </h3>
                )}

                {editingSubjectId !== subject.id && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => startEditSubject(subject)} className="text-gray-300 hover:text-indigo-500 p-1 rounded hover:bg-gray-100" title="重命名">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { setQuickAddSubjectId(subject.id); setQuickAddTitle(''); }}
                      className="text-gray-400 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50"
                      title="快速添加任务"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* 任务列表 */}
              <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {pendingTasks.length === 0 && completedTasks.length === 0 && quickAddSubjectId !== subject.id && (
                  <div className="text-center text-gray-400 py-6 text-sm flex flex-col items-center gap-2">
                    <ListTodo className="w-8 h-8 opacity-20" />
                    当前视图无任务
                  </div>
                )}

                {/* 待办任务 */}
                {pendingTasks.map((task, index) => (
                  <div key={task.id} className="group flex items-start justify-between p-3 rounded-xl bg-gray-50 hover:bg-white border border-transparent hover:border-gray-200 hover:shadow-sm transition-all">
                    <div className="flex gap-3 items-start overflow-hidden">
                      <button onClick={() => onToggleComplete(task.id)} className="mt-0.5 text-gray-300 hover:text-green-500 transition-colors flex-shrink-0">
                        <CheckCircle className="w-5 h-5" />
                      </button>
                      <div className="flex flex-col justify-center min-h-[24px]">
                        <span className="font-medium text-gray-700 text-sm break-words flex items-start">
                          <span className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded bg-indigo-50 text-indigo-600 text-[10px] font-bold mr-2">
                            {index + 1}
                          </span>
                          <span className="flex-1">{task.title}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0 items-center">
                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="text-red-400 bg-red-50 hover:bg-red-100 hover:text-red-600 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="删除任务"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onStartTimer(task)}
                        className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg transition-colors shadow-sm"
                        title="开始专注"
                      >
                        <Play className="w-4 h-4 fill-current" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* 已完成任务 */}
                {completedTasks.length > 0 && (
                  <div className="pt-4">
                    <div className="text-xs font-semibold text-gray-400 mb-2 uppercase">已完成</div>
                    {completedTasks.map((task, index) => (
                      <div key={task.id} className="flex items-start justify-between p-3 rounded-xl opacity-60 bg-gray-50 mb-2">
                        <div className="flex gap-3 items-start overflow-hidden">
                          <button onClick={() => onToggleComplete(task.id)} className="mt-0.5 text-green-500 flex-shrink-0">
                            <CheckCircle className="w-5 h-5 fill-current opacity-20" />
                          </button>
                          <div className="flex flex-col justify-center min-h-[24px]">
                            <span className="font-medium text-gray-500 text-sm line-through break-words flex items-start">
                              <span className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded bg-gray-200 text-gray-500 text-[10px] font-bold mr-2">
                                {index + 1}
                              </span>
                              <span className="flex-1">{task.title}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 移动到最下方的快速添加任务的内联输入框 */}
                {quickAddSubjectId === subject.id && (
                  <div className="flex items-center gap-2 p-3 mt-2 rounded-xl bg-white border-2 border-indigo-200 shadow-sm transition-all animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex-shrink-0"></div>
                    <input
                      autoFocus
                      type="text"
                      value={quickAddTitle}
                      onChange={(e) => setQuickAddTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && quickAddTitle.trim()) {
                          onAddSingleTask(quickAddTitle.trim(), subject.id, targetDateStr);
                          setQuickAddTitle('');
                          setQuickAddSubjectId(null);
                        }
                        if (e.key === 'Escape') {
                          setQuickAddSubjectId(null);
                        }
                      }}
                      onBlur={() => {
                        if (quickAddTitle.trim()) {
                          onAddSingleTask(quickAddTitle.trim(), subject.id, targetDateStr);
                        }
                        setQuickAddSubjectId(null);
                      }}
                      className="flex-1 bg-transparent border-none focus:outline-none text-sm text-gray-700 font-medium"
                      placeholder="输入任务，回车保存..."
                    />
                  </div>
                )}
              </div>

              {/* 底部统计栏 (状态栏) */}
              {totalSubjectTime > 0 && (
                <div className="pt-3 mt-2 border-t border-gray-100 flex items-center justify-end flex-shrink-0">
                  <span className="text-indigo-600 bg-indigo-50 text-xs font-medium px-2.5 py-1 rounded-md flex items-center gap-1" title="当前视图总专注时长">
                    <Clock className="w-3 h-3" />
                    {formatTime(totalSubjectTime)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 弱化的列数切换器，移至底部 */}
      <div className="flex justify-center mt-6">
        <div className="flex items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
          <Columns className="w-4 h-4 text-gray-400 mx-1 hidden sm:block" />
          {[1, 2, 3].map(c => (
            <button
              key={c}
              onClick={() => setColumns(c)}
              className={`w-6 h-6 flex items-center justify-center text-xs font-medium rounded transition-colors ${columns === c ? 'bg-gray-300 text-gray-800' : 'text-gray-400 hover:bg-gray-200'}`}
              title={`每行 ${c} 列`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- 计时器/专注浮层组件 ---
function TimerOverlay({ timerState, setTimerState, onClose, onCompleteTask, subjectColor }) {
  const { task, mode, remaining, elapsed, isRunning } = timerState;
  const timerRef = useRef(null);

  // 核心计时逻辑
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimerState(prev => {
          if (prev.mode === 'countdown') {
            if (prev.remaining <= 1) {
              clearInterval(timerRef.current);
              return { ...prev, remaining: 0, elapsed: prev.elapsed + 1, isRunning: false };
            }
            return { ...prev, remaining: prev.remaining - 1, elapsed: prev.elapsed + 1 };
          } else {
            // countup
            return { ...prev, elapsed: prev.elapsed + 1 };
          }
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, setTimerState]);

  const toggleTimer = () => setTimerState(prev => ({ ...prev, isRunning: !prev.isRunning }));
  const changeMode = (newMode) => setTimerState(prev => ({ ...prev, mode: newMode, isRunning: false, remaining: 25 * 60 }));
  const setCountdownMinutes = (m) => setTimerState(prev => ({ ...prev, remaining: m * 60, isRunning: false }));

  // 显示的时间
  const displayTime = mode === 'countdown' ? formatTime(remaining) : formatTime(elapsed);

  return (
    <div className="fixed inset-0 bg-gray-900/95 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col relative">
        {/* 顶部装饰条 */}
        <div className="h-3 w-full" style={{ backgroundColor: subjectColor }}></div>

        <button
          onClick={() => onClose(elapsed)}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 md:p-12 flex flex-col items-center">
          <span className="text-sm font-bold tracking-wider text-gray-500 uppercase mb-2">正在专注</span>
          <h2 className="text-2xl font-bold text-gray-800 text-center mb-8 px-8">{task.title}</h2>

          {/* 模式切换 */}
          {!isRunning && elapsed === 0 && (
            <div className="flex bg-gray-100 p-1 rounded-xl mb-8">
              <button
                onClick={() => changeMode('countdown')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'countdown' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                番茄钟 (倒计时)
              </button>
              <button
                onClick={() => changeMode('countup')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'countup' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                秒表 (正计时)
              </button>
            </div>
          )}

          {/* 时间设置预设 (仅倒计时) */}
          {!isRunning && elapsed === 0 && mode === 'countdown' && (
            <div className="flex gap-2 mb-6">
              {[5, 15, 25, 45].map(m => (
                <button
                  key={m}
                  onClick={() => setCountdownMinutes(m)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border ${remaining === m * 60 ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                >
                  {m}m
                </button>
              ))}
            </div>
          )}

          {/* 巨大时间显示 */}
          <div className="text-7xl md:text-8xl font-black text-gray-800 tabular-nums tracking-tighter mb-10" style={{ color: isRunning ? subjectColor : '#1f2937' }}>
            {displayTime}
          </div>

          {/* 控制按钮 */}
          <div className="flex items-center gap-6">
            <button
              onClick={toggleTimer}
              className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 active:scale-95`}
              style={{ backgroundColor: isRunning ? '#EF4444' : subjectColor }}
            >
              {isRunning ? <Square className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
            </button>
          </div>

          <div className="mt-8 text-sm text-gray-400 font-medium">
            本次已专注: <span className="text-gray-600">{formatTime(elapsed)}</span>
          </div>
        </div>

        {/* 底部操作区 */}
        <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-between gap-4">
          <button
            onClick={() => onClose(elapsed)}
            className="flex-1 py-3 bg-white border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            保存并退出
          </button>
          <button
            onClick={() => onCompleteTask(elapsed)}
            className="flex-1 py-3 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 shadow-sm transition-colors flex justify-center items-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            完成该任务
          </button>
        </div>
      </div>
    </div>
  );
}

// --- 日历与统计组件 ---
function CalendarBoard({ subjects, sessions, tasks }) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDateStr, setSelectedDateStr] = useState(formatDate(today));
  const [statView, setStatView] = useState('day'); // 新增: 右侧统计面板的维度控制

  // 日历计算逻辑
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0(Sun) - 6(Sat)
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  // 按日期聚合 sessions
  const sessionsByDate = sessions.reduce((acc, curr) => {
    if (!acc[curr.date]) acc[curr.date] = [];
    acc[curr.date].push(curr);
    return acc;
  }, {});

  // --- 动态计算右侧统计数据 ---
  let targetTasks = [];
  let targetSessions = [];
  let statTitle = '';

  if (statView === 'day') {
    targetTasks = tasks.filter(t => (t.targetDate || t.createdAt.split('T')[0]) === selectedDateStr);
    targetSessions = sessionsByDate[selectedDateStr] || [];
    statTitle = `${selectedDateStr} 统计`;
  } else if (statView === 'week') {
    const start = formatDate(getStartOfWeek(new Date(selectedDateStr)));
    const end = formatDate(getEndOfWeek(new Date(selectedDateStr)));
    targetTasks = tasks.filter(t => {
      const d = t.targetDate || t.createdAt.split('T')[0];
      return d >= start && d <= end;
    });
    targetSessions = sessions.filter(s => s.date >= start && s.date <= end);
    statTitle = `${start.slice(5)} 至 ${end.slice(5)}`;
  } else if (statView === 'month') {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    targetTasks = tasks.filter(t => {
      const d = t.targetDate || t.createdAt.split('T')[0];
      return d.startsWith(monthStr);
    });
    targetSessions = sessions.filter(s => s.date.startsWith(monthStr));
    statTitle = `${year}年${month + 1}月 统计`;
  } else if (statView === 'all') {
    targetTasks = tasks;
    targetSessions = sessions;
    statTitle = '全部历史统计';
  }

  const totalPeriodTasks = targetTasks.length;
  const completedPeriodTasks = targetTasks.filter(t => t.completed).length;

  const statsBySubject = subjects.map(sub => {
    const subSessions = targetSessions.filter(s => s.subjectId === sub.id);
    const totalSecs = subSessions.reduce((sum, s) => sum + s.duration, 0);
    const subTasks = targetTasks.filter(t => t.subjectId === sub.id);
    const totalTasks = subTasks.length;
    const completedTasks = subTasks.filter(t => t.completed).length;

    return { ...sub, totalSecs, totalTasks, completedTasks };
  }).filter(s => s.totalSecs > 0 || s.totalTasks > 0).sort((a, b) => b.totalSecs - a.totalSecs);

  const totalPeriodSecs = statsBySubject.reduce((sum, s) => sum + s.totalSecs, 0);

  // 渲染日历格子
  const renderCalendarDays = () => {
    const blanks = Array.from({ length: firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1 }, (_, i) => <div key={`blank-${i}`} className="p-2 border border-transparent bg-gray-50/50 rounded-lg"></div>); // 修正星期一开始

    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const dateNum = i + 1;
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`;

      const daySessions = sessionsByDate[dateStr] || [];
      const dayTasks = tasks.filter(t => (t.targetDate || t.createdAt.split('T')[0]) === dateStr);

      const isToday = dateStr === formatDate(today);
      const isSelected = dateStr === selectedDateStr;
      const completedCount = dayTasks.filter(t => t.completed).length;
      const totalCount = dayTasks.length;

      // 按 Subject 汇总当天的时长，用于绘制进度条
      const dayStats = daySessions.reduce((acc, curr) => {
        acc[curr.subjectId] = (acc[curr.subjectId] || 0) + curr.duration;
        return acc;
      }, {});

      return (
        <div
          key={dateNum}
          onClick={() => setSelectedDateStr(dateStr)}
          className={`p-2 min-h-[110px] border border-gray-100 rounded-lg bg-white shadow-sm flex flex-col transition-all hover:border-indigo-300 cursor-pointer ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-1' : isToday ? 'bg-indigo-50/30' : ''}`}
        >
          <div className={`text-xs font-bold mb-2 flex justify-between items-start ${isSelected ? 'text-indigo-600' : isToday ? 'text-indigo-500' : 'text-gray-400'}`}>
            <span className="text-sm mt-0.5">{dateNum}</span>
            <div className="flex flex-col items-end gap-1">
              {daySessions.length > 0 && (
                <span className="text-[10px] font-normal text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded flex items-center gap-1" title="专注时长">
                  <Clock className="w-2.5 h-2.5" />
                  {formatTime(daySessions.reduce((s,c)=>s+c.duration,0))}
                </span>
              )}
              {totalCount > 0 && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 ${completedCount === totalCount ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`} title="任务完成度">
                  <CheckCircle className="w-2.5 h-2.5" />
                  {completedCount}/{totalCount}
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-end gap-1">
            {Object.entries(dayStats).map(([subId, duration]) => {
              const sub = subjects.find(s => s.id === subId);
              if (!sub) return null;
              // 简单计算一下高度占比，最高不超过一定高度
              const heightStr = duration > 3600 ? '12px' : duration > 1800 ? '8px' : '4px';
              return (
                <div
                  key={subId}
                  className="w-full rounded-sm"
                  style={{ backgroundColor: sub.color, height: heightStr, opacity: 0.8 }}
                  title={`${sub.name}: ${formatTime(duration)}`}
                ></div>
              );
            })}
          </div>
        </div>
      );
    });

    return [...blanks, ...days];
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
      {/* 左侧日历 */}
      <div className="flex-1">
        <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-indigo-500" />
            {year}年 {month + 1}月
          </h2>
          <div className="flex gap-2">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"><ChevronLeft className="w-5 h-5" /></button>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"><ChevronRight className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['一', '二', '三', '四', '五', '六', '日'].map(d => (
              <div key={d} className="text-center text-xs font-bold text-gray-400 pb-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {renderCalendarDays()}
          </div>
        </div>
      </div>

      {/* 右侧统计面板 */}
      <div className="w-full lg:w-80">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sticky top-8">

          {/* 新增：统计维度切换 */}
          <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
            {[
              { id: 'day', label: '日' },
              { id: 'week', label: '周' },
              { id: 'month', label: '月' },
              { id: 'all', label: '全部' }
            ].map(v => (
              <button
                key={v.id}
                onClick={() => setStatView(v.id)}
                className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${statView === v.id ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-gray-800 text-lg truncate" title={statTitle}>{statTitle}</h3>
          </div>

          <div className="mb-6">
            <div className="text-sm text-gray-500 mb-1">总专注时长</div>
            <div className="text-4xl font-black text-gray-800 tracking-tight">{formatTime(totalPeriodSecs)}</div>
          </div>

          {/* 任务完成度卡片 */}
          <div className="flex gap-3 mb-8">
            <div className="flex-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div className="text-xs text-gray-500 mb-1 font-medium">计划任务</div>
              <div className="text-2xl font-bold text-gray-800">{totalPeriodTasks}</div>
            </div>
            <div className="flex-1 bg-green-50 p-3 rounded-xl border border-green-100">
              <div className="text-xs text-green-600 mb-1 font-medium">已完成</div>
              <div className="text-2xl font-bold text-green-700">{completedPeriodTasks}</div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">按 Subject 分布</div>
            {statsBySubject.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-4">所选范围内没有任务或专注记录</div>
            ) : (
              statsBySubject.map(stat => (
                <div key={stat.id} className="mb-4">
                  <div className="flex justify-between items-end mb-1.5">
                    <span className="font-medium text-gray-700 flex items-center gap-2 text-sm">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: stat.color }}></span>
                      {stat.name}
                    </span>
                    <div className="flex flex-col items-end">
                      <span className="text-gray-800 font-mono text-sm">{formatTime(stat.totalSecs)}</span>
                      {stat.totalTasks > 0 && (
                        <span className="text-[10px] text-gray-400 mt-0.5">
                          完成 {stat.completedTasks}/{stat.totalTasks} 任务
                        </span>
                      )}
                    </div>
                  </div>
                  {/* 时长占比进度条 */}
                  <div className={`w-full rounded-full h-1.5 overflow-hidden ${totalPeriodSecs > 0 ? 'bg-gray-100' : ''}`}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        backgroundColor: stat.color,
                        width: totalPeriodSecs > 0 ? `${Math.max(1, (stat.totalSecs / totalPeriodSecs) * 100)}%` : '0%'
                      }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- 弹窗组件: 新建 Subject ---
function SubjectModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(SUBJECT_COLORS[0]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) onSave(name.trim(), color);
  };

  return (
    <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl animate-in zoom-in-95 duration-200">
        <h3 className="text-xl font-bold mb-4">新建 Subject 项目</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
            <input
              autoFocus
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="例如: 英语学习、毕业论文..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">选择标志色</label>
            <div className="flex flex-wrap gap-2">
              {SUBJECT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full focus:outline-none transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-gray-800 scale-110' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">取消</button>
            <button type="submit" disabled={!name.trim()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 transition-colors">保存</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- 弹窗组件: 批量新建任务 (按日计划) ---
function BatchTaskModal({ subjects, onClose, onSave }) {
  const [targetDate, setTargetDate] = useState(formatDate(new Date()));
  const [activeTab, setActiveTab] = useState('manual'); // 'manual', 'text', 'image'

  // AI 智能识别状态
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiImage, setAiImage] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // 初始化：为当前每个 subject 提供一个空数组，且默认自带一条空输入框
  const [tasksGroup, setTasksGroup] = useState(() => {
    const init = {};
    subjects.forEach(sub => init[sub.id] = ['']);
    return init;
  });

  const handleAddTaskInput = (subjectId) => {
    setTasksGroup(prev => ({
      ...prev,
      [subjectId]: [...(prev[subjectId] || []), '']
    }));
  };

  const handleRemoveTaskInput = (subjectId, index) => {
    setTasksGroup(prev => {
      const list = [...(prev[subjectId] || [])];
      list.splice(index, 1);
      return { ...prev, [subjectId]: list };
    });
  };

  const updateTaskTitle = (subjectId, index, value) => {
    setTasksGroup(prev => {
      const list = [...(prev[subjectId] || [])];
      list[index] = value;
      return { ...prev, [subjectId]: list };
    });
  };

  // 核心：调用 AI 识别
  const handleAnalyze = async (type) => {
    setErrorMsg('');
    setIsAnalyzing(true);
    try {
      const apiKey = "";
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

      const subjectListStr = subjects.map(s => `ID: ${s.id}, Name: ${s.name}`).join('\n');
      const systemPrompt = `你是一个任务提取助手。请从用户输入的文本或图片中提取出所有的学习/工作任务，并将它们分类到最合适的 Subject 中。\n\n当前可选的 Subject 列表如下：\n${subjectListStr}\n\n如果不确定，请将其分发到最接近的一个 Subject ID 中。必须返回 JSON 格式。`;

      let parts = [];
      if (type === 'text') {
        if (!aiText.trim()) {
          setErrorMsg("请输入要识别的文本");
          setIsAnalyzing(false);
          return;
        }
        parts = [{ text: aiText }];
      } else if (type === 'image') {
        if (!aiImage) {
          setErrorMsg("请先上传图片");
          setIsAnalyzing(false);
          return;
        }
        const base64Data = aiImage.split(',')[1];
        const mimeType = aiImage.split(';')[0].split(':')[1];
        parts = [
          { text: "请提取这张图片中提到的所有待办任务。" },
          { inlineData: { mimeType: mimeType, data: base64Data } }
        ];
      }

      const payload = {
        contents: [{ parts: parts }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              tasks: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    title: { type: "STRING" },
                    subjectId: { type: "STRING" }
                  }
                }
              }
            }
          }
        }
      };

      const data = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textResponse) {
        const parsed = JSON.parse(textResponse);
        if (parsed.tasks && parsed.tasks.length > 0) {
          setTasksGroup(prev => {
            const next = { ...prev };
            parsed.tasks.forEach(t => {
              if (next[t.subjectId]) {
                // 如果该分类下当前只有一条空记录，则覆盖为空记录
                if (next[t.subjectId].length === 1 && next[t.subjectId][0] === '') {
                  next[t.subjectId] = [t.title];
                } else {
                  next[t.subjectId].push(t.title);
                }
              }
            });
            return next;
          });
          // 切换回手动面板，供用户进行二次确认
          setActiveTab('manual');
          setAiText('');
          setAiImage(null);
        } else {
          setErrorMsg("未能识别到具体任务，请修改输入后重试。");
        }
      } else {
        setErrorMsg("识别返回空结果，请重试。");
      }
    } catch (e) {
      setErrorMsg("服务暂时不可用或网络异常，请稍后重试。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
       setAiImage(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validTasks = [];
    Object.entries(tasksGroup).forEach(([subId, titles]) => {
      titles.forEach(title => {
        if (title.trim() !== '') {
          validTasks.push({ title: title.trim(), subjectId: subId });
        }
      });
    });

    if (validTasks.length > 0) {
      onSave(targetDate, validTasks);
    }
  };

  const validCount = Object.values(tasksGroup).flat().filter(t => t.trim() !== '').length;

  return (
    <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-5xl p-6 md:p-8 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl md:text-2xl font-bold flex items-center gap-3 text-gray-800">
            <CalendarDays className="w-7 h-7 text-indigo-500" />
            规划每日任务
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50" disabled={isAnalyzing}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 顶部标签切换栏 */}
        <div className="flex bg-gray-100 p-1 rounded-xl mb-6 w-full max-w-md mx-auto relative z-10">
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 flex justify-center items-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'manual' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <ListTodo className="w-4 h-4" /> 手动录入
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`flex-1 flex justify-center items-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'text' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <FileText className="w-4 h-4" /> 文本识别
          </button>
          <button
            onClick={() => setActiveTab('image')}
            className={`flex-1 flex justify-center items-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'image' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <ImagePlus className="w-4 h-4" /> 图片识别
          </button>
        </div>

        {subjects.length === 0 ? (
          <div className="text-center py-12 flex-1 flex flex-col items-center justify-center">
            <ListTodo className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-500 mb-6">请先在左侧菜单创建一个 Subject 项目</p>
            <button onClick={onClose} className="px-5 py-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-medium rounded-xl transition-colors">我知道了</button>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">

            {/* 统一提示错误区 */}
            {errorMsg && (
              <div className="mb-4 bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm border border-red-100 flex items-center justify-between">
                <span>{errorMsg}</span>
                <button onClick={() => setErrorMsg('')}><X className="w-4 h-4" /></button>
              </div>
            )}

            {/* --------- 面板 1: 手动录入 (兼做二次确认) --------- */}
            {activeTab === 'manual' && (
              <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden animate-in fade-in duration-300">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4 bg-indigo-50/50 p-4 md:px-6 rounded-2xl border border-indigo-100/50">
                  <label className="text-sm font-bold text-gray-700 whitespace-nowrap">统一计划日期：</label>
                  <input
                    type="date"
                    className="border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm font-medium text-gray-700"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    required
                  />
                  <span className="text-sm text-gray-500">将下方填写的任务统一安排在此日期执行</span>
                </div>

                {/* 自动分栏显示的 Subjects 卡片 */}
                <div className="flex-1 overflow-y-auto mb-6 custom-scrollbar pr-2">
                  <div className={`grid gap-6 items-start ${subjects.length === 1 ? 'grid-cols-1 max-w-lg mx-auto' : subjects.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                    {subjects.map(sub => (
                      <div key={sub.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col">
                        <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-100">
                          <span className="w-4 h-4 rounded-full shadow-inner flex-shrink-0" style={{ backgroundColor: sub.color }}></span>
                          <h4 className="font-bold text-lg text-gray-800 truncate" title={sub.name}>{sub.name}</h4>
                        </div>

                        <div className="space-y-3 flex-1 mb-5">
                          {(tasksGroup[sub.id] || []).map((title, index) => (
                            <div key={index} className="flex items-center gap-2 group relative">
                              <input
                                type="text"
                                className="flex-1 border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm w-full transition-all pr-10"
                                placeholder={`任务 ${index + 1}...`}
                                value={title}
                                onChange={(e) => updateTaskTitle(sub.id, index, e.target.value)}
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveTaskInput(sub.id, index)}
                                className="absolute right-2 text-gray-400 hover:text-red-500 p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                title="移除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          {(!tasksGroup[sub.id] || tasksGroup[sub.id].length === 0) && (
                            <div className="text-center text-sm text-gray-400 py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                              暂无任务安排
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddTaskInput(sub.id)}
                          className="text-sm font-medium flex items-center justify-center gap-2 py-2.5 w-full text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-dashed border-gray-300 hover:border-indigo-300"
                        >
                          <Plus className="w-4 h-4" /> 继续添加
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end items-center pt-5 border-t border-gray-100 gap-4 mt-auto">
                  <button type="button" onClick={onClose} className="px-6 py-3 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium">取消并丢弃</button>
                  <button type="submit" disabled={validCount === 0} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-50 transition-all font-medium shadow-md shadow-indigo-200 hover:shadow-lg active:scale-95 text-lg flex items-center gap-2">
                    保存今日计划
                    <span className="bg-white/20 text-white px-2 py-0.5 rounded-md text-sm">{validCount}</span>
                  </button>
                </div>
              </form>
            )}

            {/* --------- 面板 2: 文本智能识别 --------- */}
            {activeTab === 'text' && (
              <div className="flex flex-col flex-1 overflow-hidden animate-in fade-in duration-300 bg-gray-50/50 rounded-2xl border border-gray-100 p-6 relative">
                <div className="mb-4">
                  <h4 className="font-bold text-gray-800 text-lg mb-2 flex items-center gap-2"><Wand2 className="w-5 h-5 text-indigo-500" /> 粘贴你的计划文本</h4>
                  <p className="text-sm text-gray-500">AI 将自动为你提取任务并分配到对应的 Subject 中。例如："今天做完数学第二章练习，背诵英语单词50个，并完成语文作文。"</p>
                </div>

                <textarea
                  className="flex-1 w-full border border-gray-200 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none shadow-inner"
                  placeholder="在此粘贴或输入计划文本..."
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  disabled={isAnalyzing}
                />

                <div className="flex justify-end pt-6 mt-auto">
                  <button
                    onClick={() => handleAnalyze('text')}
                    disabled={!aiText.trim() || isAnalyzing}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-50 transition-all font-medium shadow-md shadow-indigo-200 hover:shadow-lg active:scale-95 flex items-center gap-2"
                  >
                    {isAnalyzing ? <><Loader2 className="w-5 h-5 animate-spin" /> 正在识别分析...</> : <><Wand2 className="w-5 h-5" /> 智能提取任务</>}
                  </button>
                </div>
              </div>
            )}

            {/* --------- 面板 3: 图片智能识别 --------- */}
            {activeTab === 'image' && (
              <div className="flex flex-col flex-1 overflow-hidden animate-in fade-in duration-300 bg-gray-50/50 rounded-2xl border border-gray-100 p-6 relative">
                <div className="mb-4">
                  <h4 className="font-bold text-gray-800 text-lg mb-2 flex items-center gap-2"><ImagePlus className="w-5 h-5 text-indigo-500" /> 拍摄或上传你的计划表</h4>
                  <p className="text-sm text-gray-500">手写的作业本记录、备忘录截图都可以直接上传，AI 会帮你自动录入面板。</p>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl bg-white relative overflow-hidden transition-colors hover:border-indigo-400 group">
                  {aiImage ? (
                    <>
                      <img src={aiImage} alt="Preview" className="w-full h-full object-contain absolute inset-0 p-2" />
                      <div className="absolute inset-0 bg-gray-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                        <label className="cursor-pointer bg-white text-gray-800 px-4 py-2 rounded-lg font-medium shadow-lg hover:bg-gray-50">
                          更换图片
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isAnalyzing} />
                        </label>
                      </div>
                    </>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer text-gray-400 hover:text-indigo-500 transition-colors">
                      <UploadCloud className="w-12 h-12 mb-3" />
                      <span className="font-medium text-lg mb-1">点击选择或拖拽图片到这里</span>
                      <span className="text-sm">支持 JPG, PNG 等常见格式</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isAnalyzing} />
                    </label>
                  )}
                </div>

                <div className="flex justify-end pt-6 mt-auto">
                  <button
                    onClick={() => handleAnalyze('image')}
                    disabled={!aiImage || isAnalyzing}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-50 transition-all font-medium shadow-md shadow-indigo-200 hover:shadow-lg active:scale-95 flex items-center gap-2"
                  >
                    {isAnalyzing ? <><Loader2 className="w-5 h-5 animate-spin" /> 正在识别分析...</> : <><Wand2 className="w-5 h-5" /> 提取图片任务</>}
                  </button>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
