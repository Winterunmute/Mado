// Cosmetic only. URL policy remains the navigation boundary. No conversation DOM is read.
export function messengerStyle(theme: 'light' | 'dark'): string {
  const dark = theme === 'dark'
  return `
    :root, .__fb-light-mode, .__fb-dark-mode {
      color-scheme: ${theme};
      --web-wash: ${dark ? '#0f0f1a' : '#fafafa'};
      --wash: ${dark ? '#1a1a2e' : '#f4f4f5'};
      --surface-background: ${dark ? '#161622' : '#ffffff'};
      --card-background: ${dark ? '#161622' : '#ffffff'};
      --messenger-card-background: ${dark ? '#161622' : '#ffffff'};
      --comment-background: ${dark ? '#252542' : '#f4f4f5'};
      --popover-background: ${dark ? '#1a1a2e' : '#ffffff'};
      --nav-bar-background: ${dark ? '#161622' : '#ffffff'};
      --primary-text: ${dark ? '#e4e4e7' : '#18181b'};
      --secondary-text: ${dark ? '#a1a1aa' : '#52525b'};
      --divider: ${dark ? '#2a2a4a' : '#e4e4e7'};
      --accent: ${dark ? '#3b82f6' : '#2563eb'};
      --blue-link: ${dark ? '#60a5fa' : '#2563eb'};
      --primary-button-background: ${dark ? '#3b82f6' : '#2563eb'};
      --primary-button-text: #ffffff;
      --button-background: ${dark ? '#252542' : '#f4f4f5'};
      --button-text: ${dark ? '#e4e4e7' : '#18181b'};
      --button-border-color: ${dark ? '#353555' : '#d4d4d8'};
      --search-background: ${dark ? '#1a1a2e' : '#f4f4f5'};
      --overlay-background: ${dark ? 'rgba(15,15,26,.82)' : 'rgba(250,250,250,.82)'};
      --hover-overlay: ${dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)'};
      --press-overlay: ${dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.07)'};
      --mado-radius: 8px;
    }
    html, body { height: 100%; margin: 0; overflow: hidden; color-scheme: ${theme}; background: var(--web-wash); color: var(--primary-text); }
    [role="main"] { min-height: 0; }
    * { scrollbar-width: thin; scrollbar-color: var(--divider) transparent; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--divider); border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }

    /* Facebook's global banner contains home branding, waffle and news navigation.
       Do not hide generic navigation: Messenger's conversation switcher needs it. */
    [role="banner"]:has(a[href="/"]),
    [role="banner"]:has(a[href="https://www.facebook.com/"]),
    [role="navigation"][aria-label="Facebook"] { display: none !important; }

    /* The hidden global banner still leaves a 56px reservation in Facebook's
       --header-height variable. On the current Messenger shell this pushes the
       conversation list down. Scope the correction to pages that actually have
       the Messenger conversation-list navigation, so login/error pages keep
       Facebook's own layout. */
    html:has([role="navigation"]) { --header-height: 0px !important; }
    div:has(> [role="navigation"]) { height: 100vh !important; max-height: 100vh !important; }
    div:has(> [role="navigation"]) > [role="navigation"] {
      margin-top: 16px !important;
      height: calc(100% - 16px) !important;
      max-height: calc(100% - 16px) !important;
    }
  `
}
