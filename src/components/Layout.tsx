import React from 'react';
import { Home, Users, Package, DollarSign, User as UserIcon, Bell, PieChart } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
  const tabs = [
    { id: 'agenda', icon: Home, label: 'Agenda' },
    { id: 'clientes', icon: Users, label: 'Clientes' },
    { id: 'materiales', icon: Package, label: 'Stock' },
    { id: 'finanzas', icon: DollarSign, label: 'Caja' },
    { id: 'reportes', icon: PieChart, label: 'Reportes' },
    { id: 'perfil', icon: UserIcon, label: 'Perfil' },
  ];

  return (
    <div className="flex flex-col h-screen bg-brand-pink-light overflow-hidden">
      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {children}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="bg-white/80 backdrop-blur-md border-t border-brand-pink px-6 py-2 pb-4 flex justify-between items-center z-40">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 transition-all duration-300",
                isActive ? "text-brand-accent scale-110" : "text-slate-300"
              )}
            >
              <div className={cn(
                "p-2 rounded-2xl transition-all",
                isActive && "bg-brand-pink"
              )}>
                <Icon className={cn("w-6 h-6", isActive ? "stroke-[2.5px]" : "stroke-2")} />
              </div>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
