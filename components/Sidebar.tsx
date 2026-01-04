
import React from 'react';
import { View } from '../types';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, isOpen, onClose }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Início', icon: '🏠' },
    { id: 'processos', label: 'Processos', icon: '📁' },
    { id: 'contatos', label: 'Clientes', icon: '👥' },
    { id: 'audiencias', label: 'Audiências', icon: '⚖️' },
    { id: 'agenda', label: 'Agenda', icon: '📅' },
    { id: 'faturamento', label: 'Financeiro', icon: '💰' },
    { id: 'estudio-ia', label: 'LexAI Studio', icon: '✨' },
    { id: 'relatorios', label: 'Relatórios', icon: '📊' },
  ];

  const handleNav = (view: View) => {
    onViewChange(view);
    if (window.innerWidth < 1024) onClose();
  };

  const logoUrl = "https://lh3.googleusercontent.com/d/1gfZj1_zgtC6UnRqJDk_D1Z9ZIIdAG5Yy"; 

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm" onClick={onClose} />
      )}
      
      <div className={`
        fixed lg:sticky top-0 left-0 z-50
        w-20 h-screen graphite-dark border-r border-gray-800 
        flex flex-col transition-all duration-500 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-8 flex flex-col gap-2 text-left items-center">
          <div className="flex items-center gap-2">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <img 
                src={logoUrl} 
                alt="Logo LexAI" 
                className="w-full h-full object-contain logo-img"
              />
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto no-scrollbar pb-10">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id as View)}
              title={item.label}
              className={`w-full flex items-center justify-center px-0 py-3.5 rounded-2xl transition-all group ${
                currentView === item.id 
                ? 'bg-[#D4AF37] text-black shadow-[0_10px_20px_rgba(212,175,55,0.2)]' 
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className={`text-lg transition-transform group-hover:scale-125 ${currentView === item.id ? 'scale-110' : ''}`}>{item.icon}</span>
            </button>
          ))}
        </nav>
        
        <div className="p-8 border-t border-gray-800 flex justify-center p-4">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
