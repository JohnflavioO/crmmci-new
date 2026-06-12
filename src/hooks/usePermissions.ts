import { useAuth } from './useAuth';

export type PermissionKey = 
  | 'products.view' | 'products.create' | 'products.edit' | 'products.delete'
  | 'clients.view' | 'clients.create' | 'clients.edit' | 'clients.delete'
  | 'quotes.view' | 'quotes.create' | 'quotes.edit' | 'quotes.delete' | 'quotes.approve'
  | 'pipeline.view' | 'pipeline.move'
  | 'financial.view' | 'financial.edit' | 'financial.pay'
  | 'logistics.view' | 'logistics.edit' | 'logistics.upload_nf'
  | 'support.view' | 'support.create_os' | 'support.edit_os' | 'support.status_os'
  | 'contracts.use'
  | 'users.manage_permissions';

export const getDefaultPermissionForRole = (key: PermissionKey, role?: string | null, isAdmin = false, isGestor = false): boolean => {
  if (isAdmin) return true;
  switch (key) {
    case 'products.view':
    case 'clients.view':
    case 'clients.create':
    case 'clients.edit':
    case 'quotes.view':
    case 'quotes.create':
    case 'quotes.edit':
    case 'pipeline.view':
    case 'pipeline.move':
      return true;
    case 'products.create':
    case 'products.edit':
    case 'products.delete':
    case 'clients.delete':
    case 'quotes.approve':
    case 'quotes.delete':
    case 'users.manage_permissions':
    case 'contracts.use':
      return isGestor;
    case 'financial.view':
      return isGestor || role === 'financeiro';
    case 'financial.edit':
    case 'financial.pay':
      return role === 'financeiro';
    case 'logistics.view':
      return isGestor || role === 'logistica';
    case 'logistics.edit':
    case 'logistics.upload_nf':
      return role === 'logistica';
    case 'support.view':
      return isGestor || !!role?.startsWith('support');
    case 'support.create_os':
    case 'support.edit_os':
    case 'support.status_os':
      return !!role?.startsWith('support');
    default:
      return false;
  }
};


export const usePermissions = () => {
  const { isAdmin, isGestor, profile } = useAuth();
  
  const permissions = (profile as any)?.permissions || {};

  const hasPermission = (key: PermissionKey): boolean => {
    // Admin tem todas as permissões
    if (isAdmin) return true;
    
    // Se a permissão individual estiver explicitamente definida
    if (permissions[key] !== undefined) {
      return permissions[key] === true;
    }

    // Fallback para permissões baseadas no cargo (Role)
    const role = profile?.role;

    switch (key) {
      case 'products.view':
        return true; // Todos veem produtos por padrão
      case 'products.create':
      case 'products.edit':
      case 'products.delete':
        return isGestor;
      
      case 'clients.view':
        return true;
      case 'clients.create':
      case 'clients.edit':
        return true;
      case 'clients.delete':
        return isGestor;

      case 'quotes.view':
      case 'quotes.create':
      case 'quotes.edit':
        return true;
      case 'quotes.approve':
      case 'quotes.delete':
        return isGestor;

      case 'pipeline.view':
      case 'pipeline.move':
        return true;

      case 'financial.view':
        return isGestor || role === 'financeiro';
      case 'financial.edit':
      case 'financial.pay':
        return role === 'financeiro';

      case 'logistics.view':
        return isGestor || role === 'logistica';
      case 'logistics.edit':
      case 'logistics.upload_nf':
        return role === 'logistica';

      case 'support.view':
        return isGestor || role?.startsWith('support');
      case 'support.create_os':
      case 'support.edit_os':
      case 'support.status_os':
        return role?.startsWith('support');

      case 'users.manage_permissions':
        return isGestor;

      default:
        return false;
    }
  };

  return { hasPermission, permissions };
};
