import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { initTheme } from './theme';
import { initTextSize } from './text';

initTheme();
initTextSize();
createRoot(document.getElementById('root')!).render(<App />);
