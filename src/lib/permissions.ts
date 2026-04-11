import { WorkspaceRole } from '@/types'

/**
 * Permission matrix for workspace roles.
 *
 * Admin: full access to everything
 * Setter: leads (assigned), calls, follow-ups, messages, personal stats
 * Closer: closing leads (assigned), calls, deal amounts, personal stats
 */

export interface PermissionSet {
  // Leads
  viewAllLeads: boolean
  viewAssignedLeads: boolean
  createLead: boolean
  deleteLead: boolean
  assignLead: boolean

  // Calls
  viewAllCalls: boolean
  viewAssignedCalls: boolean
  createCall: boolean

  // Closing
  closeDeal: boolean
  viewFinancials: boolean

  // Admin
  manageTeam: boolean
  manageSettings: boolean
  manageIntegrations: boolean
  manageAutomations: boolean
  manageEmails: boolean
  manageFunnels: boolean

  // Stats
  viewGlobalStats: boolean
  viewPersonalStats: boolean

  // Other
  useAiAssistant: boolean
  viewMessages: boolean
  viewAgenda: boolean
}

const ADMIN_PERMISSIONS: PermissionSet = {
  viewAllLeads: true,
  viewAssignedLeads: true,
  createLead: true,
  deleteLead: true,
  assignLead: true,
  viewAllCalls: true,
  viewAssignedCalls: true,
  createCall: true,
  closeDeal: true,
  viewFinancials: true,
  manageTeam: true,
  manageSettings: true,
  manageIntegrations: true,
  manageAutomations: true,
  manageEmails: true,
  manageFunnels: true,
  viewGlobalStats: true,
  viewPersonalStats: true,
  useAiAssistant: true,
  viewMessages: true,
  viewAgenda: true,
}

const SETTER_PERMISSIONS: PermissionSet = {
  viewAllLeads: false,
  viewAssignedLeads: true,
  createLead: true,
  deleteLead: false,
  assignLead: false,
  viewAllCalls: false,
  viewAssignedCalls: true,
  createCall: true,
  closeDeal: false,
  viewFinancials: false,
  manageTeam: false,
  manageSettings: false,
  manageIntegrations: false,
  manageAutomations: false,
  manageEmails: false,
  manageFunnels: false,
  viewGlobalStats: false,
  viewPersonalStats: true,
  useAiAssistant: true,
  viewMessages: true,
  viewAgenda: true,
}

const CLOSER_PERMISSIONS: PermissionSet = {
  viewAllLeads: false,
  viewAssignedLeads: true,
  createLead: false,
  deleteLead: false,
  assignLead: false,
  viewAllCalls: false,
  viewAssignedCalls: true,
  createCall: true,
  closeDeal: true,
  viewFinancials: false,
  manageTeam: false,
  manageSettings: false,
  manageIntegrations: false,
  manageAutomations: false,
  manageEmails: false,
  manageFunnels: false,
  viewGlobalStats: false,
  viewPersonalStats: true,
  useAiAssistant: true,
  viewMessages: true,
  viewAgenda: true,
}

const PERMISSIONS_BY_ROLE: Record<WorkspaceRole, PermissionSet> = {
  admin: ADMIN_PERMISSIONS,
  setter: SETTER_PERMISSIONS,
  closer: CLOSER_PERMISSIONS,
}

/**
 * Get the permission set for a given role.
 */
export function getPermissions(role: WorkspaceRole): PermissionSet {
  return PERMISSIONS_BY_ROLE[role]
}

/**
 * Check a single permission for a role.
 */
export function hasPermission(role: WorkspaceRole, permission: keyof PermissionSet): boolean {
  return PERMISSIONS_BY_ROLE[role][permission]
}

/**
 * Sidebar routes visibility per role.
 * If a route is not listed, it's visible to all roles.
 */
export const ROUTE_VISIBILITY: Record<string, WorkspaceRole[]> = {
  '/dashboard': ['admin', 'setter', 'closer'],
  '/agenda': ['admin', 'setter', 'closer'],
  '/leads': ['admin', 'setter', 'closer'],
  '/closing': ['admin', 'setter', 'closer'],
  '/follow-ups': ['admin', 'setter', 'closer'],
  '/statistiques': ['admin'],
  '/base-de-donnees': ['admin'],
  '/acquisition/funnels': ['admin'],
  '/acquisition/automations': ['admin'],
  '/acquisition/emails': ['admin'],
  '/acquisition/reseaux-sociaux': ['admin'],
  '/acquisition/messages': ['admin', 'setter', 'closer'],
  '/acquisition/publicites': ['admin'],
  '/parametres/reglages': ['admin'],
  '/parametres/integrations': ['admin'],
  '/parametres/calendriers': ['admin'],
  '/parametres/equipe': ['admin'],
  '/parametres/assistant-ia': ['admin', 'setter', 'closer'],
  '/equipe/messages': ['admin', 'setter', 'closer'],
}

/**
 * Check if a route is visible for a given role.
 * Routes not in ROUTE_VISIBILITY are visible to all.
 */
export function isRouteVisible(route: string, role: WorkspaceRole): boolean {
  const allowedRoles = ROUTE_VISIBILITY[route]
  if (!allowedRoles) return true // not restricted
  return allowedRoles.includes(role)
}
