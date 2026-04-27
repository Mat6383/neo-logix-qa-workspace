import { renderHook, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { DashboardProvider } from '../../contexts/DashboardContext';
import { useDashboard } from '../useDashboard';

vi.mock('../../services/api.service', () => ({
  default: {
    healthCheck: vi.fn().mockResolvedValue({ status: 'OK' }),
    getProjects: vi.fn().mockResolvedValue({ success: true, data: { result: [{ id: 1, name: 'Neo Pilot' }] } }),
    getDashboardMetrics: vi.fn().mockResolvedValue({ success: true, data: { completionRate: 90, passRate: 95 } }),
    getQualityRates: vi.fn().mockResolvedValue({ success: true, data: {} }),
  },
}));

const wrapper = ({ children }) => <DashboardProvider>{children}</DashboardProvider>;

describe('useDashboard', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('throws when used without DashboardProvider', () => {
    expect(() => renderHook(() => useDashboard())).toThrow(
      'useDashboard must be used within DashboardProvider'
    );
  });

  it('exposes required state and functions', () => {
    const { result } = renderHook(() => useDashboard(), { wrapper });
    expect(typeof result.current.projectId).toBe('number');
    expect(typeof result.current.setProjectId).toBe('function');
    expect(typeof result.current.loadDashboardMetrics).toBe('function');
    expect(typeof result.current.setAutoRefresh).toBe('function');
  });

  it('defaults projectId to 1 when no localStorage entry', () => {
    const { result } = renderHook(() => useDashboard(), { wrapper });
    expect(result.current.projectId).toBe(1);
  });

  it('restores projectId from localStorage', () => {
    localStorage.setItem('testmo_projectId', '42');
    const { result } = renderHook(() => useDashboard(), { wrapper });
    expect(result.current.projectId).toBe(42);
  });

  it('setProjectId updates projectId and persists to localStorage', () => {
    const { result } = renderHook(() => useDashboard(), { wrapper });
    act(() => result.current.setProjectId(7));
    expect(result.current.projectId).toBe(7);
    expect(localStorage.getItem('testmo_projectId')).toBe('7');
  });

  it('starts with autoRefresh=true', () => {
    const { result } = renderHook(() => useDashboard(), { wrapper });
    expect(result.current.autoRefresh).toBe(true);
  });

  it('setAutoRefresh toggles autoRefresh', () => {
    const { result } = renderHook(() => useDashboard(), { wrapper });
    act(() => result.current.setAutoRefresh(false));
    expect(result.current.autoRefresh).toBe(false);
  });

  it('loads projects on mount', async () => {
    const { result } = renderHook(() => useDashboard(), { wrapper });
    await waitFor(() => expect(result.current.projects.length).toBeGreaterThan(0));
    expect(result.current.projects[0].name).toBe('Neo Pilot');
  });

  it('sets backendStatus to ok after successful health check', async () => {
    const { result } = renderHook(() => useDashboard(), { wrapper });
    await waitFor(() => expect(result.current.backendStatus).toBe('ok'));
  });
});
