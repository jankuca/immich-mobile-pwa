# Custom Hooks

## useVerticalSwipe

A custom hook for handling vertical swipe gestures, particularly for closing a modal/viewer when swiping down from the top.

### Usage

```tsx
import useVerticalSwipe from '../hooks/useVerticalSwipe';

const MyComponent = ({ onClose }) => {
  const [isAtTop, setIsAtTop] = useState(true);
  
  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    containerStyle,
    backgroundOpacity,
    swipeDirection
  } = useVerticalSwipe({
    onClose,
    isAtTop,
    threshold: 0.1 // Close when swiped down 10% of the max distance
  });
  
  // Handle scroll to detect if we're at the top
  const handleScroll = (e) => {
    const target = e.target;
    setIsAtTop(target.scrollTop <= 10);
  };
  
  return (
    <div 
      style={{
        ...containerStyle,
        backgroundColor: `rgba(255, 255, 255, ${backgroundOpacity})`
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onScroll={handleScroll}
    >
      {/* Your content here */}
    </div>
  );
};
```

### Parameters

The hook accepts an object with the following properties:

- `onClose`: Function to call when the swipe gesture should close the component
- `isAtTop` (optional): Boolean indicating if the scrollable content is at the top. Defaults to `true`
- `threshold` (optional): Number between 0 and 1 indicating what fraction of the maximum swipe distance should trigger closing. Defaults to `0.1` (10%)

### Return Value

The hook returns an object with the following properties:

- `startY`: The Y coordinate where the touch started
- `startX`: The X coordinate where the touch started
- `swipeDirection`: Either 'horizontal', 'vertical', or null
- `handleTouchStart`: Function to handle touch start events
- `handleTouchMove`: Function to handle touch move events
- `handleTouchEnd`: Function to handle touch end events
- `containerStyle`: Style object with transform property for the container
- `backgroundOpacity`: Number between 0 and 1 for background opacity based on swipe progress

### Example Components

- `PhotoViewer.tsx`: Uses the hook in combination with horizontal swipe logic
- `VerticalSwipeExample.tsx`: A simple example component showing basic usage

### Implementation Details

The hook handles:

1. Detecting whether a swipe is primarily vertical or horizontal
2. Tracking vertical swipe progress
3. Moving the container to follow the finger during a swipe
4. Adjusting background opacity based on swipe progress
5. Determining when to trigger the close action
6. Animating the container back to its original position if the swipe doesn't reach the threshold

The hook is designed to be combined with other touch handling logic, as demonstrated in the PhotoViewer component.
