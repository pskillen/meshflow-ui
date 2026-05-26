import { Link, useLocation } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

function getBreadcrumbSegments(pathname: string): { path: string; label: string }[] {
  const segments: { path: string; label: string }[] = [{ path: '/', label: 'MeshFlow' }];
  const parts = pathname.split('/').filter(Boolean);

  if (parts.length === 0) return segments;

  if (parts[0] === 'nodes') {
    segments.push({ path: '/nodes', label: 'Nodes' });
    if (parts[1] === 'infrastructure') {
      segments.push({ path: '/nodes/infrastructure', label: 'Infrastructure' });
      if (parts[2] === 'export') {
        segments.push({ path: '/nodes/infrastructure/export', label: 'Export' });
      }
    } else if (parts[1] === 'my-nodes') {
      segments.push({ path: '/nodes/my-nodes', label: 'My Nodes' });
    } else if (parts[1] === 'monitor') {
      segments.push({ path: '/nodes/monitor', label: 'Watches' });
    } else if (parts[1] && /^\d+$/.test(parts[1])) {
      segments.push({ path: `/nodes/${parts[1]}`, label: parts[1] });
      if (parts[2] === 'claim') {
        segments.push({ path: `/nodes/${parts[1]}/claim`, label: 'Claim' });
      }
    }
  } else if (parts[0] === 'weather') {
    segments.push({ path: '/weather', label: 'Weather' });
  } else if (parts[0] === 'meshcore' && parts[1] === 'infrastructure') {
    segments.push({ path: '/meshcore/nodes', label: 'MeshCore Nodes' });
    segments.push({ path: '/meshcore/infrastructure', label: 'Infrastructure' });
  } else if (parts[0] === 'messages') {
    segments.push({ path: '/messages', label: 'Messages' });
  } else if (parts[0] === 'user') {
    segments.push({ path: '/user', label: 'User' });
    if (parts[1] === 'nodes') {
      segments.push({ path: '/user/nodes', label: 'Node Settings' });
    } else if (parts[1] === 'settings') {
      segments.push({ path: '/user/settings', label: 'Settings' });
    }
  }

  return segments;
}

export function SiteBreadcrumb() {
  const { pathname } = useLocation();

  const segments = getBreadcrumbSegments(pathname);

  if (segments.length <= 1) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.flatMap((seg, i) => {
          const item = (
            <BreadcrumbItem key={seg.path}>
              {i < segments.length - 1 ? (
                <BreadcrumbLink asChild>
                  <Link to={seg.path}>{seg.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{seg.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          );
          const separator = i < segments.length - 1 ? <BreadcrumbSeparator key={`sep-${i}`} /> : null;
          return [item, separator].filter(Boolean);
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
