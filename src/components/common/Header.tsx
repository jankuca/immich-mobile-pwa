import { h } from 'preact';

interface HeaderProps {
  title: string;
  showBackButton?: boolean;
  rightAction?: {
    icon: preact.ComponentChildren;
    onClick: () => void;
  };
}

const Header = ({ title, showBackButton = false, rightAction }: HeaderProps) => {
  const handleBack = () => {
    window.history.back();
  };

  return (
    <header class="ios-header">
      {showBackButton && (
        <button 
          class="ios-header-back-button" 
          onClick={handleBack}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--color-primary)',
            fontSize: 'var(--font-size-md)',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 19L5 12L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span style={{ marginLeft: 'var(--spacing-xs)' }}>Back</span>
        </button>
      )}
      
      <h1 class="ios-header-title" style={{ 
        flex: 1, 
        textAlign: showBackButton ? 'center' : 'left',
        marginLeft: showBackButton ? 0 : 'var(--spacing-md)'
      }}>
        {title}
      </h1>
      
      {rightAction && (
        <button 
          class="ios-header-action" 
          onClick={rightAction.onClick}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--color-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {rightAction.icon}
        </button>
      )}
    </header>
  );
};

export default Header;
