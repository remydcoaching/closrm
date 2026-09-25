// Route-based tab bar (same look as <Tabs>), rendered above every page of a
// tab group — see app/tab-groups.ts.
import { NavLink, Outlet } from 'react-router-dom'
import type { TabGroup } from '../app/tab-groups'
import './tabs.css'

export function PageTabs({ group }: { group: TabGroup }) {
  return (
    <div className="ds-tabs ds-page-tabs">
      {group.tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end className={({ isActive }) => `ds-tab ${isActive ? 'ds-tab--active' : ''}`}>
          {tab.label}
        </NavLink>
      ))}
    </div>
  )
}

/** Layout route: tab bar on top, the active tab's page below. */
export function TabGroupLayout({ group }: { group: TabGroup }) {
  return (
    <div className="ds-tab-group-layout">
      <PageTabs group={group} />
      <div className="ds-tab-group-body">
        <Outlet />
      </div>
    </div>
  )
}
