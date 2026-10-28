import { useRef, useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar, SidebarOverlay } from './Sidebar';
import { useAuth } from '../auth/AuthContext';
import { authValue, clubAdminAccess, testClub } from '../test/authValue';

vi.mock('../auth/AuthContext');
vi.mock('../firebase/signOut', () => ({ signOutAndClearLocalData: vi.fn() }));
vi.mock('../interest/interestApi', () => ({ countUnreviewedInterestSignups: () => Promise.resolve(0) }));

const two = [
  { clubId: 'club-1', role: 'admin' as const, clubName: 'Volley Club Bologna', status: 'active' as const },
  { clubId: 'club-2', role: 'member' as const, clubName: 'Other Club', status: 'active' as const },
];

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue(
    authValue({
      access: clubAdminAccess,
      role: 'admin',
      club: testClub({ name: 'Volley Club Bologna' }),
      firebaseUser: { uid: 'u1', email: 'coach@example.com' } as never,
    })
  );
});

function renderSidebar(onNavigate?: () => void) {
  return render(
    <MemoryRouter initialEntries={['/teams']}>
      <Sidebar onNavigate={onNavigate} onSignOut={() => {}} />
    </MemoryRouter>
  );
}

describe('Sidebar', () => {
  it('shows club initials, name and role', () => {
    renderSidebar();
    expect(screen.getByText('VC')).toBeInTheDocument();
    expect(screen.getByText('Volley Club Bologna')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('club header is a switcher only with other usable clubs', () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ memberships: two, club: testClub({ name: 'Volley Club Bologna' }), role: 'admin' })
    );
    const { unmount } = renderSidebar();
    expect(screen.getByRole('button', { name: 'Club: Volley Club Bologna' })).toBeInTheDocument();
    unmount();
    vi.mocked(useAuth).mockReturnValue(authValue({ club: testClub({ name: 'Volley Club Bologna' }) }));
    renderSidebar();
    expect(screen.queryByRole('button', { name: /^Club:/ })).not.toBeInTheDocument();
  });

  it('marks the active item with aria-current', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: 'Teams' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current');
  });

  it('calls onNavigate when a link is clicked', () => {
    const onNavigate = vi.fn();
    renderSidebar(onNavigate);
    fireEvent.click(screen.getByRole('link', { name: 'Teams' }));
    expect(onNavigate).toHaveBeenCalled();
  });

  it('keeps the account menu items in order', () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Account: coach@example.com' }));
    const menu = screen.getByRole('menu', { name: 'Account: coach@example.com' });
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent?.trim())).toEqual(['Settings', 'Terms & privacy', 'Sign out']);
  });
});

function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <MemoryRouter initialEntries={['/teams']}>
      <button ref={ref}>Open navigation</button>
      <SidebarOverlay
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        returnFocusTo={ref}
        onSignOut={() => {}}
      />
    </MemoryRouter>
  );
}

describe('SidebarOverlay', () => {
  it('locks page scroll while open and restores the previous value', () => {
    document.body.style.overflow = 'scroll';
    const { unmount } = render(<Harness onClose={() => {}} />);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
    expect(document.documentElement.style.overflow).toBe('');
    document.body.style.overflow = '';
  });

  it('is a modal dialog labelled Main and focuses the first link', () => {
    render(<Harness onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Main' })).toHaveAttribute('aria-modal', 'true');
    const links = within(screen.getByRole('dialog')).getAllByRole('link');
    expect(document.activeElement?.getAttribute('href')).toBe('/');
    expect(links.length).toBeGreaterThan(0);
  });

  it('overlay closes on navigation', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'Teams' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('Esc returns focus to the trigger', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open navigation' }));
  });

  it('the scrim closes and returns focus to the trigger', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByTestId('sidebar-scrim'));
    expect(onClose).toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open navigation' }));
  });

  it('traps Tab inside the panel', () => {
    render(<Harness onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    const focusables = dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    const last = focusables[focusables.length - 1];
    last.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(focusables[0]);
  });
});
