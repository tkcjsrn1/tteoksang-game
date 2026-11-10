import { createRoot } from 'react-dom/client';
import { App } from './App';
import { store } from './net';
import './styles.css';

document.documentElement.dataset.theme = store.get('theme') === 'dark' ? 'dark' : 'light';
createRoot(document.getElementById('root')!).render(<App />);
