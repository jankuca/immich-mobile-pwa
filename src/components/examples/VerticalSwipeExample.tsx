import { h } from 'preact';
import { useState } from 'preact/hooks';
import useVerticalSwipe from '../../hooks/useVerticalSwipe';

interface VerticalSwipeExampleProps {
  onClose: () => void;
  title: string;
  content: string;
}

/**
 * Example component showing how to use the useVerticalSwipe hook
 * in a simple modal/overlay component.
 */
const VerticalSwipeExample = ({ onClose, title, content }: VerticalSwipeExampleProps) => {
  const [isAtTop, setIsAtTop] = useState(true);
  
  // Use the vertical swipe hook
  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    containerStyle,
    backgroundOpacity
  } = useVerticalSwipe({
    onClose,
    isAtTop,
    threshold: 0.15 // Close when swiped down 15% of the max distance
  });
  
  // Handle scroll to detect if we're at the top
  const handleScroll = (e: Event) => {
    const target = e.target as HTMLElement;
    setIsAtTop(target.scrollTop <= 10);
  };
  
  return (
    <div 
      class="vertical-swipe-example"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)'
      }}
    >
      <div
        class="modal-container"
        style={{
          width: '90%',
          maxWidth: '500px',
          maxHeight: '80%',
          backgroundColor: `rgba(255, 255, 255, ${backgroundOpacity})`,
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          ...containerStyle
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          class="modal-content"
          style={{
            height: '100%',
            overflowY: 'auto'
          }}
          onScroll={handleScroll}
        >
          <div style={{ padding: '20px' }}>
            <div 
              style={{ 
                width: '40px', 
                height: '5px', 
                backgroundColor: '#ccc', 
                borderRadius: '3px',
                margin: '0 auto 20px'
              }}
            />
            <h2 style={{ marginBottom: '15px' }}>{title}</h2>
            <p>{content}</p>
            
            {/* Add some extra content to make it scrollable */}
            <div style={{ marginTop: '20px' }}>
              <p>Swipe down from the top to close this modal.</p>
              <p>If you've scrolled down, you'll need to scroll back to the top before you can swipe to close.</p>
              <div style={{ height: '800px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <p>Start of extra content</p>
                <p>End of extra content - scroll back to top to enable swipe-to-close</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerticalSwipeExample;
