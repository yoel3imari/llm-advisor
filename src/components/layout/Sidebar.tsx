import { Cpu, Sparkles, FolderDown, PlayCircle, Settings } from 'lucide-react';
import type { ServerState } from '../../types/domain';
import { ServerStatusPill } from './ServerStatusPill';

export type NavTab = 'dashboard' | 'recommendations' | 'library' | 'server' | 'settings';

interface Props {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  serverState: ServerState;
}

export function Sidebar({ activeTab, onSelectTab, serverState }: Props) {
  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: Cpu },
    { id: 'recommendations' as NavTab, label: 'Recommendations', icon: Sparkles },
    { id: 'library' as NavTab, label: 'Library', icon: FolderDown },
    { id: 'server' as NavTab, label: 'Server Control', icon: PlayCircle },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col justify-between p-4 select-none">
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-white leading-none">Local LLM Advisor</h1>
            <p className="text-[11px] text-zinc-400 mt-1">Apple Intel Memory Fit</p>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-zinc-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 pt-4 border-t border-zinc-800/80">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-zinc-400">Gateway Status</span>
          <ServerStatusPill state={serverState} />
        </div>
      </div>
    </aside>
  );
}
