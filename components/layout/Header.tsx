'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';


type NotificationTask = {
  id: string;
  type: string;
  priority: 'critical' | 'warning' | 'info';
  title: string;
  entityName: string;
  dueDate: string;
  status: string;
  url: string;
};

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);


  const [tasks, setTasks] = useState<NotificationTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const notificationRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        setQuery('');
        inputRef.current?.blur();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () =>
      document.removeEventListener('mousedown', handleClickOutside);
  },
    []);

  useEffect(() => {
    loadTasks();
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  async function loadTasks() {
    try {
      setLoadingTasks(true);

      const res = await fetch('/api/notifications/tasks');
      if (!res.ok) return;
      const json = await res.json();
      setTasks(json.tasks);
    }
    catch (err) {
      console.error(err);
    }

    finally {
      setLoadingTasks(false);
    }
  }
  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        <form onSubmit={handleSearch} className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search… (⌘K)"
            className="pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 transition-all focus:w-80"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => {
              const opening = !showNotifications;

              setShowNotifications(opening);

              if (opening) {
                loadTasks();
              }
            }}
            className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Bell className="w-5 h-5 text-gray-600" />
            {tasks.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center border-2 border-white">
                {tasks.length > 99 ? '99+' : tasks.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-3 w-96 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-50">

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Notifications
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Your pending actions
                  </p>
                </div>

                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500">
                  {tasks.length} Pending
                </span>
              </div>

              {/* Empty State */}
              {loadingTasks ? (

                <div className="px-5 py-8 text-center text-sm text-gray-500">
                  Loading notifications...
                </div>

              ) : tasks.length === 0 ? (

                <div className="px-5 py-10 flex flex-col items-center text-center">

                  <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <Bell className="w-6 h-6 text-gray-400" />
                  </div>

                  <h4 className="text-sm font-medium text-gray-900">
                    No pending actions
                  </h4>

                  <p className="text-sm text-gray-500 mt-2 max-w-xs">
                    You're all caught up.
                  </p>

                </div>

              ) : (

                <div className="max-h-96 overflow-y-auto">

                  {tasks.map(task => (

                    <button
                      key={task.id}
                      onClick={() => {
                        setShowNotifications(false);
                        router.push(task.url);
                      }}
                      className="w-full text-left px-5 py-4 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >

                      <div className="flex items-start gap-3">

                        <div
                          className={`mt-1 h-2.5 w-2.5 rounded-full ${task.priority === 'critical'
                            ? 'bg-red-500'
                            : task.priority === 'warning'
                              ? 'bg-amber-500'
                              : 'bg-blue-500'
                            }`}
                        />

                        <div className="flex-1">

                          <p
                            className="text-sm font-medium text-gray-900 truncate"
                            title={task.title}
                          >
                            {task.title}
                          </p>

                          <p className="text-xs text-gray-500 mt-1">
                            {task.entityName}
                          </p>

                          <p className="text-xs mt-2 font-medium text-indigo-600">
                            {task.status}
                          </p>

                        </div>

                      </div>

                    </button>

                  ))}

                </div>

              )}

              {/* Footer */}
              <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
                <button
                  onClick={() => {
                    setShowNotifications(false);
                    router.push('/compliance');
                  }}
                  className="w-full text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  View Compliance →
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full border">
          {today}
        </div>
      </div>
    </header>
  );
}
