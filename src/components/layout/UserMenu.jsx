import React from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Settings, Bell } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function UserMenu() {
  const { userProfile: user } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  if (!user) {
    return null;
  }

  const userInitial = user.full_name?.charAt(0).toUpperCase() || 'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-9 h-9 rounded-full bg-[#ffc233] flex items-center justify-center text-white font-bold text-sm hover:opacity-90 transition-opacity">
          {userInitial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col space-y-1 py-2">
          <p className="text-sm font-semibold text-[#121217]">{user.full_name}</p>
          <p className="text-xs text-[#6c6c89]">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => window.location.href = createPageUrl('Profile')}
        >
          <User className="mr-2 h-4 w-4" />
          <span>Meu Perfil</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => window.location.href = createPageUrl('Profile')}
        >
          <Bell className="mr-2 h-4 w-4" />
          <span>Notificações</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" disabled>
          <Settings className="mr-2 h-4 w-4" />
          <span>Configurações</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair da Conta</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
