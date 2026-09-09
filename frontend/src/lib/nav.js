import {
  UsersRound,
  LineChart,
  PhoneCall,
  LayoutDashboard,
  Upload,
  Database,
  Activity,
  Layers,
} from 'lucide-react';

export const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, shortLabel: 'Overview', group: 'Workspace' },
  { id: 'records', label: 'Records', icon: Database, shortLabel: 'Records', group: 'Workspace' },
  { id: 'queue', label: 'Call queue', icon: PhoneCall, shortLabel: 'Queue', group: 'Workspace' },
  { id: 'upload', label: 'Upload registers', icon: Upload, shortLabel: 'Upload', group: 'Pipeline' },
  { id: 'jobs', label: 'Processing jobs', icon: Activity, shortLabel: 'Jobs', group: 'Pipeline' },
  { id: 'mapping', label: 'Column schema', icon: Layers, shortLabel: 'Schema', group: 'Pipeline' },
  { id: 'team', label: 'Team accounts', icon: UsersRound, shortLabel: 'Team', group: 'Admin', minRank: 3 },
  { id: 'executive', label: 'Executive view', icon: LineChart, shortLabel: 'Exec', group: 'Admin', minRank: 4 },
];
